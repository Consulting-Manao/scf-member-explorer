import { Link, Outlet } from "@tanstack/react-router";

import { config, explorerUrl } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useAdmin, useMyMembership } from "@/queries/members";

import { ConnectButton } from "./ConnectButton";
import { Logo } from "./icons";
import { ThemeToggle } from "./ThemeToggle";

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
  const { address } = useMyMembership();
  const { data: admin } = useAdmin();

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
          <nav className="ml-2 flex items-center gap-1">
            <NavLink to="/">Members</NavLink>
            {address && <NavLink to="/profile">Profile</NavLink>}
            {address && address === admin && (
              <NavLink to="/admin">Admin</NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
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
          <p>Your identify on Stellar</p>
          <div className="flex flex-wrap gap-4">
            <Link
              className="hover:text-foreground"
              to="/profile"
              search={{ mode: "recover" }}
            >
              Lost your key?
            </Link>
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
