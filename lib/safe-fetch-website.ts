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

/** Fetches a user-supplied website and returns a short plain-text excerpt for AI context. Never called automatically — only when the customer explicitly shares a URL. */
export async function safeFetchWebsiteText(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  try {
    const { address } = await dns.lookup(url.hostname);
    if (isPrivateIp(address)) return null;
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal, redirect: "follow" });
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
