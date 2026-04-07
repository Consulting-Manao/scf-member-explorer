import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">S</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              Stellar Community Fund
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              NFT Member Explorer
            </p>
          </div>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
