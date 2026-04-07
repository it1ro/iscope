// src/game/UIManager.ts
import { GameEvent } from '../types';
import { EventBus } from './EventBus';

export class UIManager {
  private scoreEl = document.getElementById('score')!;
  private distEl = document.getElementById('distance')!;
  private rangefinderEl: HTMLElement;
  private score = 0;

  constructor(eventBus: EventBus) {
    this.rangefinderEl = document.createElement('div');
    this.rangefinderEl.className = 'rangefinder';
    this.rangefinderEl.innerHTML = '🎯 --- м';
    document.body.appendChild(this.rangefinderEl);

    eventBus.on('bullet_hit', (e: Extract<GameEvent, { type: 'bullet_hit' }>) => {
      this.score++;
      this.scoreEl.textContent = String(this.score);
      this.distEl.textContent = `${e.distance.toFixed(1)} м`;
    });

    eventBus.on('reset_game', () => {
      this.score = 0;
      this.scoreEl.textContent = '0';
      this.distEl.textContent = '---';
    });
  }

  public updateRangefinder(distance: number | null): void {
    if (distance !== null) {
      this.rangefinderEl.innerHTML = `🎯 ${distance.toFixed(0)} м`;
    } else {
      this.rangefinderEl.innerHTML = `🎯 --- м`;
    }
  }
}
