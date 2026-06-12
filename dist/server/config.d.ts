import { type OllamaAdapterConfig } from "../types.js";
export interface ConfigParseResult {
    config: OllamaAdapterConfig | null;
    errors: string[];
}
/**
 * Normalizes Paperclip configuration into the adapter's runtime shape.
 *
 * Paperclip can provide values either as top-level built-ins (`model`,
 * `timeoutSec`, `thinkingEffort`) or under `adapterSchemaValues` for custom UI
 * fields. This parser intentionally accepts both locations so the adapter stays
 * compatible across Paperclip UI/runtime versions.
 */
export declare function parseConfig(raw: Record<string, unknown>): ConfigParseResult;
//# sourceMappingURL=config.d.ts.map