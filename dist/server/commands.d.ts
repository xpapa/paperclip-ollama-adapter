import type { OllamaLogFn, OllamaSpawnFn } from "../types.js";
export interface RunCommandInput {
    command: string;
    args?: string[];
    cwd?: string;
    stdin?: string;
}
export interface RunCommandOptions {
    runId: string;
    defaultCwd: string;
    timeoutSec: number;
    onLog: OllamaLogFn;
    logging?: boolean;
    env?: Record<string, string>;
    onSpawn?: OllamaSpawnFn;
}
export interface RunCommandOutput {
    command: string;
    args: string[];
    cwd: string;
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    stdout: string;
    stderr: string;
}
/**
 * Executes a model-requested command as a direct child process.
 *
 * The preferred path is direct execution: one executable in `command` and its
 * arguments in `args`. For trusted local agents, the adapter also detects
 * shell-only syntax that models sometimes put in `command` and runs that
 * string through `sh -lc` so redirects, pipes, and conditionals work.
 */
export declare function runTrustedCommand(input: RunCommandInput, options: RunCommandOptions): Promise<RunCommandOutput>;
export declare function resolveRunCommandCwd(requestedCwd: string | undefined, defaultCwd: string): string;
/**
 * Validates and normalizes the raw JSON arguments emitted by Ollama tool calls.
 *
 * The adapter only understands native `message.tool_calls`; text/XML imitation
 * of tool calls is not parsed here.
 */
export declare function parseRunCommandInput(value: unknown): RunCommandInput;
export declare function readPaperclipEnv(env: Record<string, string>): Record<string, string>;
export declare function mergeCommandEnv(baseEnv: Record<string, string>, overlayEnv: Record<string, string> | undefined): Record<string, string>;
//# sourceMappingURL=commands.d.ts.map