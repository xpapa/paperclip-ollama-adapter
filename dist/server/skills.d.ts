import type { AdapterSkillContext, AdapterSkillSnapshot } from "@paperclipai/adapter-utils";
import { type OllamaAdapterConfig, type OllamaLogFn, type OllamaSkill } from "../types.js";
type ParsedSkillMarkdown = Pick<OllamaSkill, "name" | "description"> & {
    body: string;
};
export interface ManagedSkillLoadResult {
    skills: OllamaSkill[];
    warnings: string[];
}
export interface SkillClassifierOptions {
    config: OllamaAdapterConfig;
    onLog?: OllamaLogFn;
}
export declare function listOllamaSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot>;
export declare function syncOllamaSkills(ctx: AdapterSkillContext, desiredSkills: string[]): Promise<AdapterSkillSnapshot>;
export declare function resolveOllamaDesiredSkillNames(config: Record<string, unknown>, availableEntries: Array<{
    key: string;
    required?: boolean;
}>): string[];
export declare function loadManagedSkills(config: Record<string, unknown>, wakeContext: unknown, classifierOptions?: SkillClassifierOptions): Promise<ManagedSkillLoadResult>;
export declare function parseSkillMarkdown(content: string): ParsedSkillMarkdown;
export {};
//# sourceMappingURL=skills.d.ts.map