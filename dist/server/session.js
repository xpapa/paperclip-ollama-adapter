export const sessionCodec = {
    deserialize(raw) {
        const session = parseSession(raw);
        return session ? { ...session } : null;
    },
    serialize(params) {
        const session = parseSession(params);
        return session ? { ...session } : null;
    },
    getDisplayId(params) {
        const session = parseSession(params);
        return session?.sessionId ?? null;
    }
};
/**
 * Decodes persisted Paperclip session params.
 *
 * Ollama `/api/chat` is stateless here, so the session only tracks adapter-side
 * identifiers and provider metadata useful for logs and continuation debugging.
 */
export function parseSession(raw) {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const record = raw;
    if (typeof record.sessionId !== "string" ||
        typeof record.model !== "string" ||
        typeof record.createdAt !== "string" ||
        typeof record.updatedAt !== "string") {
        return null;
    }
    return {
        sessionId: record.sessionId,
        model: record.model,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata: readMetadata(record.metadata)
    };
}
/** Creates the first adapter-side session marker for a model. */
export function createPlaceholderSession(model) {
    const now = new Date().toISOString();
    return {
        sessionId: `ollama:${model}:${now}`,
        model,
        createdAt: now,
        updatedAt: now,
        metadata: {}
    };
}
/**
 * Reuses a persisted session only while it matches the current model.
 *
 * Ollama itself is stateless in this adapter, so the session id is only an
 * adapter-side continuity marker. If the configured model changes, rotate the
 * session immediately so Paperclip does not keep showing stale model/session
 * information from a previous configuration.
 */
export function initializeSession(model, session) {
    if (!session || session.model !== model) {
        return createPlaceholderSession(model);
    }
    return session;
}
function readMetadata(value) {
    if (typeof value !== "object" || value === null) {
        return {};
    }
    const record = value;
    return {
        ...(typeof record.endpoint === "string" ? { endpoint: record.endpoint } : {}),
        ...(typeof record.lastCreatedAt === "string" || record.lastCreatedAt === null
            ? { lastCreatedAt: record.lastCreatedAt }
            : {}),
        ...(typeof record.doneReason === "string" || record.doneReason === null
            ? { doneReason: record.doneReason }
            : {})
    };
}
//# sourceMappingURL=session.js.map