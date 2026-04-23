const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_PREFIX = "scf_cache_";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TTL_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

