import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";
import type { OllamaSessionParams } from "../types.js";
export declare const sessionCodec: AdapterSessionCodec;
/**
 * Decodes persisted Paperclip session params.
 *
 * Ollama `/api/chat` is stateless here, so the session only tracks adapter-side
 * identifiers and provider metadata useful for logs and continuation debugging.
 */
export declare function parseSession(raw: unknown): OllamaSessionParams | null;
/** Creates the first adapter-side session marker for a model. */
export declare function createPlaceholderSession(model: string): OllamaSessionParams;
/**
 * Reuses a persisted session only while it matches the current model.
 *
 * Ollama itself is stateless in this adapter, so the session id is only an
 * adapter-side continuity marker. If the configured model changes, rotate the
 * session immediately so Paperclip does not keep showing stale model/session
 * information from a previous configuration.
 */
export declare function initializeSession(model: string, session: OllamaSessionParams | null): OllamaSessionParams;
//# sourceMappingURL=session.d.ts.map