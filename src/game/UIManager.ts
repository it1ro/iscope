import { GameEvent } from '../types';
import { EventBus } from './EventBus';

export class UIManager {
  private scoreEl = document.getElementById('score')!;
  private distEl = document.getElementById('distance')!;
  constructor(eventBus: EventBus) {
    let score = 0;
    eventBus.on('bullet_hit', ({ distance }) => {
      score++;
      this.scoreEl.textContent = String(score);
      this.distEl.textContent = `${distance.toFixed(1)} м`;
    });
  }
}
