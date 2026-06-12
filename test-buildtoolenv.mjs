// Reproduction test for worker API auth: buildToolEnv must expose
// PAPERCLIP_API_KEY (from ctx.authToken) and PAPERCLIP_API_URL so the
// model-driven run_command can authenticate to the Paperclip API without
// minting its own JWT.
import { buildToolEnv } from "./dist/server/execute.js";

const ctx = {
  runId: "run-123",
  agent: { id: "agent-abc", companyId: "company-xyz" },
  runtime: { taskKey: "KEV-1" },
  context: { paperclipWorkspace: { cwd: "/tmp/ws" } },
  authToken: "jwt-token-value",
};

const env = buildToolEnv(ctx);
const checks = [
  ["PAPERCLIP_API_KEY", "jwt-token-value"],
  ["PAPERCLIP_API_URL", undefined], // any non-empty value is fine
  ["PAPERCLIP_RUN_ID", "run-123"],
  ["PAPERCLIP_AGENT_ID", "agent-abc"],
];

let failed = 0;
for (const [key, expected] of checks) {
  const actual = env[key];
  const ok = expected === undefined
    ? typeof actual === "string" && actual.trim() !== ""
    : actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"} ${key} = ${JSON.stringify(actual)}`);
  if (!ok) failed++;
}
console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
