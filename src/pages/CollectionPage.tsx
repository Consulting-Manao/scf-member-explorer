import { useEffect, useState, useCallback, useRef } from "react";
import { NFTCard } from "@/components/NFTCard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getTotalTokens, getTokenUri, getOwnerOf } from "@/services/stellar";
import { fetchMetadata, type NFTMetadata } from "@/services/ipfs";
import { Loader2 } from "lucide-react";

const BATCH_SIZE = 20;

interface TokenData {
  tokenId: number;
  metadata: NFTMetadata | null;
  owner: string | null;
}

export default function CollectionPage() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedCount = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadBatch = useCallback(
    async (startId: number, total: number) => {
      const endId = Math.min(startId + BATCH_SIZE, total);

      const promises = [];
      for (let id = startId; id < endId; id++) {
        promises.push(
          (async () => {
            try {
              const [uri, owner] = await Promise.all([
                getTokenUri(id),
                getOwnerOf(id),
              ]);
              let metadata: NFTMetadata | null = null;
              if (uri) {
                try {
                  metadata = await fetchMetadata(uri);
                } catch {
                  // metadata fetch failed
                }
              }
              return { tokenId: id, metadata, owner };
            } catch {
              return { tokenId: id, metadata: null, owner: null };
            }
          })()
        );
      }

      const results = await Promise.all(promises);
      // Sort by tokenId to maintain order
      results.sort((a, b) => a.tokenId - b.tokenId);
      return results;
    },
    []
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        const total = await getTotalTokens();
        if (cancelled) return;
        setTotalTokens(total);

        if (total === 0) {
          setLoading(false);
          return;
        }

        const batch = await loadBatch(0, total);
        if (cancelled) return;
        setTokens(batch);
        loadedCount.current = batch.length;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load collection");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [loadBatch]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || totalTokens === null) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingMore &&
          loadedCount.current < totalTokens
        ) {
          setLoadingMore(true);
          try {
            const batch = await loadBatch(loadedCount.current, totalTokens);
            setTokens((prev) => [...prev, ...batch]);
            loadedCount.current += batch.length;
          } catch {
            // silent fail for infinite scroll
          } finally {
            setLoadingMore(false);
          }
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [totalTokens, loadingMore, loadBatch]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-muted-foreground">
            Explore the membership NFT collection of the Stellar Community Fund — representing
            verified members who participate in SCF governance.
          </p>
          {totalTokens !== null && (
            <p className="mt-2 text-sm text-muted-foreground">
              {totalTokens} total members
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No tokens found in this collection.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {tokens.map((token) => (
                <NFTCard
                  key={token.tokenId}
                  tokenId={token.tokenId}
                  metadata={token.metadata}
                  owner={token.owner}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="py-8 text-center">
              {loadingMore && (
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
