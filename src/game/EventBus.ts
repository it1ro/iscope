import { GameEvent } from '../types';

type Listener = (event: GameEvent) => void;

export class EventBus {
  private listeners: Map<string, Listener[]> = new Map();

  on(type: string, cb: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(cb);
  }

  emit(event: GameEvent): void {
    const cbs = this.listeners.get(event.type) || [];
    for (const cb of cbs) cb(event);
  }

  off(type: string, cb: Listener): void {
    const arr = this.listeners.get(type);
    if (arr) this.listeners.set(type, arr.filter(l => l !== cb));
  }

  dispose(): void { this.listeners.clear(); }
}
