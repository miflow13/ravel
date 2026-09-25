import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TraceEventSchema, type TraceEvent, type TraceEventInput } from "./event-schema.js";

export class TraceRecorder {
  private sequence = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async append(input: TraceEventInput): Promise<TraceEvent> {
    const event = TraceEventSchema.parse({
      ...input,
      eventId: `event-${String(++this.sequence).padStart(6, "0")}`,
      timestamp: new Date().toISOString()
    });

    const write = async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
    };
    this.queue = this.queue.then(write, write);
    await this.queue;
    return event;
  }
}
