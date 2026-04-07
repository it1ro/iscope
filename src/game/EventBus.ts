import { GameEvent } from '../types';

type Listener<T extends GameEvent> = (event: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener<any>>>();

  on<T extends GameEvent>(type: T['type'], cb: Listener<T>): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  emit<T extends GameEvent>(event: T): void {
    const cbs = this.listeners.get(event.type);
    if (cbs) cbs.forEach(cb => cb(event));
  }

  off<T extends GameEvent>(type: T['type'], cb: Listener<T>): void {
    const cbs = this.listeners.get(type);
    if (cbs) cbs.delete(cb);
  }

  dispose(): void {
    this.listeners.clear();
  }
}
