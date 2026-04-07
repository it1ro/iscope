// src/game/AudioManager.ts
import * as Tone from 'tone';
import { EventBus } from './EventBus';
import { GameEvent } from '../types';

export class AudioManager {
  private eventBus: EventBus;
  private players: Tone.Player[] = [];
  
  // Узлы эффектов
  private hpFilter: Tone.Filter;
  private volume: Tone.Volume;
  private distortion: Tone.Distortion;
  private eq: Tone.EQ3;
  private compressor: Tone.Compressor;
  private reverb: Tone.Reverb;
  private output: Tone.Gain;
  
  private isInitialized = false;
  
  private shootSounds: string[] = [
    '/assets/sfx/svd-main.mp3'
  ];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Создаём эффекты
    this.hpFilter = new Tone.Filter(40, 'highpass');   // обрезаем инфранизкие частоты
    
    this.volume = new Tone.Volume(-6);                  // общее снижение громкости
    
    this.distortion = new Tone.Distortion({
      distortion: 0.1,
      wet: 0.15                                        // лёгкое насыщение
    });
    
    this.eq = new Tone.EQ3({
      low: 4,                                          // усиление баса
      mid: 2,                                          // небольшая середина
      high: -1                                         // смягчение верхов
    });
    
    this.compressor = new Tone.Compressor({
      threshold: -12,
      ratio: 4,
      attack: 0.003,
      release: 0.25
    });
    
    this.reverb = new Tone.Reverb({
      decay: 0.8,
      wet: 0.2,
      preDelay: 0.01
    });
    
    this.output = new Tone.Gain(0.9);
    
    // Строим цепочку: Player -> HP Filter -> Volume -> Distortion -> EQ -> Compressor -> Reverb -> Output -> Destination
    this.hpFilter.connect(this.volume);
    this.volume.connect(this.distortion);
    this.distortion.connect(this.eq);
    this.eq.connect(this.compressor);
    this.compressor.connect(this.reverb);
    this.reverb.connect(this.output);
    this.output.toDestination();
    
    // Предзагрузка звуков
    this.loadSounds().then(() => {
      this.isInitialized = true;
      console.log('AudioManager: звуки загружены');
    }).catch(err => {
      console.error('Ошибка загрузки звуков:', err);
    });
    
    this.eventBus.on('shoot', this.handleShoot.bind(this));
  }

  private async loadSounds(): Promise<void> {
    const loadPromises = this.shootSounds.map(async (url) => {
      const player = new Tone.Player({
        url,
        autostart: false,
        fadeIn: 0.005,
        fadeOut: 0.1
      });
      
      // Подключаем плеер к началу цепочки (hpFilter)
      player.connect(this.hpFilter);
      
      await player.load(url);
      this.players.push(player);
    });
    
    await Promise.all(loadPromises);
  }

  private handleShoot(event: Extract<GameEvent, { type: 'shoot' }>): void {
    if (!this.isInitialized || this.players.length === 0) {
      console.warn('Звуки ещё не загружены');
      return;
    }
    
    // Убедимся, что аудиоконтекст запущен
    if (Tone.context.state !== 'running') {
      Tone.start().then(() => this.playRandomSound());
    } else {
      this.playRandomSound();
    }
  }

  private playRandomSound(): void {
    const randomIndex = Math.floor(Math.random() * this.players.length);
    const player = this.players[randomIndex];
    
    // Вариация питча и громкости для естественности
    const pitchVariation = 0.95 + Math.random() * 0.1; // 0.95 .. 1.05
    const volumeVariation = 0.9 + Math.random() * 0.2;  // 0.9 .. 1.1
    
    player.playbackRate = pitchVariation;
    player.volume.value = volumeVariation;
    
    // Автоматизация реверберации: быстрый рост wet, затем медленный спад
    this.reverb.wet.rampTo(0.35, 0.05);
    this.reverb.wet.rampTo(0.2, 0.8);
    
    // Запускаем воспроизведение
    player.start();
  }

  public dispose(): void {
    // Останавливаем и освобождаем плееры
    this.players.forEach(p => {
      p.stop();
      p.dispose();
    });
    this.players = [];
    
    // Освобождаем эффекты
    this.hpFilter.dispose();
    this.volume.dispose();
    this.distortion.dispose();
    this.eq.dispose();
    this.compressor.dispose();
    this.reverb.dispose();
    this.output.dispose();
    
    if (typeof (this.eventBus as any).off === 'function') {
      (this.eventBus as any).off('shoot', this.handleShoot);
    }
  }
}
