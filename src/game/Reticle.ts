// src/game/Reticle.ts
import * as THREE from 'three';
import { Ballistics } from './Ballistics';

export class Reticle {
  private container: HTMLDivElement;
  private svgEl: SVGSVGElement | null = null;
  private camera: THREE.PerspectiveCamera;
  private ballistics: Ballistics;
  private ranges = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300];

  constructor(camera: THREE.PerspectiveCamera, ballistics: Ballistics) {
    this.camera = camera;
    this.ballistics = ballistics;

    this.container = document.createElement('div');
    this.container.className = 'reticle-overlay';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '50';
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';

    // Загружаем внешний SVG
    this.loadSvg();
    document.body.appendChild(this.container);

    window.addEventListener('resize', () => this.updateMarks());
  }

  private async loadSvg(): Promise<void> {
    try {
      const response = await fetch('assets/reticle_pso1.svg');
      const svgText = await response.text();
      
      // Парсим SVG строку в DOM элемент
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      this.svgEl = svgDoc.documentElement as unknown as SVGSVGElement;
      
      // Настраиваем атрибуты SVG для правильного масштабирования
      this.svgEl.setAttribute('width', '100%');
      this.svgEl.setAttribute('height', '100%');
      this.svgEl.style.display = 'block';
      this.svgEl.style.position = 'absolute';
      this.svgEl.style.top = '0';
      this.svgEl.style.left = '0';
      
      // Убеждаемся что viewBox корректен
      if (!this.svgEl.hasAttribute('viewBox')) {
        this.svgEl.setAttribute('viewBox', '0 0 1000 1000');
      }
      this.svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      
      this.container.innerHTML = '';
      this.container.appendChild(this.svgEl);
      
      // Первоначальное обновление меток
      this.updateMarks();
    } catch (error) {
      console.error('Ошибка загрузки SVG прицела:', error);
      this.createFallbackSvg();
    }
  }

  private createFallbackSvg(): void {
    // Fallback SVG если файл не загрузился
    const svgNS = 'http://www.w3.org/2000/svg';
    this.svgEl = document.createElementNS(svgNS, 'svg');
    this.svgEl.setAttribute('width', '100%');
    this.svgEl.setAttribute('height', '100%');
    this.svgEl.setAttribute('viewBox', '0 0 1000 1000');
    this.svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svgEl.style.display = 'block';
    
    // Простой шеврон
    const chevron = document.createElementNS(svgNS, 'path');
    chevron.setAttribute('d', 'M500 480 L518 500 L500 520 L482 500 Z');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', '#ffd080');
    chevron.setAttribute('stroke-width', '3.5');
    this.svgEl.appendChild(chevron);
    
    // Группа для BDC меток
    const bdcGroup = document.createElementNS(svgNS, 'g');
    bdcGroup.setAttribute('id', 'bdc-marks');
    this.svgEl.appendChild(bdcGroup);
    
    this.container.innerHTML = '';
    this.container.appendChild(this.svgEl);
  }

  /**
   * Пересчитать и отрисовать BDC метки (нижние че́вроны) по текущей камере и баллистике.
   */
  public updateMarks(): void {
    if (!this.svgEl) return;
    
    const bdcGroup = this.svgEl.querySelector('#bdc-marks') as SVGGElement;
    if (!bdcGroup) return;
    
    while (bdcGroup.firstChild) bdcGroup.removeChild(bdcGroup.firstChild);

    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const screenH = window.innerHeight;
    const centerX = 500;
    const centerY = 500;

    for (let i = 0; i < this.ranges.length; i++) {
      const r = this.ranges[i];
      const drop = this.ballistics.getDropAtRange(r);
      const mils = (drop / r) * 1000;
      const ang = mils / 1000;
      const pixelOffset = (ang / vFovRad) * screenH;
      const vbOffset = (pixelOffset / screenH) * 1000;

      const mark = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const size = 12;
      const y = centerY + vbOffset;
      
      // Рисуем маленький шеврон для BDC метки
      const d = `M${centerX - size} ${y - size/3} L${centerX} ${y + size/2} L${centerX + size} ${y - size/3}`;
      mark.setAttribute('d', d);
      mark.setAttribute('fill', 'none');
      mark.setAttribute('stroke', '#ffd080');
      mark.setAttribute('stroke-width', '2');
      mark.setAttribute('opacity', String(Math.max(0.3, 1 - i / this.ranges.length * 0.5)));
      bdcGroup.appendChild(mark);

      // Подпись расстояния (маленькая и тонкая)
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(centerX - 55));
      label.setAttribute('y', String(y + 3));
      label.setAttribute('fill', 'rgba(255, 200, 120, 0.7)');
      label.setAttribute('font-family', 'Courier New, monospace');
      label.setAttribute('font-size', '9');
      label.setAttribute('font-weight', 'normal');
      label.setAttribute('text-anchor', 'end');
      label.textContent = `${r}`;
      bdcGroup.appendChild(label);
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', () => this.updateMarks());
    this.container.remove();
  }
}
