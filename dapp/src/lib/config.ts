import type { AppConfig } from "@stellar-membership/shared";

let current: AppConfig | undefined;

export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config");
  const body = (await res.json().catch(() => ({}))) as
    AppConfig | { error?: string };
  if (!res.ok) {
    const reason = "error" in body ? body.error : undefined;
    throw new Error(reason ?? `Cannot load configuration (${res.status})`);
  }
  current = body as AppConfig;
  return current;
}

/** The configuration, loaded before the app renders. */
export function config(): AppConfig {
  if (!current) throw new Error("Configuration not loaded");
  return current;
}

export function explorerUrl(kind: "account" | "contract" | "tx", id: string) {
  const network = config().network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/${kind}/${id}`;
}
