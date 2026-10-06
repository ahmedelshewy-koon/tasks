// Production start: bind all interfaces, default port 3107, PORT overrides.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const port = process.env.PORT || "3107";
const child = spawn(
  process.execPath,
  [next, "start", "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
