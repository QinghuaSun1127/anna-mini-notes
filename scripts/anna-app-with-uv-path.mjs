import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const cli = join(root, "node_modules", "@anna-ai", "cli", "dist", "cli.js");

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
