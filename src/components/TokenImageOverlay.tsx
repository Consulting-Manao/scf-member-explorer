import { ipfsToHttp } from "@/services/ipfs";
import { cn } from "@/lib/utils";

interface TokenImageOverlayProps {
  tokenImage: string;
  alt?: string;
  size?: "sm" | "lg";
}

export function TokenImageOverlay({ tokenImage, alt = "Token image", size = "sm" }: TokenImageOverlayProps) {
  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-lg border bg-background shadow-sm",
        size === "sm" ? "right-1 top-1 h-8 w-8 p-0.5" : "right-2 top-2 h-12 w-12 p-0.5"
      )}
    >
      <img
        src={ipfsToHttp(tokenImage)}
        alt={alt}
        className="h-full w-full rounded-md object-cover"
      />
    </div>
  );
}
