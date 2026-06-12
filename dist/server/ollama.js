import { parseRunCommandInput, runTrustedCommand } from "./commands.js";
import { buildOllamaFetchInit } from "./http.js";
import { initializeSession } from "./session.js";
export const OLLAMA_CHAT_PATH = "/api/chat";
const RUN_COMMAND_TOOL_NAME = "run_command";
/**
 * Runs one Paperclip invocation against Ollama's `/api/chat` endpoint.
 *
 * When command execution is enabled, this method drives Ollama's native
 * `message.tool_calls` loop: send chat request, execute requested commands,
 * append tool results, and ask Ollama for the next assistant turn. Textual
 * tool-call formats are intentionally ignored because Paperclip can only act
 * safely on structured tool calls.
 */
export async function invokeOllama(request) {
    const session = initializeSession(request.model, request.session);
    const chatUrl = buildOllamaApiUrl(request.baseUrl, OLLAMA_CHAT_PATH);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    const messages = buildInitialMessages(request);
    const rawResponses = [];
    const toolResults = [];
    let executedToolCalls = 0;
    const usage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
    };
    const generation = {
        outputTokens: 0,
        evalDurationNs: 0
    };
    try {
        const maxTurns = request.commandExecution?.enabled
            ? request.commandExecution.maxToolCalls + 1
            : 1;
        for (let turn = 0; turn < maxTurns; turn += 1) {
            const body = buildOllamaChatRequestBody(request, messages);
            await logOllama(request, "stdout", "Sending Ollama chat request", {
                endpoint: chatUrl,
                timeoutMs: request.timeoutMs,
                turn,
                requestBody: body,
                session: request.session
                    ? {
                        sessionId: request.session.sessionId,
                        model: request.session.model,
                        updatedAt: request.session.updatedAt
                    }
                    : null
            });
            const response = await fetch(chatUrl, buildOllamaFetchInit(request.timeoutMs, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body),
                signal: controller.signal
            }));
            const payload = await readOllamaResponsePayload(response, request.streaming ?? true, request.onLog);
            rawResponses.push(payload);
            await logOllama(request, response.ok ? "stdout" : "stderr", "Received Ollama chat response", {
                endpoint: chatUrl,
                status: response.status,
                ok: response.ok,
                turn,
                response: payload
            });
            if (!response.ok) {
                const message = readOllamaError(payload)
                    ?? `Ollama chat request failed with HTTP ${response.status}`;
                const failure = buildFailureResult({
                    request,
                    session,
                    error: message,
                    errorCode: "ollama_http_error",
                    raw: {
                        endpoint: chatUrl,
                        status: response.status,
                        response: payload,
                        responses: rawResponses,
                        toolResults
                    }
                });
                await logOllama(request, "stderr", "Ollama chat request failed", {
                    error: failure.error,
                    errorCode: failure.errorCode
                });
                return failure;
            }
            const record = readRecord(payload);
            addUsage(usage, readUsage(record));
            addGeneration(generation, readGeneration(record));
            const assistantMessage = readAssistantMessage(record);
            const toolCalls = assistantMessage.tool_calls ?? [];
            if (toolCalls.length === 0) {
                // Diagnose silently-failing models: text-based tool-call markup
                // without native tool_calls means the model never received (or
                // ignored) the tools parameter — surface it instead of ending
                // the run as a plain "plan-only" response.
                const finalContent = readString(readRecord(assistantMessage).content) ?? "";
                if (/<tool_call>|<invoke name=/.test(finalContent)) {
                    await logOllama(request, "stderr", "Model emitted text-based tool-call markup but no native tool_calls — check enableCommandExecution and model tool support", { turn });
                }
                const generationStats = finalizeGeneration(generation);
                const result = buildSuccessResult(request, session, payload, chatUrl, {
                    usage,
                    generation: generationStats,
                    raw: {
                        endpoint: chatUrl,
                        responses: rawResponses,
                        toolResults,
                        finalResponse: record,
                        generation: generationStats
                    }
                });
                await logGenerationSpeed(request, generationStats);
                await logOllama(request, "stdout", "Parsed Ollama chat result", {
                    model: result.model,
                    usage: result.usage,
                    generation: result.generation,
                    responseText: result.responseText ?? "",
                    sessionParams: result.session
                });
                return result;
            }
            if (!request.commandExecution?.enabled) {
                return buildFailureResult({
                    request,
                    session,
                    error: "Ollama requested tool calls, but command execution is disabled",
                    errorCode: "tool_calls_disabled",
                    raw: {
                        endpoint: chatUrl,
                        responses: rawResponses,
                        toolCalls
                    }
                });
            }
            if (executedToolCalls + toolCalls.length > request.commandExecution.maxToolCalls) {
                const failure = buildFailureResult({
                    request,
                    session,
                    error: `Exceeded maxToolCalls (${request.commandExecution.maxToolCalls})`,
                    errorCode: "max_tool_calls_exceeded",
                    raw: {
                        endpoint: chatUrl,
                        responses: rawResponses,
                        toolResults,
                        requestedToolCalls: toolCalls
                    }
                });
                await logOllama(request, "stderr", "Ollama tool loop stopped", {
                    error: failure.error,
                    errorCode: failure.errorCode
                });
                return failure;
            }
            messages.push(assistantMessage);
            for (const toolCall of toolCalls) {
                const toolResult = await executeToolCall(request, toolCall);
                executedToolCalls += 1;
                toolResults.push(toolResult);
                messages.push({
                    role: "tool",
                    tool_name: RUN_COMMAND_TOOL_NAME,
                    content: JSON.stringify(toolResult)
                });
            }
        }
        const failure = buildFailureResult({
            request,
            session,
            error: `Exceeded maxToolCalls (${request.commandExecution?.maxToolCalls ?? 0})`,
            errorCode: "max_tool_calls_exceeded",
            raw: {
                endpoint: chatUrl,
                responses: rawResponses,
                toolResults
            }
        });
        await logOllama(request, "stderr", "Ollama tool loop stopped", {
            error: failure.error,
            errorCode: failure.errorCode
        });
        return failure;
    }
    catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            const failure = buildFailureResult({
                request,
                session,
                error: `Ollama chat request timed out after ${request.timeoutMs}ms`,
                errorCode: "timeout",
                timedOut: true,
                raw: {
                    endpoint: chatUrl,
                    timeoutMs: request.timeoutMs
                }
            });
            await logOllama(request, "stderr", "Ollama chat request timed out", {
                error: failure.error,
                errorCode: failure.errorCode
            });
            return failure;
        }
        const failure = buildFailureResult({
            request,
            session,
            error: err instanceof Error ? err.message : String(err),
            errorCode: "ollama_request_failed",
            raw: {
                endpoint: chatUrl
            }
        });
        await logOllama(request, "stderr", "Ollama chat request threw", {
            error: failure.error,
            errorCode: failure.errorCode
        });
        return failure;
    }
    finally {
        clearTimeout(timeout);
    }
}
/** Builds the exact JSON payload sent to Ollama. Exported for contract tests. */
export function buildOllamaChatRequestBody(request, messages = buildInitialMessages(request)) {
    return {
        model: request.model,
        messages,
        stream: request.streaming ?? true,
        ...(request.think !== undefined ? { think: request.think } : {}),
        ...(request.commandExecution?.enabled ? { tools: [runCommandTool] } : {})
    };
}
/** Converts adapter instructions and rendered prompt into Ollama chat messages. */
function buildInitialMessages(request) {
    return [
        ...(request.instructions
            ? [{ role: "system", content: request.instructions }]
            : []),
        { role: "user", content: request.prompt }
    ];
}
/**
 * Native command tool exposed to Ollama-compatible models.
 *
 * The schema is deliberately compact. Some Ollama cloud/model combinations have
 * been sensitive to verbose tool descriptions, so detailed examples live in the
 * prompt while this schema keeps the machine contract concise.
 */
const runCommandTool = {
    type: "function",
    function: {
        name: RUN_COMMAND_TOOL_NAME,
        description: "Run a trusted local command. Prefer command plus args; use sh -lc for shell syntax.",
        parameters: {
            type: "object",
            required: ["command"],
            properties: {
                command: {
                    type: "string",
                    description: "Executable name or path, for example cat, ls, npm, node, git, sh, or ./scripts/test.sh."
                },
                args: {
                    type: "array",
                    description: "Arguments as separate strings. Example: command cat with args [file.md], or command ls with args [-R, path].",
                    items: { type: "string" }
                },
                cwd: {
                    type: "string",
                    description: "Optional absolute working directory. Defaults to adapter commandCwd."
                },
                stdin: {
                    type: "string",
                    description: "Optional stdin content to send to the process."
                }
            }
        }
    }
};
/** Reads JSON while surfacing provider responses that are not valid JSON. */
async function readJsonResponse(response) {
    const text = await response.text();
    if (text.trim() === "") {
        return null;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error("Ollama returned invalid JSON");
    }
}
export async function readOllamaResponsePayload(response, streaming, onLog) {
    if (!streaming) {
        return readJsonResponse(response);
    }
    const chunks = await readOllamaStreamChunks(response, onLog);
    return mergeOllamaStreamChunks(chunks);
}
async function readOllamaStreamChunks(response, onLog) {
    if (!response.body) {
        return readOllamaStreamLines(await response.text(), onLog);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const chunk = await parseOllamaStreamLine(line, onLog);
            if (chunk !== null) {
                chunks.push(chunk);
            }
        }
    }
    buffer += decoder.decode();
    const finalChunk = await parseOllamaStreamLine(buffer, onLog);
    if (finalChunk !== null) {
        chunks.push(finalChunk);
    }
    return chunks;
}
async function readOllamaStreamLines(text, onLog) {
    const chunks = [];
    for (const line of text.split(/\r?\n/)) {
        const chunk = await parseOllamaStreamLine(line, onLog);
        if (chunk !== null) {
            chunks.push(chunk);
        }
    }
    return chunks;
}
async function parseOllamaStreamLine(line, onLog) {
    const trimmed = line.trim();
    if (trimmed === "") {
        return null;
    }
    let chunk;
    try {
        chunk = JSON.parse(trimmed);
    }
    catch {
        throw new Error("Ollama returned invalid streamed JSON");
    }
    const content = readMessageContent(readRecord(chunk));
    if (content && onLog) {
        await onLog("stdout", content);
    }
    return chunk;
}
function mergeOllamaStreamChunks(chunks) {
    if (chunks.length === 0) {
        return null;
    }
    let finalRecord = {};
    let content = "";
    let toolCalls;
    for (const chunk of chunks) {
        const record = readRecord(chunk);
        finalRecord = {
            ...finalRecord,
            ...record
        };
        const message = readRecord(record.message);
        content += readString(message.content) ?? "";
        if (Array.isArray(message.tool_calls)) {
            // Accumulate across chunks instead of overwriting — streamed
            // tool calls may arrive spread over multiple chunks. Dedupe by
            // identity so repeated cumulative arrays don't double-execute.
            const merged = [...(toolCalls ?? []), ...message.tool_calls];
            const seen = new Set();
            toolCalls = merged.filter((call) => {
                const key = JSON.stringify(call);
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });
        }
    }
    return {
        ...finalRecord,
        message: {
            ...readRecord(finalRecord.message),
            content,
            ...(toolCalls ? { tool_calls: toolCalls } : {})
        }
    };
}
/** Maps a successful Ollama response into Paperclip's provider-neutral result. */
function buildSuccessResult(request, session, payload, endpoint, overrides) {
    const record = readRecord(payload);
    const responseText = readMessageContent(record);
    const usage = overrides?.usage ?? readUsage(record);
    const generation = overrides?.generation ?? finalizeGeneration(readGeneration(record));
    const updatedSession = {
        ...session,
        model: request.model,
        updatedAt: new Date().toISOString(),
        metadata: {
            endpoint,
            lastCreatedAt: readString(record.created_at) ?? null,
            doneReason: readString(record.done_reason) ?? null
        }
    };
    return {
        success: true,
        timedOut: false,
        summary: summarizeResponse(responseText),
        model: readString(record.model) ?? request.model,
        responseText,
        usage,
        generation,
        costUsd: 0,
        session: updatedSession,
        raw: overrides?.raw ?? readRecord(payload)
    };
}
/** Creates a failed invocation result while preserving raw provider context. */
function buildFailureResult(args) {
    return {
        success: false,
        timedOut: args.timedOut ?? false,
        summary: null,
        model: args.request.model,
        error: args.error,
        errorCode: args.errorCode,
        usage: {
            inputTokens: 0,
            outputTokens: 0
        },
        generation: {
            outputTokens: 0,
            evalDurationMs: null,
            tokensPerSecond: null
        },
        costUsd: 0,
        session: {
            ...args.session,
            updatedAt: new Date().toISOString()
        },
        raw: args.raw
    };
}
function readOllamaError(payload) {
    const record = readRecord(payload);
    return readString(record.error);
}
function readMessageContent(record) {
    const message = record.message;
    if (typeof message !== "object" || message === null) {
        return "";
    }
    return readString(message.content) ?? "";
}
function readUsage(record) {
    const inputTokens = readNumber(record.prompt_eval_count) ?? 0;
    const outputTokens = readNumber(record.eval_count) ?? 0;
    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
    };
}
function readGeneration(record) {
    return {
        outputTokens: readNumber(record.eval_count) ?? 0,
        evalDurationNs: readNumber(record.eval_duration) ?? 0
    };
}
function addUsage(total, next) {
    total.inputTokens += next.inputTokens;
    total.outputTokens += next.outputTokens;
    total.totalTokens += next.totalTokens ?? next.inputTokens + next.outputTokens;
}
function addGeneration(total, next) {
    total.outputTokens += next.outputTokens;
    total.evalDurationNs += next.evalDurationNs;
}
function finalizeGeneration(generation) {
    if (generation.evalDurationNs <= 0) {
        return {
            outputTokens: generation.outputTokens,
            evalDurationMs: null,
            tokensPerSecond: null
        };
    }
    const evalDurationMs = generation.evalDurationNs / 1_000_000;
    const tokensPerSecond = generation.outputTokens / (generation.evalDurationNs / 1_000_000_000);
    return {
        outputTokens: generation.outputTokens,
        evalDurationMs: roundMetric(evalDurationMs),
        tokensPerSecond: roundMetric(tokensPerSecond)
    };
}
function readAssistantMessage(record) {
    const message = readRecord(record.message);
    const content = readString(message.content) ?? "";
    return {
        role: "assistant",
        content,
        ...(Array.isArray(message.tool_calls) ? { tool_calls: message.tool_calls } : {})
    };
}
async function logGenerationSpeed(request, generation) {
    if (!request.onLog || generation.tokensPerSecond === null || generation.evalDurationMs === null) {
        return;
    }
    const seconds = generation.evalDurationMs / 1000;
    await request.onLog("stdout", `[ollama] generation_speed ${generation.outputTokens} output tokens in ${seconds.toFixed(2)}s = ${generation.tokensPerSecond.toFixed(2)} tokens/s\n`);
}
/** Executes one supported native tool call and returns the result as JSON data. */
async function executeToolCall(request, toolCall) {
    const name = toolCall.function?.name;
    if (name !== RUN_COMMAND_TOOL_NAME) {
        throw new Error(`Unsupported tool call: ${name ?? "unknown"}`);
    }
    if (!request.commandExecution || !request.runId || !request.onLog) {
        throw new Error("Command execution requires runId, onLog, and commandExecution options");
    }
    const input = parseRunCommandInput(toolCall.function?.arguments);
    await logOllama(request, "stdout", "Executing tool call", {
        name,
        arguments: input
    });
    const result = await runTrustedCommand(input, {
        runId: request.runId,
        defaultCwd: request.commandExecution.cwd,
        timeoutSec: request.commandExecution.timeoutSec,
        onLog: request.onLog,
        ...(request.logging !== undefined ? { logging: request.logging } : {}),
        ...(request.toolEnv ? { env: request.toolEnv } : {}),
        ...(request.onSpawn ? { onSpawn: request.onSpawn } : {})
    });
    await logOllama(request, "stdout", "Tool call completed", {
        command: result.command,
        args: result.args,
        cwd: result.cwd,
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut
    });
    return result;
}
function summarizeResponse(responseText) {
    const trimmed = responseText.trim();
    if (trimmed.length <= 240) {
        return trimmed;
    }
    return `${trimmed.slice(0, 237)}...`;
}
function readRecord(value) {
    return typeof value === "object" && value !== null
        ? value
        : {};
}
function readString(value) {
    return typeof value === "string" ? value : null;
}
function readNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function roundMetric(value) {
    return Math.round(value * 100) / 100;
}
async function logOllama(request, stream, message, data) {
    if (!request.logging || !request.onLog) {
        return;
    }
    await request.onLog(stream, `[ollama:debug] ${message}\n${JSON.stringify(data, null, 2)}\n`);
}
/** Discovers locally available Ollama model names via `/api/tags`. */
export async function listOllamaModels(baseUrl) {
    const tagsUrl = buildOllamaApiUrl(baseUrl, "/api/tags");
    const response = await fetch(tagsUrl, { method: "GET" });
    if (!response.ok) {
        throw new Error(`Ollama model discovery failed with HTTP ${response.status}`);
    }
    const payload = await response.json();
    return parseOllamaTagsResponse(payload);
}
/** Joins a configured Ollama root URL and API path without duplicating slashes. */
export function buildOllamaApiUrl(baseUrl, path) {
    const prefix = baseUrl.replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${prefix}${suffix}`;
}
/** Parses the two common model-name fields returned by Ollama `/api/tags`. */
export function parseOllamaTagsResponse(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new Error("Ollama /api/tags response must be an object");
    }
    const models = payload.models;
    if (!Array.isArray(models)) {
        throw new Error("Ollama /api/tags response is missing a models array");
    }
    return models
        .map((model) => {
        if (typeof model !== "object" || model === null) {
            return null;
        }
        const record = model;
        if (typeof record.name === "string" && record.name.trim() !== "") {
            return record.name;
        }
        if (typeof record.model === "string" && record.model.trim() !== "") {
            return record.model;
        }
        return null;
    })
        .filter((name) => name !== null);
}
//# sourceMappingURL=ollama.js.map