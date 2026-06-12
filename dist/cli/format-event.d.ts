export interface AdapterRunEvent {
    stream?: "stdout" | "stderr";
    message?: string;
    chunk?: string;
    [key: string]: unknown;
}
export declare function formatRunEvent(event: AdapterRunEvent): string;
//# sourceMappingURL=format-event.d.ts.map