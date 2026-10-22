import { ADMIN_EMAILS } from "@/lib/admin/gate";

const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "live.co.uk",
  "yahoo.com",
  "yahoo.co.uk",
  "btinternet.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "back2strong.online",
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    next[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }
  return prev[b.length];
}

/**
 * A warning, not a block. Suggests a near-miss domain or a known admin address.
 * Returns the address to offer, or null when the typed email already looks fine.
 */
export function emailTypoHint(raw: string, knownEmails: readonly string[] = ADMIN_EMAILS): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@") || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || local.length > 64 || !/^[a-z0-9._+-]+$/.test(local)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;

  const known = Array.from(new Set(knownEmails.map((item) => item.toLowerCase())));
  if (known.includes(email)) return null;

  if (domain.startsWith("back2strong.") && domain !== "back2strong.online") {
    const branded = known.find((item) => item.startsWith(`${local}@`) && item.endsWith("@back2strong.online"));
    return branded ?? `${local}@back2strong.online`;
  }

  let bestKnown: { email: string; distance: number } | null = null;
  for (const candidate of known) {
    const split = candidate.lastIndexOf("@");
    if (split <= 0) continue;
    const candidateLocal = candidate.slice(0, split);
    const candidateDomain = candidate.slice(split + 1);
    if (candidateLocal === local) {
      const domainDistance = levenshtein(domain, candidateDomain);
      if (domainDistance > 0 && domainDistance <= 2) return candidate;
    }
    const distance = levenshtein(email, candidate);
    if (distance > 0 && distance <= 2 && (!bestKnown || distance < bestKnown.distance)) {
      bestKnown = { email: candidate, distance };
    }
  }
  if (bestKnown) return bestKnown.email;

  if (COMMON_DOMAINS.includes(domain)) return null;
  let bestDomain: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    if (distance > 0 && distance <= 2 && (!bestDomain || distance < bestDomain.distance)) {
      bestDomain = { domain: candidate, distance };
    }
  }
  if (!bestDomain) return null;
  const suggestion = `${local}@${bestDomain.domain}`;
  return suggestion === email ? null : suggestion;
}
