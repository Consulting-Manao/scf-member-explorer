import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { Layout } from "./components/Layout";
import { Admin } from "./routes/Admin";
import { Home } from "./routes/Home";
import { MemberPage } from "./routes/Member";
import { NotFound } from "./routes/NotFound";
import { OAuthCallback } from "./routes/OAuthCallback";
import { Profile } from "./routes/profile";

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: NotFound,
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/members/$tokenId",
    component: MemberPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/profile",
    validateSearch: (search: Record<string, unknown>): { mode?: "recover" } =>
      search.mode === "recover" ? { mode: "recover" } : {},
    component: Profile,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component: Admin,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/oauth/callback/$provider",
    component: OAuthCallback,
  }),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
