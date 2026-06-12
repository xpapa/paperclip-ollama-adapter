import { promises as fs } from "node:fs";
import { ADAPTER_TYPE } from "../types.js";
import { parseConfig } from "./config.js";
import { invokeOllama } from "./ollama.js";
import { buildPrompt } from "./prompt.js";
import { parseSession } from "./session.js";
import { loadManagedSkills } from "./skills.js";
/**
 * Paperclip server entrypoint for a single adapter run.
 *
 * It validates config, renders the Paperclip prompt, calls Ollama, and maps the
 * provider result back into Paperclip's `AdapterExecutionResult` contract.
 */
export async function execute(ctx) {
    const { config, errors } = parseConfig(ctx.config);
    if (!config) {
        return {
            exitCode: 1,
            signal: null,
            timedOut: false,
            errorMessage: errors.join("; "),
            errorCode: "config_invalid",
            errorMeta: { errors }
        };
    }
    await ctx.onLog("stdout", `[${ADAPTER_TYPE}] Starting run ${ctx.runId}\n`);
    await logDebug(ctx, config.logging, "Parsed adapter config", {
        model: config.model,
        baseUrl: config.baseUrl,
        timeoutSec: config.timeoutSec,
        ollamaTimeoutSec: config.ollamaTimeoutSec,
        logging: config.logging ?? false,
        enableCommandExecution: config.enableCommandExecution ?? false,
        commandCwd: config.commandCwd ?? null,
        commandTimeoutSec: config.commandTimeoutSec,
        maxToolCalls: config.maxToolCalls,
        skillSelectionMode: config.skillSelectionMode,
        hasInstructions: Boolean(config.instructions),
        hasPromptTemplate: Boolean(config.promptTemplate),
        think: config.think ?? null
    });
    const resolvedCommandCwd = resolveCommandCwd(ctx, config.commandCwd);
    await logDebug(ctx, config.logging, "Resolved command working directory", {
        source: readCommandCwdSource(ctx, config.commandCwd),
        cwd: resolvedCommandCwd
    });
    const loadedSkills = await loadManagedSkills(ctx.config, ctx.context, {
        config,
        onLog: ctx.onLog
    });
    for (const warning of loadedSkills.warnings) {
        await ctx.onLog("stderr", `[${ADAPTER_TYPE}:skills] ${warning}\n`);
    }
    if (loadedSkills.skills.length > 0) {
        await ctx.onLog("stdout", `[${ADAPTER_TYPE}:skills] Loaded ${loadedSkills.skills.length} skill(s): ${loadedSkills.skills.map((skill) => skill.includeBody ? skill.name : `${skill.name} (metadata)`).join(", ")}\n`);
    }
    const prompt = buildPrompt(ctx, config, loadedSkills.skills);
    await logDebug(ctx, config.logging, "Rendered prompt", {
        length: prompt.length,
        skills: loadedSkills.skills.map((skill) => ({
            name: skill.name,
            path: skill.path
        })),
        prompt
    });
    // Prepend the Paperclip-managed instructions bundle (AGENTS.md) to the
    // system instructions. Builtin adapters consume config.instructionsFilePath
    // the same way; an explicit `instructions` string is appended after it.
    let effectiveInstructions = config.instructions;
    if (config.instructionsFilePath) {
        try {
            const fileInstructions = (await fs.readFile(config.instructionsFilePath, "utf8")).trim();
            if (fileInstructions) {
                effectiveInstructions = [fileInstructions, config.instructions]
                    .filter(Boolean)
                    .join("\n\n");
                await ctx.onLog("stdout", `[${ADAPTER_TYPE}] Injected role instructions (${fileInstructions.length} chars from ${config.instructionsFilePath})\n`);
            }
        }
        catch {
            // Non-fatal — the run proceeds without the bundle
        }
    }
    const result = await invokeOllama({
        baseUrl: config.baseUrl,
        model: config.model,
        prompt,
        timeoutMs: config.ollamaTimeoutSec * 1000,
        session: parseSession(ctx.runtime.sessionParams),
        streaming: config.streaming ?? true,
        runId: ctx.runId,
        onLog: ctx.onLog,
        toolEnv: buildToolEnv(ctx),
        ...(ctx.onSpawn ? { onSpawn: ctx.onSpawn } : {}),
        commandExecution: {
            enabled: config.enableCommandExecution ?? false,
            cwd: resolvedCommandCwd,
            timeoutSec: config.commandTimeoutSec,
            maxToolCalls: config.maxToolCalls
        },
        ...(config.logging !== undefined ? { logging: config.logging } : {}),
        ...(effectiveInstructions ? { instructions: effectiveInstructions } : {}),
        ...(config.think !== undefined ? { think: config.think } : {})
    });
    if (!result.success) {
        await ctx.onLog("stderr", `[${ADAPTER_TYPE}] ${result.error ?? "Invocation failed"}\n`);
    }
    return {
        exitCode: result.success ? 0 : 1,
        signal: null,
        timedOut: result.timedOut,
        errorMessage: result.success ? null : result.error ?? "Ollama invocation failed",
        errorCode: result.success ? null : result.errorCode ?? "ollama_invocation_failed",
        usage: result.usage,
        provider: "ollama",
        model: result.model,
        billingType: "unknown",
        costUsd: result.costUsd,
        summary: result.summary,
        resultJson: result.raw,
        sessionId: result.session?.sessionId ?? null,
        sessionParams: result.session ? { ...result.session } : null,
        sessionDisplayId: result.session?.sessionId ?? null
    };
}
/**
 * Picks the default command working directory for model-requested tools.
 *
 * Priority:
 * 1. Explicit adapter `commandCwd`
 * 2. Paperclip workspace cwd from wake context
 * 3. Adapter process cwd as final fallback
 */
export function resolveCommandCwd(ctx, configuredCommandCwd) {
    if (configuredCommandCwd) {
        return configuredCommandCwd;
    }
    const workspace = ctx.context.paperclipWorkspace;
    if (typeof workspace === "object" && workspace !== null) {
        const cwd = workspace.cwd;
        if (typeof cwd === "string" && cwd.trim() !== "") {
            return cwd;
        }
    }
    return process.cwd();
}
export function buildToolEnv(ctx) {
    return Object.fromEntries([
        // The adapter declares supportsLocalAgentJwt, so the server mints a
        // short-lived JWT and passes it as ctx.authToken. Expose it (plus the
        // API base URL) to run_command so the model can authenticate Paperclip
        // API writes instead of minting its own token. The wake prompt expects
        // PAPERCLIP_API_URL as the base WITHOUT the /api suffix.
        ["PAPERCLIP_API_KEY", typeof ctx.authToken === "string" ? ctx.authToken : undefined],
        ["PAPERCLIP_API_URL", resolveApiBaseUrl(ctx)],
        ["PAPERCLIP_COMPANY_ID", ctx.agent.companyId],
        ["PAPERCLIP_AGENT_ID", ctx.agent.id],
        ["PAPERCLIP_RUN_ID", ctx.runId],
        ["PAPERCLIP_TASK_ID", readTaskId(ctx)],
        ["PAPERCLIP_WAKE_REASON", readContextString(ctx.context, "wakeReason")],
        ["PAPERCLIP_WAKE_COMMENT_ID", readContextString(ctx.context, "wakeCommentId")],
        ["PAPERCLIP_APPROVAL_ID", readContextString(ctx.context, "approvalId")],
        ["PAPERCLIP_APPROVAL_STATUS", readContextString(ctx.context, "approvalStatus")],
        ["PAPERCLIP_LINKED_ISSUE_IDS", readContextStringList(ctx.context, "linkedIssueIds")],
        ["PAPERCLIP_WAKE_PAYLOAD_JSON", readWakePayloadJson(ctx.context)],
        ["PAPERCLIP_WORKSPACE_CWD", readPaperclipWorkspaceCwd(ctx.context)]
    ].filter((entry) => {
        return typeof entry[1] === "string" && entry[1].trim() !== "";
    }));
}
/**
 * Resolves the Paperclip API base URL exposed to run_command as
 * PAPERCLIP_API_URL. The wake prompt appends "/api/...", so this returns the
 * origin WITHOUT a trailing "/api" or slash.
 *
 * run_command runs on the same host as the server, which binds loopback, so we
 * use the server's actual listen host/port. We deliberately avoid
 * process.env.PAPERCLIP_API_URL: the server sets that to the public/preferred
 * URL (e.g. an nginx hostname on a different port) which is NOT reachable for
 * co-located local tool execution. Priority: explicit adapter override,
 * server listen host+port, runtime (loopback) URL, loopback default.
 */
function resolveApiBaseUrl(ctx) {
    const config = (ctx.config ?? {});
    const normalize = (value) => value.trim().replace(/\/+$/, "").replace(/\/api$/, "").replace(/\/+$/, "");
    const readEnv = (key) => {
        const value = process.env[key];
        return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
    };
    const override = typeof config.paperclipApiUrl === "string" && config.paperclipApiUrl.trim() !== ""
        ? config.paperclipApiUrl
        : undefined;
    if (override) {
        return normalize(override);
    }
    const listenPort = readEnv("PAPERCLIP_LISTEN_PORT");
    if (listenPort) {
        const rawHost = readEnv("PAPERCLIP_LISTEN_HOST");
        const host = !rawHost || rawHost === "0.0.0.0" || rawHost === "::" ? "127.0.0.1" : rawHost;
        return `http://${host}:${listenPort}`;
    }
    const runtimeUrl = readEnv("PAPERCLIP_RUNTIME_API_URL");
    if (runtimeUrl) {
        return normalize(runtimeUrl);
    }
    return "http://127.0.0.1:3101";
}
function readTaskId(ctx) {
    const contextTaskId = readContextString(ctx.context, "taskId");
    if (contextTaskId) {
        return contextTaskId;
    }
    return typeof ctx.runtime.taskKey === "string" ? ctx.runtime.taskKey : undefined;
}
function readContextString(context, key) {
    if (typeof context !== "object" || context === null) {
        return undefined;
    }
    const value = context[key];
    return typeof value === "string" ? value : undefined;
}
function readContextStringList(context, key) {
    if (typeof context !== "object" || context === null) {
        return undefined;
    }
    const value = context[key];
    if (typeof value === "string") {
        return value;
    }
    if (!Array.isArray(value)) {
        return undefined;
    }
    const strings = value.filter((item) => {
        return typeof item === "string" && item.trim() !== "";
    });
    return strings.length > 0 ? strings.join(",") : undefined;
}
function readWakePayloadJson(context) {
    if (typeof context !== "object" || context === null) {
        return undefined;
    }
    const record = context;
    if (typeof record.wakePayloadJson === "string") {
        return record.wakePayloadJson;
    }
    if (typeof record.wakePayloadJSON === "string") {
        return record.wakePayloadJSON;
    }
    const payload = record.wakePayload;
    if (payload === undefined) {
        return undefined;
    }
    return JSON.stringify(payload);
}
function readPaperclipWorkspaceCwd(context) {
    if (typeof context !== "object" || context === null) {
        return undefined;
    }
    const workspace = context.paperclipWorkspace;
    if (typeof workspace !== "object" || workspace === null) {
        return undefined;
    }
    const cwd = workspace.cwd;
    return typeof cwd === "string" ? cwd : undefined;
}
function readCommandCwdSource(ctx, configuredCommandCwd) {
    if (configuredCommandCwd) {
        return "adapterConfig.commandCwd";
    }
    const workspace = ctx.context.paperclipWorkspace;
    if (typeof workspace === "object" && workspace !== null) {
        const cwd = workspace.cwd;
        if (typeof cwd === "string" && cwd.trim() !== "") {
            return "context.paperclipWorkspace.cwd";
        }
    }
    return "process.cwd";
}
/** Emits structured debug logs only when the adapter logging toggle is enabled. */
async function logDebug(ctx, enabled, message, data) {
    if (!enabled) {
        return;
    }
    await ctx.onLog("stdout", `[${ADAPTER_TYPE}:debug] ${message}\n${JSON.stringify(data, null, 2)}\n`);
}
//# sourceMappingURL=execute.js.map