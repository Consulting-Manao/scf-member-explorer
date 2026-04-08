import { CONTRACT_ADDRESS } from "@/config/networks";

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_PREFIX = "scf_cache_";
const CONTRACT_KEY = `${CACHE_PREFIX}__contract__`;

// Clear all cache if contract address changed
function ensureContractMatch(): void {
  try {
    const stored = localStorage.getItem(CONTRACT_KEY);
    if (stored !== CONTRACT_ADDRESS) {
      clearCache();
      localStorage.setItem(CONTRACT_KEY, CONTRACT_ADDRESS);
    }
  } catch {
    // localStorage unavailable
  }
}

ensureContractMatch();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`scf_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TTL_MS) {
      localStorage.removeItem(`scf_cache_${key}`);
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
    localStorage.setItem(`scf_cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

export function clearCache(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX) && k !== CONTRACT_KEY);
  keys.forEach((k) => localStorage.removeItem(k));
}
