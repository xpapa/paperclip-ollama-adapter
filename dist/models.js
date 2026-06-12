/** Safe fallback list used when live Ollama model discovery is unavailable. */
export const fallbackModels = [
    { id: "llama3.2", label: "Llama 3.2" },
    { id: "qwen2.5-coder", label: "Qwen 2.5 Coder" },
    { id: "deepseek-r1", label: "DeepSeek R1" }
];
/** Converts Ollama model ids into Paperclip dropdown options. */
export function toAdapterModels(modelIds) {
    return modelIds.map((id) => ({ id, label: id }));
}
//# sourceMappingURL=models.js.map