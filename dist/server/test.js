import { ADAPTER_TYPE } from "../types.js";
import { parseConfig } from "./config.js";
import { cacheDiscoveredModels } from "./model-cache.js";
import { listOllamaModels } from "./ollama.js";
export async function testEnvironment(ctx) {
    const checks = [];
    const { config, errors } = parseConfig(ctx.config);
    for (const error of errors) {
        checks.push({
            code: "config_invalid",
            level: "error",
            message: error
        });
    }
    if (config) {
        checks.push({
            code: "base_url_configured",
            level: "info",
            message: `Ollama base URL configured: ${config.baseUrl}`
        });
        try {
            const models = await listOllamaModels(config.baseUrl);
            cacheDiscoveredModels(config.baseUrl, models);
            checks.push({
                code: "models_discovered",
                level: models.length > 0 ? "info" : "warn",
                message: models.length > 0
                    ? `Discovered ${models.length} Ollama model(s) from ${config.baseUrl}/api/tags`
                    : `No Ollama models returned from ${config.baseUrl}/api/tags`,
                hint: models.length > 0 ? null : "Run `ollama pull <model>` or verify Ollama has installed models"
            });
        }
        catch (err) {
            checks.push({
                code: "model_discovery_failed",
                level: "error",
                message: `Could not discover Ollama models from ${config.baseUrl}/api/tags`,
                detail: err instanceof Error ? err.message : String(err),
                hint: "Verify Ollama is running and baseUrl points to the Ollama server root"
            });
        }
    }
    return {
        adapterType: ADAPTER_TYPE,
        status: checks.some((check) => check.level === "error") ? "fail" : "pass",
        checks,
        testedAt: new Date().toISOString()
    };
}
//# sourceMappingURL=test.js.map