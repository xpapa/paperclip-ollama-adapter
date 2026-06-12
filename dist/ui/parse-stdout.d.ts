export interface TranscriptEntry {
    stream: "stdout" | "stderr";
    text: string;
    timestamp?: string;
    meta?: Record<string, unknown>;
}
export declare function parseStdoutForTranscript(stdout: string): TranscriptEntry[];
//# sourceMappingURL=parse-stdout.d.ts.map