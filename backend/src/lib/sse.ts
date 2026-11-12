import { EventEmitter } from "events";

// Global event bus for Server-Sent Events (SSE)
class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  broadcast(event: string, data: any) {
    this.emit("broadcast", { event, data, timestamp: new Date().toISOString() });
  }
}

const globalForSSE = globalThis as unknown as {
  sseManager?: SSEManager;
};

export const sseManager = globalForSSE.sseManager ?? new SSEManager();
if (process.env.NODE_ENV !== "production") globalForSSE.sseManager = sseManager;

