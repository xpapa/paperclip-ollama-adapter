import { DEFAULT_BASE_URL } from "../types.js";
import { listOllamaModels } from "./ollama.js";
export const fallbackModels = [
    { id: "llama3.2", label: "Llama 3.2" },
    { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
    { id: "deepseek-r1", label: "DeepSeek R1" }
];
export async function listAdapterModels(baseUrl = DEFAULT_BASE_URL) {
    try {
        const discovered = await listOllamaModels(baseUrl);
        if (discovered.length === 0) {
            return fallbackModels;
        }
        return discovered.map((model) => ({ id: model, label: model }));
    }
    catch {
        return fallbackModels;
    }
}
//# sourceMappingURL=models.js.map