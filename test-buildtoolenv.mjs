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

// Simulate the server runtime env: PAPERCLIP_API_URL points at the public
// (unreachable-for-local) host, while the loopback listen host/port is the
// address run_command must actually use.
process.env.PAPERCLIP_API_URL = "http://172.16.250.1:3101"; // public, wrong for local
process.env.PAPERCLIP_LISTEN_HOST = "127.0.0.1";
process.env.PAPERCLIP_LISTEN_PORT = "3101";

const env = buildToolEnv(ctx);
const checks = [
  ["PAPERCLIP_API_KEY", "jwt-token-value"],
  ["PAPERCLIP_API_URL", "http://127.0.0.1:3101"], // loopback, NOT the public host
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
