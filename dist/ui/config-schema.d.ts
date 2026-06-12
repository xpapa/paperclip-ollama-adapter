import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
/**
 * Custom adapter UI fields.
 *
 * Paperclip owns built-in controls such as model and timeout. This adapter
 * intentionally defines its own thinking selector so users can choose `Off`,
 * which the current Paperclip built-in control does not expose.
 */
export declare const ollamaConfigSchema: AdapterConfigSchema;
/** Exposes the UI schema through the server adapter module. */
export declare function getConfigSchema(): AdapterConfigSchema;
//# sourceMappingURL=config-schema.d.ts.map