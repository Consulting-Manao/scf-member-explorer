import { ExternalLink } from "lucide-react";

const links = [
  { label: "Stellar", href: "https://stellar.org" },
  { label: "Community Fund", href: "https://communityfund.stellar.org" },
  { label: "SCF Handbook", href: "https://stellar.gitbook.io/scf-handbook" },
  { label: "Stellar Dev Discord", href: "https://discord.gg/stellardev" },
  { label: "GitHub", href: "https://github.com/stellar/stellar-community-fund-contracts" },
];

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Built on</span>
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              Stellar
            </a>
          </div>
          <nav className="flex flex-wrap justify-center gap-4">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </nav>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Stellar Community Fund
        </p>
      </div>
    </footer>
  );
}
