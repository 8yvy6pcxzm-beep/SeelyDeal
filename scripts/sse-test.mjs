import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Disposable test account — not the real owner's — so this can be re-run freely
// without touching real company data or quota.
const email = "test-onboard-1786623278139@example.com";
const { data: linkData, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties.hashed_token });
if (verifyErr) throw verifyErr;
const token = verifyData.session.access_token;
console.log("Authed as", email);

async function streamRequest(label, body) {
  console.log(`\n===== ${label} =====`);
  const t0 = Date.now();
  const res = await fetch("http://localhost:3000/api/draft-proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  console.log("status:", res.status, "content-type:", res.headers.get("content-type"));
  if (!res.ok || !res.body) {
    console.log("body:", await res.text());
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  let firstEventMs = null;
  let lastEventMs = null;
  let textDeltaCount = 0;
  let fullReply = "";
  let draft = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const now = Date.now();
      if (firstEventMs === null) firstEventMs = now - t0;
      lastEventMs = now - t0;
      const evt = JSON.parse(line.slice(5).trim());
      events.push(evt);
      if (evt.type === "text") { textDeltaCount++; fullReply += evt.delta; }
      if (evt.type === "draft") draft = evt.draft;
      if (evt.type !== "text") console.log(`  [+${now - t0}ms]`, evt.type, JSON.stringify(evt).slice(0, 300));
    }
  }

  console.log(`Total events: ${events.length} | text deltas: ${textDeltaCount} | first event at ${firstEventMs}ms | last at ${lastEventMs}ms`);
  console.log("Reply text:", fullReply.slice(0, 400));
  return { events, draft, fullReply };
}

// 1) Weak prompt — should short-circuit to a `clarify` event with NO model call
// (Orchestrator's needs_info path), and should return almost instantly.
const r1 = await streamRequest("WEAK PROMPT -> expect clarify, fast", {
  messages: [{ role: "user", content: "teklif yaz" }],
});

// 2a) Full prompt, first turn — this company has no default_sections, so the
// Planner should gate on the section-choice Clarifier (messageCount<=1).
const briefText =
  "ABC Lojistik için operasyonel danışmanlık teklifi hazırla. 3 aylık proje, aylık 15.000$ danışmanlık ücreti. Sözleşme şartları da olsun.";
const r2a = await streamRequest("FULL PROMPT, turn 1 -> expect sections clarify (first turn)", {
  messages: [{ role: "user", content: briefText }],
});
console.log("turn 1 needsUserChoice confirmed:", !!r2a?.events.find((e) => e.type === "clarify"));

// 2b) Same brief, turn 2 (user "answered" the section chips) — Planner should
// now fall through (messageCount>1) and let the Writer actually run.
const r2 = await streamRequest("FULL PROMPT, turn 2 -> expect real draft this time", {
  messages: [
    { role: "user", content: briefText },
    { role: "user", content: "Sözleşme Şartları da ekle, gerisi yeterli." },
  ],
});

if (r2?.draft) {
  // 3) Edit mode — small targeted revision against the draft from step 2.
  // Orchestrator should classify this as `revise` (short message + currentDraft),
  // and the resulting draft should change ONLY the price, not other fields.
  const r3 = await streamRequest("EDIT MODE -> targeted revision", {
    messages: [
      { role: "user", content: "ABC Lojistik için operasyonel danışmanlık teklifi hazırla. 3 aylık proje, aylık 15.000$ danışmanlık ücreti. Sözleşme şartları da olsun." },
      { role: "assistant", content: r2.fullReply || "Taslağı hazırladım." },
      { role: "user", content: "aylık ücreti 20000 yap" },
    ],
    currentDraft: r2.draft,
  });

  if (r3?.draft) {
    console.log("\nPrice before:", r2.draft.lineItems?.map((l) => `${l.name}: ${l.qty}x${l.unit}`));
    console.log("Price after: ", r3.draft.lineItems?.map((l) => `${l.name}: ${l.qty}x${l.unit}`));
    console.log("Title unchanged:", r2.draft.title === r3.draft.title, `("${r2.draft.title}" vs "${r3.draft.title}")`);
    console.log("Client unchanged:", r2.draft.client === r3.draft.client);
  }
}
