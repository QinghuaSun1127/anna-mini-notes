import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const cli = join(root, "node_modules", "@anna-ai", "cli", "dist", "cli.js");
const bridgeDist = join(root, "node_modules", "@anna-ai", "cli", "dist", "bridge-CBcQUQGU.js");

const candidates = [
  join(os.homedir(), "AppData", "Roaming", "Python", "Python39", "Scripts"),
  join(os.homedir(), "AppData", "Roaming", "Python", "Python310", "Scripts"),
  join(os.homedir(), "AppData", "Roaming", "Python", "Python311", "Scripts"),
  join(os.homedir(), ".local", "bin"),
];

const extraPath = candidates.filter(existsSync).join(process.platform === "win32" ? ";" : ":");
const env = {
  ...process.env,
  PATH: extraPath ? `${extraPath}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}` : process.env.PATH,
};

patchWindowsBridgeCommand();

const args = [cli, ...process.argv.slice(2)];
const child = spawn(process.execPath, args, {
  cwd: root,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

function patchWindowsBridgeCommand() {
  if (process.platform !== "win32" || !existsSync(bridgeDist)) return;
  const body = readFileSync(bridgeDist, "utf8");
  if (body.includes("anna-bridge-windows.py")) return;

  const runtime = join(root, "scripts", "anna-bridge-windows.py").replaceAll("\\", "/");
  const marker = "const version = this.opts.runtimeVersion ?? PINNED_RUNTIME_VERSION;";
  const replacement = `${marker}
\t\tif (process.platform === "win32") return [
\t\t\t"uv",
\t\t\t"run",
\t\t\t"--with",
\t\t\t\`anna-app-runtime-local==\${version}\`,
\t\t\t"python",
\t\t\t"${runtime}"
\t\t];`;

  if (!body.includes(marker)) return;
  writeFileSync(bridgeDist, body.replace(marker, replacement));
}
