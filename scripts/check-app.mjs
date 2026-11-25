import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error("Run this pipeline with npm run test:app.");

const stages = [
  { name: "Lint", script: "lint" },
  { name: "Typecheck", script: "typecheck" },
  { name: "Unit and contract tests", script: "test" },
  { name: "Android, iOS and Web bundles", script: "export:all" },
  { name: "11 UI fixture suites", script: "test:ui:ci" },
].map((stage) => ({ ...stage, status: "skipped" }));
const startedAt = new Date().toISOString();
const reportDir = path.join(root, ".cache/app-tests");
await mkdir(reportDir, { recursive: true });

// This export is only for automated QA. Device builds use their real Gateway URL.
const env = {
  ...process.env,
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  EXPO_PUBLIC_API_URL: "https://ci.invalid/api/v1",
  EXPO_PUBLIC_PAYMENT_SANDBOX: "true",
  WOLFARI_EXPORT_DIR: path.join(root, "dist"),
};
let activeChild;
let interruptedBy;
const stop = (signal) => {
  interruptedBy ??= signal;
  activeChild?.kill(signal);
};
const onInterrupt = () => stop("SIGINT");
const onTerminate = () => stop("SIGTERM");
process.on("SIGINT", onInterrupt);
process.on("SIGTERM", onTerminate);

try {
  for (const stage of stages) {
    if (interruptedBy) break;
    console.log(`\n[app-test] ${stage.name}`);
    const started = Date.now();
    try {
      const result = await new Promise((resolve, reject) => {
        // Calling npm's JS entry point works on Windows without shell quoting.
        activeChild = spawn(process.execPath, [npmCli, "run", stage.script], {
          cwd: root,
          env,
          stdio: "inherit",
          windowsHide: true,
        });
        activeChild.once("error", reject);
        activeChild.once("close", (code, signal) => resolve({ code, signal }));
      });
      stage.exitCode = result.code;
      stage.signal = result.signal;
      if (result.code !== 0 || interruptedBy)
        throw Error(`${stage.name} failed (${result.signal ?? interruptedBy ?? result.code}).`);
      stage.status = "passed";
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
      console.error(`[app-test] ${error.message}`);
      break;
    } finally {
      activeChild = undefined;
      stage.durationMs = Date.now() - started;
    }
  }
} finally {
  process.removeListener("SIGINT", onInterrupt);
  process.removeListener("SIGTERM", onTerminate);
  const passed = !interruptedBy && stages.every((stage) => stage.status === "passed");
  await writeFile(
    path.join(reportDir, "report.json"),
    JSON.stringify({
      startedAt,
      finishedAt: new Date().toISOString(),
      status: passed ? "passed" : "failed",
      node: process.version,
      platform: process.platform,
      interruptedBy,
      stages,
    }, null, 2) + "\n",
  );
  console.log(`\n[app-test] ${passed ? "PASS" : "FAIL"}; report: .cache/app-tests/report.json`);
  process.exitCode = passed ? 0 : interruptedBy === "SIGINT" ? 130 : 1;
}
