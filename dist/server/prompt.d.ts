import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import type { OllamaAdapterConfig, OllamaSkill } from "../types.js";
/**
 * Renders the Paperclip wake context into the prompt sent to Ollama.
 *
 * The template helper comes from Paperclip adapter utils so custom prompt
 * templates use the same placeholder behavior as other external adapters.
 */
export declare function buildPrompt(ctx: AdapterExecutionContext, config: OllamaAdapterConfig, skills?: OllamaSkill[]): string;
//# sourceMappingURL=prompt.d.ts.map