import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ipfsToHttp, type NFTMetadata } from "@/services/ipfs";
import { TokenImageOverlay } from "@/components/TokenImageOverlay";
import { User } from "lucide-react";
import { useEffect, useState } from "react";

interface NFTCardProps {
  tokenId: number;
  metadata: NFTMetadata | null;
  owner: string | null;
  memberName?: string | null;
  memberPicture?: string | null;
}

export function NFTCard({ tokenId, metadata, owner, memberName, memberPicture }: NFTCardProps) {
  const [imgError, setImgError] = useState(false);

  const isMinted = !!owner;
  const displayImage = memberPicture ? ipfsToHttp(memberPicture) : metadata?.image ? ipfsToHttp(metadata.image) : "";

  useEffect(() => {
    setImgError(false);
  }, [displayImage]);

  return (
    <Link to={`/token/${tokenId}`}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {displayImage && !imgError ? (
            <img
              src={displayImage}
              alt={memberName || metadata?.name || `Token #${tokenId}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          {memberPicture && metadata?.image && memberPicture !== metadata.image && (
            <TokenImageOverlay tokenImage={metadata.image} alt={metadata?.name || `Token #${tokenId}`} size="sm" />
          )}
          {!isMinted && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Not Minted
              </span>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="truncate font-medium text-foreground">
            {memberName || metadata?.name || `Member #${tokenId}`}
          </h3>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={owner || undefined}>
            {owner ? `${owner.slice(0, 6)}...${owner.slice(-6)}` : "Not Minted"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
