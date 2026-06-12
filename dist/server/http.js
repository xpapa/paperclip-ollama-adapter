import { Agent } from "undici";
export function buildOllamaFetchInit(timeoutMs, init) {
    return {
        ...init,
        dispatcher: new Agent({
            headersTimeout: timeoutMs,
            bodyTimeout: timeoutMs
        })
    };
}
//# sourceMappingURL=http.js.map