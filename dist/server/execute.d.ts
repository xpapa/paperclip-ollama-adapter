import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
/**
 * Paperclip server entrypoint for a single adapter run.
 *
 * It validates config, renders the Paperclip prompt, calls Ollama, and maps the
 * provider result back into Paperclip's `AdapterExecutionResult` contract.
 */
export declare function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
/**
 * Picks the default command working directory for model-requested tools.
 *
 * Priority:
 * 1. Explicit adapter `commandCwd`
 * 2. Paperclip workspace cwd from wake context
 * 3. Adapter process cwd as final fallback
 */
export declare function resolveCommandCwd(ctx: AdapterExecutionContext, configuredCommandCwd?: string): string;
export declare function buildToolEnv(ctx: AdapterExecutionContext): Record<string, string>;
//# sourceMappingURL=execute.d.ts.map