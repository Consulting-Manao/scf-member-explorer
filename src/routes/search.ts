export const JOIN_STEPS = ["accounts", "profile", "review"] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

export const ME_TABS = ["profile", "projects", "accounts", "key"] as const;
export type MeTab = (typeof ME_TABS)[number];
