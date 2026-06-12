import { DEFAULT_OLLAMA_TIMEOUT_SEC, DEFAULT_TIMEOUT_SEC, OLLAMA_SKILL_SELECTION_MODES, OLLAMA_THINK_LEVELS } from "../types.js";
import { readDefaultBaseUrl } from "../base-url.js";
export function buildConfigFromFormValues(values) {
    // TODO: Replace with Paperclip UI field definitions when external adapter UI
    // extension points are finalized.
    const config = {
        model: values.model?.trim() ?? "",
        baseUrl: values.baseUrl?.trim() || readDefaultBaseUrl(),
        timeoutSec: Number(values.timeoutSec ?? DEFAULT_TIMEOUT_SEC),
        ollamaTimeoutSec: Number(values.ollamaTimeoutSec ?? DEFAULT_OLLAMA_TIMEOUT_SEC)
    };
    if (values.logging !== undefined) {
        config.logging = normalizeBooleanFormValue(values.logging);
    }
    if (values.streaming !== undefined) {
        config.streaming = normalizeBooleanFormValue(values.streaming);
    }
    if (values.enableCommandExecution !== undefined) {
        config.enableCommandExecution = normalizeBooleanFormValue(values.enableCommandExecution);
    }
    if (values.commandCwd) {
        config.commandCwd = values.commandCwd;
    }
    if (values.commandTimeoutSec !== undefined) {
        config.commandTimeoutSec = Number(values.commandTimeoutSec);
    }
    if (values.maxToolCalls !== undefined) {
        config.maxToolCalls = Number(values.maxToolCalls);
    }
    if (values.think !== undefined && values.think !== "") {
        config.think = normalizeThinkFormValue(values.think);
    }
    if (values.skillSelectionMode !== undefined && values.skillSelectionMode !== "") {
        config.skillSelectionMode = normalizeSkillSelectionModeFormValue(values.skillSelectionMode);
    }
    if (values.instructions) {
        config.instructions = values.instructions;
    }
    if (values.promptTemplate) {
        config.promptTemplate = values.promptTemplate;
    }
    return config;
}
function normalizeSkillSelectionModeFormValue(value) {
    if (typeof value === "string" && OLLAMA_SKILL_SELECTION_MODES.includes(value)) {
        return value;
    }
    return "deterministic";
}
function normalizeThinkFormValue(value) {
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    if (typeof value === "string" && OLLAMA_THINK_LEVELS.includes(value)) {
        return value;
    }
    return value;
}
function normalizeBooleanFormValue(value) {
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    return value;
}
//# sourceMappingURL=build-config.js.map