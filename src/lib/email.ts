/**
 * Only the hash of an email is on-chain. This browser remembers the emails
 * it has seen behind their hash, so their owner can read them back.
 */
const KEY = "emails";

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

export function rememberEmail(hash: string, email: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [hash]: email }));
  } catch {
    // storage may be unavailable
  }
}

/** The email behind a hash, when this browser has seen it. */
export function knownEmail(hash: string | null | undefined): string | null {
  if (!hash) return null;
  return read()[hash] ?? null;
}
