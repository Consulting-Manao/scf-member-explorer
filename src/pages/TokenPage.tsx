import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, Check, ExternalLink, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GovernanceTraits } from "@/components/GovernanceTraits";
import { AttributeBadge } from "@/components/AttributeBadge";
import { getTokenUri, getOwnerOf, getGovernance, getTraitMetadataUri, type GovernanceData, type TraitMetadata } from "@/services/stellar";
import { fetchMetadata, ipfsToHttp, type NFTMetadata } from "@/services/ipfs";
import { CONTRACT_ADDRESS, EXPLORER_URL } from "@/config/networks";
import { Skeleton } from "@/components/ui/skeleton";

export default function TokenPage() {
  const { tokenId: tokenIdParam } = useParams<{ tokenId: string }>();
  const tokenId = Number(tokenIdParam);

  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [governance, setGovernance] = useState<GovernanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [govLoading, setGovLoading] = useState(true);
  const [traitMeta, setTraitMeta] = useState<Record<string, TraitMetadata> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [tokenUri, setTokenUri] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [uri, ownerAddr] = await Promise.all([
          getTokenUri(tokenId),
          getOwnerOf(tokenId),
        ]);

        if (cancelled) return;
        setTokenUri(uri);
        setOwner(ownerAddr);

        if (uri) {
          const meta = await fetchMetadata(uri);
          if (!cancelled) setMetadata(meta);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load token");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadGovernance() {
      try {
        setGovLoading(true);
        const [gov, meta] = await Promise.all([
          getGovernance(tokenId),
          getTraitMetadataUri(),
        ]);
        if (!cancelled) {
          setGovernance(gov);
          setTraitMeta(meta);
        }
      } catch {
        // governance not available
      } finally {
        if (!cancelled) setGovLoading(false);
      }
    }

    load();
    loadGovernance();
    return () => { cancelled = true; };
  }, [tokenId]);

  const copyAddress = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const imageUrl = metadata?.image ? ipfsToHttp(metadata.image) : "";
  const vanityTraits = metadata?.attributes?.filter(
    (a) => !["role", "nqg_score", "scf_role", "nqg score"].includes(a.trait_type.toLowerCase())
  ) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Collection
        </Link>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {/* Left column: Image + Governance */}
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border bg-muted">
                {imageUrl && !imgError ? (
                  <img
                    src={imageUrl}
                    alt={metadata?.name || `Token #${tokenId}`}
                    className="aspect-square w-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center">
                    <User className="h-24 w-24 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Governance Traits */}
              <GovernanceTraits governance={governance} traitMeta={traitMeta} isLoading={govLoading} />
            </div>

            {/* Right column: Details */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                  {metadata?.name || `Member #${tokenId}`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Token #{tokenId}
                </p>
                {metadata?.description && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {metadata.description}
                  </p>
                )}
              </div>

              {/* Owner */}
              {owner && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Owner
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="truncate font-mono text-sm text-foreground">
                      {owner}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copyAddress(owner)}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Vanity Traits */}
              {vanityTraits.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Attributes
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {vanityTraits.map((attr) => (
                      <AttributeBadge
                        key={attr.trait_type}
                        traitType={attr.trait_type}
                        value={attr.value}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Info */}
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Details
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contract</span>
                    <a
                      href={`${EXPLORER_URL}/contract/${CONTRACT_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                    >
                      {CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {tokenUri && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Metadata</span>
                      <a
                        href={ipfsToHttp(tokenUri)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        IPFS
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
