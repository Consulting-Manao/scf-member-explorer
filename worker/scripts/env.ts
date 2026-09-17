import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Env } from "../src/env";

const WORKER = join(import.meta.dirname, "..");

/** Worker vars from wrangler.jsonc, overridden by .dev.vars. */
export async function localEnv(): Promise<Env> {
  const jsonc = await readFile(join(WORKER, "wrangler.jsonc"), "utf8");
  const wrangler = JSON.parse(
    jsonc.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"),
  );
  const dotVars = Object.fromEntries(
    (await readFile(join(WORKER, ".dev.vars"), "utf8").catch(() => ""))
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
      .map((line) => {
        const at = line.indexOf("=");
        // wrangler accepts a quoted value
        const value = line.slice(at + 1).replace(/^(['"])(.*)\1$/, "$2");
        return [line.slice(0, at), value];
      }),
  );
  return { ...wrangler.vars, ...dotVars } as Env;
}
