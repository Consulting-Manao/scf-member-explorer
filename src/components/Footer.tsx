import { forwardRef } from "react";
import { Github, BookOpen, ExternalLink } from "lucide-react";
import stellarSymbol from "@/assets/stellar-symbol.png";
import scfLogo from "@/assets/scf-logo.svg";

const DiscordIcon = forwardRef<SVGSVGElement, { className?: string }>(({ className }, ref) => (
  <svg ref={ref} viewBox="0 0 24 24" className={className || "w-5 h-5"} fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
));
DiscordIcon.displayName = "DiscordIcon";

const links = [
  { label: "SCF Handbook", href: "https://stellar.gitbook.io/scf-handbook", icon: BookOpen },
  { label: "Discord", href: "https://discord.gg/stellardev", icon: DiscordIcon },
  { label: "GitHub", href: "https://github.com/stellar/stellar-community-fund-contracts", icon: Github },
];

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* Left: Branding badges */}
          <div className="flex items-center gap-6">
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="text-xs">Built on</span>
              <img
                src={stellarSymbol}
                alt="Stellar"
                width={16}
                height={16}
                loading="lazy"
                className="h-4 w-auto invert dark:invert-0"
              />
            </a>
            <a
              href="https://communityfund.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="text-xs">Powered by</span>
              <img
                src={scfLogo}
                alt="Stellar Community Fund"
                width={48}
                height={16}
                loading="lazy"
                className="h-4 w-auto invert dark:invert-0"
              />
            </a>
          </div>

          {/* Center: Copyright */}
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Stellar Community Fund
          </p>

          {/* Right: Links with icons */}
          <nav className="flex items-center gap-2">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                aria-label={link.label}
                title={link.label}
              >
                <link.icon className="h-4 w-4" />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
