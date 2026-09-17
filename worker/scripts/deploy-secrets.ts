/**
 * Push the secrets of .dev.vars to Cloudflare in one call.
 *
 * That file also serves as the local override of any public var of
 * wrangler.jsonc, and a secret shadows the deployed vars. A local
 * GITHUB_CLIENT_ID pushed this way would point the deployment at the
 * development OAuth app, so every var wrangler.jsonc already declares is
 * left behind here rather than sent.
 */

import { spawn } from "node:child_process";

import { devVars, wranglerVars } from "./env";

const vars = await wranglerVars();
const secrets: Record<string, string> = {};
const skipped: string[] = [];

for (const [name, value] of Object.entries(await devVars())) {
  if (name in vars) skipped.push(name);
  else secrets[name] = value;
}

const names = Object.keys(secrets);
if (names.length === 0) {
  console.error("nothing to push: .dev.vars holds no secret");
  process.exit(1);
}
if (skipped.length > 0) {
  console.log(`local override, not pushed: ${skipped.join(", ")}`);
}
console.log(`pushing ${names.join(", ")}`);

// wrangler reads the bulk JSON from stdin when it is given no file
const wrangler = spawn("wrangler", ["secret", "bulk"], {
  stdio: ["pipe", "inherit", "inherit"],
});
wrangler.stdin.end(JSON.stringify(secrets));
wrangler.on("exit", (code) => process.exit(code ?? 1));
