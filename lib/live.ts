import { EventEmitter } from "events";

export type LiveEvent = {
  topic: string;
  filmId?: number;
  at: number;
};

const liveEmitter = new EventEmitter();
liveEmitter.setMaxListeners(200);

export function publishLiveEvent(event: Omit<LiveEvent, "at">) {
  liveEmitter.emit("event", { ...event, at: Date.now() } satisfies LiveEvent);
}

export function subscribeLiveEvents(listener: (event: LiveEvent) => void) {
  liveEmitter.on("event", listener);
  return () => liveEmitter.off("event", listener);
}
