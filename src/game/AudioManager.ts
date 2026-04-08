// src/game/AudioManager.ts (обновлённая версия)

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

  // Для звука попадания
  private hitBuffer: Tone.Buffer | null = null;
  private hitGain: Tone.Gain;
  private hitPlayers: Tone.Player[] = []; // пул активных плееров попаданий

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

    // Отдельный гейн для звуков попаданий (чтобы регулировать общую громкость)
    this.hitGain = new Tone.Gain(0.8).connect(this.hpFilter);
    
    // Предзагрузка звуков
    this.loadSounds().then(() => {
      this.isInitialized = true;
      console.log('AudioManager: звуки загружены');
    }).catch(err => {
      console.error('Ошибка загрузки звуков:', err);
    });
    
    this.eventBus.on('shoot', this.handleShoot.bind(this));
    this.eventBus.on('bullet_hit', this.handleBulletHit.bind(this));

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
    
    // Загружаем буфер звука попадания
    const hitLoadPromise = Tone.Buffer.load('/assets/sfx/hit-1.mp3').then(buffer => {
      this.hitBuffer = buffer;
    });
    
    await Promise.all([...loadPromises, hitLoadPromise]);
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

  private handleBulletHit(event: Extract<GameEvent, { type: 'bullet_hit' }>): void {
  if (!this.hitBuffer) {
    console.warn('Буфер звука попадания не загружен');
    return;
  }
  
  const distance = event.distance;
  
  // --- Улучшенная модель громкости с более крутым затуханием ---
  let volumeFactor: number;
  if (distance <= 200) {
    // Ближняя зона: более резкое падение к 200 м (1.0 → 0.5)
    volumeFactor = 1.0 - (distance / 200) * 0.5;
  } else {
    // Дальняя зона: усиленное геометрическое затухание и поглощение
    const refDist = 200;
    const absorptionCoeff = 0.003; // дБ/м (увеличено для большей крутизны)
    
    // Геометрическое затухание: показатель степени увеличен с 1.8 до 2.5
    const geoFalloff = Math.pow(refDist / distance, 2.5);
    // Атмосферное поглощение (в линейном масштабе)
    const airLoss = Math.pow(10, -absorptionCoeff * (distance - refDist) / 20);
    
    volumeFactor = 0.5 * geoFalloff * airLoss; // начальный уровень 0.5 вместо 0.7
  }
  
  // --- Уменьшение базовой громкости в 1.5 раза ---
  volumeFactor *= 2 / 3; // ≈ 0.6667
  
  // Ограничиваем минимальную громкость (оставляем тот же порог 0.08)
  volumeFactor = Math.max(0.08, volumeFactor);
  
  // --- Реалистичная модель высоты тона (питча) остаётся без изменений ---
  let pitchFactor: number;
  if (distance <= 200) {
    pitchFactor = 0.95 + Math.random() * 0.1;
  } else {
    const freqAttenuation = Math.exp(-0.0012 * (distance - 200));
    pitchFactor = Math.max(0.2, 0.9 * freqAttenuation);
  }
  
  // Естественная случайность
  pitchFactor *= 0.94 + Math.random() * 0.12;
  volumeFactor *= 0.92 + Math.random() * 0.16;
  
  // Создаём плеер
  const player = new Tone.Player(this.hitBuffer);
  player.connect(this.hitGain);
  
  player.volume.value = this.linearToDb(volumeFactor);
  player.playbackRate = pitchFactor;
  
  // Усиливаем реверб и компрессию на время звука попадания
  const originalWet = this.reverb.wet.value;
  const originalThreshold = this.compressor.threshold.value;
  const originalRatio = this.compressor.ratio.value;
  
  this.reverb.wet.rampTo(0.6, 0.01);
  this.compressor.threshold.rampTo(-24, 0.01);
  this.compressor.ratio.rampTo(8, 0.01);
  
  player.start();
  this.hitPlayers.push(player);
  
  player.onstop = () => {
    const index = this.hitPlayers.indexOf(player);
    if (index > -1) this.hitPlayers.splice(index, 1);
    player.dispose();
    // Возвращаем исходные настройки эффектов
    this.reverb.wet.rampTo(originalWet, 0.1);
    this.compressor.threshold.rampTo(originalThreshold, 0.1);
    this.compressor.ratio.rampTo(originalRatio, 0.1);
  };
}

  // Вспомогательная функция: линейная громкость -> децибелы
  private linearToDb(linear: number): number {
    return linear <= 0 ? -100 : 20 * Math.log10(linear);
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
    // Останавливаем и освобождаем плееры выстрелов
    this.players.forEach(p => {
      p.stop();
      p.dispose();
    });
    this.players = [];
    
    // Останавливаем и освобождаем активные плееры попаданий
    this.hitPlayers.forEach(p => {
      p.stop();
      p.dispose();
    });
    this.hitPlayers = [];
    
    // Освобождаем эффекты
    this.hpFilter.dispose();
    this.volume.dispose();
    this.distortion.dispose();
    this.eq.dispose();
    this.compressor.dispose();
    this.reverb.dispose();
    this.output.dispose();
    this.hitGain.dispose();
    
    if (typeof (this.eventBus as any).off === 'function') {
      (this.eventBus as any).off('shoot', this.handleShoot);
      (this.eventBus as any).off('bullet_hit', this.handleBulletHit);
    }

    // Останавливаем и очищаем фоновый звук
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.src = '';
      this.backgroundAudio = null!;
    }
  }
}
