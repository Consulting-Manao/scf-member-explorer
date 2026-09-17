import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Env } from "../src/env";

const WORKER = join(import.meta.dirname, "..");

/** Public vars of wrangler.jsonc, the deployed configuration. */
export async function wranglerVars(): Promise<Record<string, string>> {
  const jsonc = await readFile(join(WORKER, "wrangler.jsonc"), "utf8");
  const wrangler = JSON.parse(
    jsonc.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"),
  );
  return wrangler.vars as Record<string, string>;
}

/** Secrets and local overrides of .dev.vars, empty when there is no file. */
export async function devVars(): Promise<Record<string, string>> {
  return Object.fromEntries(
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
}

/** Worker vars from wrangler.jsonc, overridden by .dev.vars. */
export async function localEnv(): Promise<Env> {
  return { ...(await wranglerVars()), ...(await devVars()) } as unknown as Env;
}
