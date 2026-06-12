import type { OllamaChatRequestBody, OllamaChatMessage, OllamaInvocationRequest, OllamaInvocationResult } from "../types.js";
export declare const OLLAMA_CHAT_PATH = "/api/chat";
/**
 * Runs one Paperclip invocation against Ollama's `/api/chat` endpoint.
 *
 * When command execution is enabled, this method drives Ollama's native
 * `message.tool_calls` loop: send chat request, execute requested commands,
 * append tool results, and ask Ollama for the next assistant turn. Textual
 * tool-call formats are intentionally ignored because Paperclip can only act
 * safely on structured tool calls.
 */
export declare function invokeOllama(request: OllamaInvocationRequest): Promise<OllamaInvocationResult>;
/** Builds the exact JSON payload sent to Ollama. Exported for contract tests. */
export declare function buildOllamaChatRequestBody(request: OllamaInvocationRequest, messages?: OllamaChatMessage[]): OllamaChatRequestBody;
export declare function readOllamaResponsePayload(response: Response, streaming: boolean, onLog?: OllamaInvocationRequest["onLog"]): Promise<unknown>;
/** Discovers locally available Ollama model names via `/api/tags`. */
export declare function listOllamaModels(baseUrl: string): Promise<string[]>;
/** Joins a configured Ollama root URL and API path without duplicating slashes. */
export declare function buildOllamaApiUrl(baseUrl: string, path: string): string;
/** Parses the two common model-name fields returned by Ollama `/api/tags`. */
export declare function parseOllamaTagsResponse(payload: unknown): string[];
//# sourceMappingURL=ollama.d.ts.map