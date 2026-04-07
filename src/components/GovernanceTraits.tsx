import { ExternalLink, Shield, BarChart3 } from "lucide-react";
import type { GovernanceData, TraitMetadata } from "@/services/stellar";

interface GovernanceTraitsProps {
  governance: GovernanceData | null;
  traitMeta?: Record<string, TraitMetadata> | null;
  isLoading?: boolean;
}

function formatWithDecimals(value: number | string, decimals?: number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num) || decimals === undefined || decimals === 0) return String(value);
  return (num / Math.pow(10, decimals)).toFixed(decimals);
}

export function GovernanceTraits({ governance, traitMeta, isLoading }: GovernanceTraitsProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
          Governance
        </h3>
        <div className="animate-pulse space-y-3">
          <div className="h-10 rounded-lg bg-primary/10" />
          <div className="h-10 rounded-lg bg-primary/10" />
        </div>
      </div>
    );
  }

  if (!governance) return null;

  const nqgDecimals = traitMeta?.nqg?.decimals ?? traitMeta?.nqg_score?.decimals;
  const formattedNqg =
    governance.nqg_score !== undefined
      ? formatWithDecimals(governance.nqg_score, nqgDecimals)
      : undefined;

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
        Governance
      </h3>
      <div className="space-y-3">
        {governance.role !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-background/80 p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  SCF Role
                </p>
                <p className="text-sm font-medium text-foreground">
                  {governance.role || "Member"}
                </p>
              </div>
            </div>
            <a
              href="https://stellar.gitbook.io/scf-handbook/governance/verified-members"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
        {formattedNqg !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-background/80 p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  NQG Score
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formattedNqg}
                </p>
              </div>
            </div>
            <a
              href="https://github.com/stellar/stellar-community-fund-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
