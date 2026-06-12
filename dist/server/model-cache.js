import { toAdapterModels } from "../models.js";
let cachedModels = null;
/** Stores the most recent successful `/api/tags` result for this adapter process. */
export function cacheDiscoveredModels(baseUrl, modelIds) {
    if (modelIds.length === 0) {
        return null;
    }
    cachedModels = {
        baseUrl,
        models: toAdapterModels(modelIds),
        discoveredAt: new Date().toISOString()
    };
    return cachedModels;
}
/** Returns the process-local model discovery cache populated by Test environment. */
export function getCachedModels() {
    return cachedModels;
}
/** Test helper for isolating process-local cache state. */
export function clearCachedModels() {
    cachedModels = null;
}
//# sourceMappingURL=model-cache.js.map