import dns from "node:dns/promises";

/** Blocks loopback, private, and link-local ranges so a client-supplied URL can't reach internal infra. */
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

async function isSafeUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  try {
    const { address } = await dns.lookup(url.hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

const MAX_REDIRECTS = 5;

/** Fetches a user-supplied website and returns a short plain-text excerpt for AI context. Never called automatically — only when the customer explicitly shares a URL. */
export async function safeFetchWebsiteText(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    // Re-checked on every hop: a redirect target's DNS is only known once we
    // see it, so `redirect: "follow"` alone would let a 302 point at an
    // internal address after the initial hostname passed the check.
    let res: Response;
    let current = url;
    for (let hop = 0; ; hop++) {
      if (!(await isSafeUrl(current))) return null;
      res = await fetch(current.toString(), { signal: controller.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop >= MAX_REDIRECTS) return null;
        current = new URL(res.headers.get("location")!, current);
        continue;
      }
      break;
    }
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const html = Buffer.from(buf.slice(0, 200_000)).toString("utf-8");
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
