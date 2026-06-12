import { type OllamaAdapterConfig, type OllamaSkillSelectionMode, type OllamaThinking } from "../types.js";
export type OllamaConfigFormValues = Partial<{
    model: string;
    baseUrl: string;
    timeoutSec: string | number;
    ollamaTimeoutSec: string | number;
    logging: boolean | "true" | "false";
    streaming: boolean | "true" | "false";
    enableCommandExecution: boolean | "true" | "false";
    commandCwd: string;
    commandTimeoutSec: string | number;
    maxToolCalls: string | number;
    think: "" | "true" | "false" | OllamaThinking;
    skillSelectionMode: "" | OllamaSkillSelectionMode;
    instructions: string;
    promptTemplate: string;
}>;
export declare function buildConfigFromFormValues(values: OllamaConfigFormValues): Partial<OllamaAdapterConfig>;
//# sourceMappingURL=build-config.d.ts.map