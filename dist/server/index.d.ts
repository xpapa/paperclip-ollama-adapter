import type { ServerAdapterModule } from "@paperclipai/adapter-utils";
/**
 * Static server adapter definition consumed by Paperclip.
 *
 * Paperclip's current `listModels` hook does not receive adapter config, so it
 * cannot read the UI's `baseUrl` field directly. The environment test can use
 * that configured URL, so it stores successful `/api/tags` results in a
 * process-local cache. The dropdown uses that cache first, then tries live
 * discovery against `OLLAMA_BASE_URL` or the local default, then falls back to a
 * safe static list if discovery is unavailable.
 */
export declare const ollamaAdapter: ServerAdapterModule;
/** Required package-level export used by Paperclip when installing adapters. */
export declare function createServerAdapter(): ServerAdapterModule;
export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { sessionCodec } from "./session.js";
export { listOllamaSkills, syncOllamaSkills, resolveOllamaDesiredSkillNames } from "./skills.js";
//# sourceMappingURL=index.d.ts.map