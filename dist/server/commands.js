import { ensureAbsoluteDirectory, runChildProcess } from "@paperclipai/adapter-utils/server-utils";
import path from "node:path";
/**
 * Executes a model-requested command as a direct child process.
 *
 * The preferred path is direct execution: one executable in `command` and its
 * arguments in `args`. For trusted local agents, the adapter also detects
 * shell-only syntax that models sometimes put in `command` and runs that
 * string through `sh -lc` so redirects, pipes, and conditionals work.
 */
export async function runTrustedCommand(input, options) {
    const invocation = normalizeCommandInvocation(input);
    const command = invocation.command;
    if (!command) {
        throw new Error("run_command requires a non-empty command");
    }
    const args = invocation.args;
    const cwd = resolveRunCommandCwd(input.cwd, options.defaultCwd);
    const env = mergeCommandEnv(readProcessEnv(), options.env);
    await ensureAbsoluteDirectory(cwd);
    await options.onLog("stdout", `[ollama:tool] run_command ${formatCommand(command, args)}\n`);
    if (options.logging) {
        const paperclipEnv = readPaperclipEnv(env);
        await options.onLog("stdout", `[ollama:tool] PAPERCLIP_* env (${Object.keys(paperclipEnv).length}) ${JSON.stringify(paperclipEnv, null, 2)}\n`);
    }
    const result = await runChildProcess(options.runId, command, args, {
        cwd,
        env,
        timeoutSec: options.timeoutSec,
        graceSec: 5,
        onLog: options.onLog,
        ...(options.onSpawn ? { onSpawn: options.onSpawn } : {}),
        ...(input.stdin ? { stdin: input.stdin } : {})
    });
    return {
        command,
        args,
        cwd,
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stdout: result.stdout,
        stderr: result.stderr
    };
}
export function resolveRunCommandCwd(requestedCwd, defaultCwd) {
    const trimmed = requestedCwd?.trim();
    if (!trimmed) {
        return defaultCwd;
    }
    if (path.isAbsolute(trimmed)) {
        return trimmed;
    }
    if (trimmed === "paperclip" || trimmed.startsWith("paperclip/")) {
        return `/${trimmed}`;
    }
    return path.resolve(defaultCwd, trimmed);
}
/**
 * Validates and normalizes the raw JSON arguments emitted by Ollama tool calls.
 *
 * The adapter only understands native `message.tool_calls`; text/XML imitation
 * of tool calls is not parsed here.
 */
export function parseRunCommandInput(value) {
    if (typeof value !== "object" || value === null) {
        throw new Error("run_command arguments must be an object");
    }
    const record = value;
    if (typeof record.command !== "string") {
        throw new Error("run_command.command must be a string");
    }
    const invocation = normalizeCommandInvocation({
        command: record.command,
        ...(Array.isArray(record.args) ? { args: record.args } : {})
    });
    return {
        command: invocation.command,
        ...(invocation.args.length > 0 ? { args: invocation.args } : {}),
        ...(typeof record.cwd === "string" ? { cwd: record.cwd } : {}),
        ...(typeof record.stdin === "string" ? { stdin: record.stdin } : {})
    };
}
function normalizeCommandInvocation(input) {
    const command = input.command.trim();
    const args = normalizeArgs(input.args, command);
    if (isShellExecutable(command)) {
        return { command, args: normalizeExplicitShellArgs(args) };
    }
    if (!shouldRunViaShell(command, args)) {
        return { command, args };
    }
    return {
        command: "sh",
        args: ["-lc", buildShellCommand(command, args)]
    };
}
function shouldRunViaShell(command, args) {
    if (isShellExecutable(command)) {
        return false;
    }
    return containsShellSyntax(command) || args.some(containsShellSyntax);
}
function isShellExecutable(command) {
    return command === "sh" || command.endsWith("/sh")
        || command === "bash" || command.endsWith("/bash");
}
function containsShellSyntax(value) {
    return /\s/.test(value)
        || /(?:^|[^\w])(?:2?>|&>|>>|<|<<|\|\||&&|\||;|\$\(|`)/.test(value);
}
function buildShellCommand(command, args) {
    if (args.length === 0) {
        return command;
    }
    return [command, ...args.map(shellQuoteIfNeeded)].join(" ");
}
function normalizeExplicitShellArgs(args) {
    const shellFlag = args[0];
    const shellCommand = args[1];
    if (shellFlag !== "-lc" || shellCommand === undefined) {
        return args;
    }
    if (args.length === 2) {
        return args;
    }
    return [shellFlag, buildExpandableShellCommand(shellCommand, args.slice(2))];
}
function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
function buildExpandableShellCommand(command, args) {
    if (args.length === 0) {
        return command;
    }
    return [command, ...args.map(shellDoubleQuoteIfNeeded)].join(" ");
}
function shellQuoteIfNeeded(value) {
    if (!needsShellQuote(value)) {
        return value;
    }
    return shellQuote(value);
}
function shellDoubleQuoteIfNeeded(value) {
    if (!needsExpandableShellQuote(value)) {
        return value;
    }
    return shellDoubleQuote(value);
}
function needsShellQuote(value) {
    return value === "" || /\s/.test(value);
}
function needsExpandableShellQuote(value) {
    return needsShellQuote(value) || /(?:^|[^\\])\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[^}]+\})/.test(value);
}
function shellDoubleQuote(value) {
    return `"${value
        .replaceAll("\\", "\\\\")
        .replaceAll("\"", "\\\"")
        .replaceAll("`", "\\`")}"`;
}
function normalizeArgs(value, command) {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error("run_command.args must be an array of strings");
    }
    return value.map((arg, index) => {
        if (typeof arg !== "string") {
            throw new Error("run_command.args must be an array of strings");
        }
        return normalizeArgArtifact(arg, index, command);
    });
}
/**
 * Cleans small argument artifacts produced by some Ollama-hosted tool callers.
 *
 * Example observed from Gemma-family models: `<|"|ls-R<|"|` for a first
 * argument to `ls`. In that specific first-argument case this becomes `-R`,
 * while normal arguments are only stripped of wrapper artifacts and quotes.
 */
function normalizeArgArtifact(arg, index, command) {
    const withoutArtifacts = arg
        .replaceAll("<|\"|", "")
        .replaceAll("<|'|", "")
        .replaceAll("<|", "")
        .replaceAll("|>", "")
        .trim();
    const cleaned = shouldPreserveArgQuotes(command, index)
        ? withoutArtifacts
        : withoutArtifacts.replaceAll("\"", "");
    if (index !== 0) {
        return cleaned;
    }
    const trimmedCommand = command.trim();
    if (!trimmedCommand || !cleaned.startsWith(trimmedCommand)) {
        return cleaned;
    }
    const remainder = cleaned.slice(trimmedCommand.length);
    if (remainder.startsWith("-")) {
        return remainder;
    }
    return cleaned;
}
function shouldPreserveArgQuotes(command, index) {
    return isShellExecutable(command.trim()) && index > 0;
}
function readProcessEnv() {
    return Object.fromEntries(Object.entries(process.env).filter((entry) => {
        return typeof entry[1] === "string";
    }));
}
export function readPaperclipEnv(env) {
    return Object.fromEntries(Object.entries(env)
        .filter(([key]) => key.startsWith("PAPERCLIP_"))
        .sort(([left], [right]) => left.localeCompare(right)));
}
export function mergeCommandEnv(baseEnv, overlayEnv) {
    return {
        ...baseEnv,
        ...(overlayEnv ?? {})
    };
}
function formatCommand(command, args) {
    return [command, ...args].join(" ");
}
//# sourceMappingURL=commands.js.map