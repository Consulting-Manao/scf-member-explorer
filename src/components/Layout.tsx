import { Link, Outlet } from "@tanstack/react-router";

import { config, explorerUrl } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useAdmin, useMyMembership } from "@/queries/members";

import { ConnectButton } from "./ConnectButton";
import { Logo } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "./ui/badge";

function NavLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:bg-muted data-[status=active]:text-foreground"
    >
      {children}
    </Link>
  );
}

export function Layout() {
  const { address, member } = useMyMembership();
  const { data: admin } = useAdmin();
  const testnet = config().network === "testnet";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="hidden font-display text-lg font-semibold sm:inline">
              Stellar Members
            </span>
          </Link>
          {testnet && <Badge variant="warning">Testnet</Badge>}
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            <NavLink to="/">Members</NavLink>
            {member ? (
              <NavLink to="/me">My membership</NavLink>
            ) : (
              <NavLink to="/join">Join</NavLink>
            )}
            <NavLink to="/recover">Recover</NavLink>
            {address && address === admin && (
              <NavLink to="/admin">Admin</NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          <NavLink to="/">Members</NavLink>
          {member ? (
            <NavLink to="/me">Me</NavLink>
          ) : (
            <NavLink to="/join">Join</NavLink>
          )}
          <NavLink to="/recover">Recover</NavLink>
          {address && address === admin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t">
        <div
          className={cn(
            "mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6",
          )}
        >
          <p>The Stellar community, on-chain.</p>
          <div className="flex flex-wrap gap-4">
            <a
              className="hover:text-foreground"
              href={explorerUrl("contract", config().contractId)}
              target="_blank"
              rel="noreferrer"
            >
              Contract
            </a>
            <a
              className="hover:text-foreground"
              href="https://www.pgatlas.xyz"
              target="_blank"
              rel="noreferrer"
            >
              PG Atlas
            </a>
            <a
              className="hover:text-foreground"
              href="https://discord.gg/stellardev"
              target="_blank"
              rel="noreferrer"
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
