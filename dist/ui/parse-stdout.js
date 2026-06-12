export function parseStdoutForTranscript(stdout) {
    // TODO: Parse structured Ollama/Paperclip log lines into richer transcript
    // entries once the execution layer emits stable JSON log events.
    return stdout
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => ({
        stream: "stdout",
        text: line
    }));
}
//# sourceMappingURL=parse-stdout.js.map