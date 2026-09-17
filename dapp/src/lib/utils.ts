import { clsx, type ClassValue } from "clsx";
import { MembershipError } from "@/bindings";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string, size = 4): string {
  if (address.length <= 2 * size + 3) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}

/**
 * A member's own link, as a web address or not at all: it comes from their
 * profile on IPFS and is rendered on a page anyone can open.
 */
export function httpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

const CONTRACT_ERRORS: Record<string, string> = {
  UnauthorizedSigner: "Only the member or an admin can do this.",
  NonExistentToken: "This member does not exist.",
  MemberAlreadyExist: "This address already holds a membership.",
  AccountAlreadyBound: "One of these accounts belongs to another member.",
  TooManyProjects: "You can list at most 10 projects.",
  InvalidLength: "A value is empty or too long.",
  TokenRevoked: "This membership has been revoked.",
  DuplicateProvider: "Only one account per platform.",
  RecoveryPending: "A recovery is already pending for this member.",
  NoRecovery: "There is no pending recovery.",
  AttesterChanged:
    "The account that vouched for this recovery has been replaced. Prove your accounts again.",
  RecoveryExpired:
    "This recovery was not finalized in time. Prove your accounts again.",
};

/**
 * Whether the user backed out in the wallet. Wallets and the kit reject
 * with `{ code, message }` objects; errors from the network or the
 * contract are `Error` instances and never count.
 */
export function isCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    !(error instanceof Error) &&
    "code" in error &&
    /closed the modal|reject|declin|cancel/i.test(rawMessage(error))
  );
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error ?? "Unknown error");
}

/** Human readable message for wallet, contract and network errors. */
export function errorMessage(error: unknown): string {
  const message = rawMessage(error);
  const code = message.match(/Error\(Contract, #(\d+)\)/)?.[1];
  if (code) {
    const name =
      MembershipError[Number(code) as keyof typeof MembershipError]?.message;
    if (name) return CONTRACT_ERRORS[name] ?? name;
  }
  if (isCancelled(error)) return "Request cancelled.";
  return message;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}
