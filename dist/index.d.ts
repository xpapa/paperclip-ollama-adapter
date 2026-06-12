import { ollamaAdapter } from "./server/index.js";
import type { ServerAdapterModule } from "@paperclipai/adapter-utils";
export declare const adapterType = "ollama_local";
export declare const models: import("@paperclipai/adapter-utils").AdapterModel[];
export declare const manifest: {
    id: string;
    name: string;
    description: string;
    adapters: {
        type: string;
        label: string;
        models: import("@paperclipai/adapter-utils").AdapterModel[];
    }[];
};
export { ollamaAdapter };
export declare function createServerAdapter(): ServerAdapterModule;
export default ollamaAdapter;
//# sourceMappingURL=index.d.ts.map