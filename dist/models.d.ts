import type { AdapterModel } from "@paperclipai/adapter-utils";
/** Safe fallback list used when live Ollama model discovery is unavailable. */
export declare const fallbackModels: AdapterModel[];
/** Converts Ollama model ids into Paperclip dropdown options. */
export declare function toAdapterModels(modelIds: string[]): AdapterModel[];
//# sourceMappingURL=models.d.ts.map