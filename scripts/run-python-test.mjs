import { spawnSync } from "node:child_process";

const candidates = process.platform === "win32"
  ? [
      { command: "py", args: ["-3"] },
      { command: "python", args: [] },
      { command: "python3", args: [] },
    ]
  : [
      { command: "python3", args: [] },
      { command: "python", args: [] },
    ];

for (const candidate of candidates) {
  const result = spawnSync(
    candidate.command,
    [...candidate.args, "tests/test_tool_contract.py"],
    { stdio: "inherit" },
  );

  if (result.error?.code === "ENOENT") {
    continue;
  }

  process.exit(result.status ?? 1);
}

console.error("No Python executable found. Install Python 3.9+ and try again.");
process.exit(1);
