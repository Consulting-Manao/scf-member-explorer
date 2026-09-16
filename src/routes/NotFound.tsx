import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Nothing here</h1>
      <Button asChild className="mt-8">
        <Link to="/">Back to members</Link>
      </Button>
    </div>
  );
}
