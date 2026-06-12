export function formatRunEvent(event) {
    // TODO: Add Ollama-specific terminal formatting for `paperclipai run --watch`.
    const text = event.message ?? event.chunk ?? JSON.stringify(event);
    return event.stream === "stderr" ? `[ollama:error] ${text}` : `[ollama] ${text}`;
}
//# sourceMappingURL=format-event.js.map