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

  // Фоновый звук природы
  private backgroundAudio: HTMLAudioElement;
  private backgroundVolume = 1;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Создаём эффекты
    this.hpFilter = new Tone.Filter(40, 'highpass');
    
    this.volume = new Tone.Volume(-6);
    
    this.distortion = new Tone.Distortion({
      distortion: 0.1,
      wet: 0.15
    });
    
    this.eq = new Tone.EQ3({
      low: 4,
      mid: 2,
      high: -1
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
    
    // Строим цепочку
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

    // Настройка фонового звука природы (MP3)
    this.backgroundAudio = new Audio('/assets/sfx/nature.mp3');
    this.backgroundAudio.loop = true;
    this.backgroundAudio.volume = this.backgroundVolume;

    // Отладка загрузки фона
    this.backgroundAudio.addEventListener('canplaythrough', () => {
      console.log('✅ Фоновый звук (MP3) загружен и готов');
    });
    this.backgroundAudio.addEventListener('error', (e) => {
      console.error('❌ Ошибка загрузки фонового звука:', e);
    });
  }

  private async loadSounds(): Promise<void> {
    const loadPromises = this.shootSounds.map(async (url) => {
      const player = new Tone.Player({
        url,
        autostart: false,
        fadeIn: 0.005,
        fadeOut: 0.1
      });
      
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
    
    if (Tone.context.state !== 'running') {
      Tone.start().then(() => this.playRandomSound());
    } else {
      this.playRandomSound();
    }
  }

  private playRandomSound(): void {
    const randomIndex = Math.floor(Math.random() * this.players.length);
    const player = this.players[randomIndex];
    
    const pitchVariation = 0.95 + Math.random() * 0.1;
    const volumeVariation = 0.9 + Math.random() * 0.2;
    
    player.playbackRate = pitchVariation;
    player.volume.value = volumeVariation;
    
    this.reverb.wet.rampTo(0.35, 0.05);
    this.reverb.wet.rampTo(0.2, 0.8);
    
    player.start();
  }

  /**
   * Запускает фоновый звук природы (вызывается после жеста пользователя)
   */
  public startBackground(): void {
    console.log('🎵 startBackground вызван, paused =', this.backgroundAudio.paused);
    if (this.backgroundAudio.paused) {
      this.backgroundAudio.play()
        .then(() => console.log('▶️ Фоновый звук играет'))
        .catch(err => console.warn('⚠️ Не удалось запустить фон:', err));
    } else {
      console.log('🔄 Фоновый звук уже играет');
    }
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

    // Останавливаем и очищаем фоновый звук
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.src = '';
      this.backgroundAudio = null!;
    }
  }
}
