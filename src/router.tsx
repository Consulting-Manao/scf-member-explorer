import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { Layout } from "./components/Layout";
import { Admin } from "./routes/Admin";
import { Home } from "./routes/Home";
import { Join } from "./routes/Join";
import { Me } from "./routes/Me";
import { MemberPage } from "./routes/Member";
import { NotFound } from "./routes/NotFound";
import { OAuthCallback } from "./routes/OAuthCallback";
import { Recover } from "./routes/Recover";
import {
  JOIN_STEPS,
  ME_TABS,
  type JoinStep,
  type MeTab,
} from "./routes/search";

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
    path: "/join",
    validateSearch: (search: Record<string, unknown>): { step: JoinStep } => ({
      step: JOIN_STEPS.includes(search.step as JoinStep)
        ? (search.step as JoinStep)
        : "accounts",
    }),
    component: Join,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/me",
    validateSearch: (search: Record<string, unknown>): { tab: MeTab } => ({
      tab: ME_TABS.includes(search.tab as MeTab)
        ? (search.tab as MeTab)
        : "profile",
    }),
    component: Me,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/recover",
    component: Recover,
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
