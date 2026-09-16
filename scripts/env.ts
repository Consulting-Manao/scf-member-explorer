import { readFile } from "node:fs/promises";

import type { Env } from "../worker/env";

/** Worker vars from wrangler.jsonc, overridden by .dev.vars. */
export async function localEnv(): Promise<Env> {
  const jsonc = await readFile("wrangler.jsonc", "utf8");
  const wrangler = JSON.parse(
    jsonc.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"),
  );
  const dotVars = Object.fromEntries(
    (await readFile(".dev.vars", "utf8").catch(() => ""))
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  return { ...wrangler.vars, ...dotVars } as Env;
}
