export interface StudioEventMap {
  "speech:context": { transcript: string; at: number };
  "intent:updated": { transcript: string; at: number };
  "gesture:confirm": { at: number };
  "overlay:spawned": { conceptId: string; layerId: string; at: number };
  "overlay:hidden": { layerId: string | null; at: number };
}

type Listener<T> = (payload: T) => void;

/** A tiny asynchronous event lane. Publishers never await consumers and one
 * failed listener cannot block camera, gesture, rendering, or recording work. */
export class StudioEventBus {
  private listeners = new Map<keyof StudioEventMap, Set<Listener<never>>>();

  on<K extends keyof StudioEventMap>(type: K, listener: Listener<StudioEventMap[K]>) {
    const group = this.listeners.get(type) ?? new Set();
    group.add(listener as Listener<never>);
    this.listeners.set(type, group);
    return () => {
      group.delete(listener as Listener<never>);
    };
  }

  emit<K extends keyof StudioEventMap>(type: K, payload: StudioEventMap[K]) {
    const listeners = [...(this.listeners.get(type) ?? [])];
    queueMicrotask(() => listeners.forEach((listener) => {
      try { listener(payload as never); } catch (error) { console.error(`Studio event ${String(type)} failed`, error); }
    }));
  }
}
