import type { AdapterModel } from "@paperclipai/adapter-utils";
export interface CachedOllamaModels {
    baseUrl: string;
    models: AdapterModel[];
    discoveredAt: string;
}
/** Stores the most recent successful `/api/tags` result for this adapter process. */
export declare function cacheDiscoveredModels(baseUrl: string, modelIds: string[]): CachedOllamaModels | null;
/** Returns the process-local model discovery cache populated by Test environment. */
export declare function getCachedModels(): CachedOllamaModels | null;
/** Test helper for isolating process-local cache state. */
export declare function clearCachedModels(): void;
//# sourceMappingURL=model-cache.d.ts.map