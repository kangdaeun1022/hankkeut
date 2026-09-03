import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nextCli = resolve(projectRoot, "node_modules/next/dist/bin/next");
const outDir = resolve(projectRoot, "out");
const distDir = resolve(projectRoot, "dist");

execFileSync(process.execPath, [nextCli, "build"], {
  cwd: projectRoot,
  env: { ...process.env, STATIC_EXPORT: "1" },
  stdio: "inherit",
});

rmSync(distDir, { force: true, recursive: true });
mkdirSync(resolve(distDir, "server"), { recursive: true });
cpSync(outDir, distDir, { recursive: true });

// Sites serves the validated static bundle declared in .openai/hosting.json.
// The Worker entrypoint keeps the artifact Worker-compatible.
writeFileSync(
  resolve(distDir, "server/index.js"),
  `export default { fetch: (request, env) => env.ASSETS.fetch(request) };\n`,
);
