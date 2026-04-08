// src/game/Reticle.ts
import * as THREE from 'three';
import { Ballistics } from './Ballistics';

export class Reticle {
  private container: HTMLDivElement;
  private svgEl: SVGSVGElement | null = null;
  private camera: THREE.PerspectiveCamera;
  private ballistics: Ballistics;
  private ranges = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300];

  // Хранилище элементов BDC для обновления без пересоздания
  private bdcElements: Array<{ mark: SVGPathElement; label: SVGTextElement }> = [];

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

    this.loadSvg();
    document.body.appendChild(this.container);

    window.addEventListener('resize', () => this.updateMarks());
  }

  private async loadSvg(): Promise<void> {
    try {
      const response = await fetch('assets/reticle_pso1.svg');
      const svgText = await response.text();
      
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      this.svgEl = svgDoc.documentElement as unknown as SVGSVGElement;
      
      this.svgEl.setAttribute('width', '100%');
      this.svgEl.setAttribute('height', '100%');
      this.svgEl.style.display = 'block';
      this.svgEl.style.position = 'absolute';
      this.svgEl.style.top = '0';
      this.svgEl.style.left = '0';
      this.svgEl.style.transformOrigin = 'center center';
      
      if (!this.svgEl.hasAttribute('viewBox')) {
        this.svgEl.setAttribute('viewBox', '0 0 1000 1000');
      }
      this.svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      
      this.container.innerHTML = '';
      this.container.appendChild(this.svgEl);
      
      // Создаём элементы BDC один раз
      this.initBdcElements();
      
      this.updateMarks();
    } catch (error) {
      console.error('Ошибка загрузки SVG прицела:', error);
      this.createFallbackSvg();
    }
  }

  private initBdcElements(): void {
    if (!this.svgEl) return;
    const bdcGroup = this.svgEl.querySelector('#bdc-marks') as SVGGElement;
    if (!bdcGroup) return;

    // Очищаем группу и создаём новые элементы
    while (bdcGroup.firstChild) bdcGroup.removeChild(bdcGroup.firstChild);
    this.bdcElements = [];

    for (let i = 0; i < this.ranges.length; i++) {
      const mark = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      mark.setAttribute('fill', 'none');
      mark.setAttribute('stroke', '#ffd080');
      mark.setAttribute('stroke-width', '2');
      bdcGroup.appendChild(mark);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('fill', 'rgba(255, 200, 120, 0.7)');
      label.setAttribute('font-family', 'Courier New, monospace');
      label.setAttribute('font-size', '9');
      label.setAttribute('font-weight', 'normal');
      label.setAttribute('text-anchor', 'end');
      bdcGroup.appendChild(label);

      this.bdcElements.push({ mark, label });
    }
  }

  private createFallbackSvg(): void {
    const svgNS = 'http://www.w3.org/2000/svg';
    this.svgEl = document.createElementNS(svgNS, 'svg');
    this.svgEl.setAttribute('width', '100%');
    this.svgEl.setAttribute('height', '100%');
    this.svgEl.setAttribute('viewBox', '0 0 1000 1000');
    this.svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svgEl.style.display = 'block';
    this.svgEl.style.transformOrigin = 'center center';
    
    const chevron = document.createElementNS(svgNS, 'path');
    chevron.setAttribute('d', 'M500 480 L518 500 L500 520 L482 500 Z');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', '#ffd080');
    chevron.setAttribute('stroke-width', '3.5');
    this.svgEl.appendChild(chevron);
    
    const bdcGroup = document.createElementNS(svgNS, 'g');
    bdcGroup.setAttribute('id', 'bdc-marks');
    this.svgEl.appendChild(bdcGroup);
    
    this.container.innerHTML = '';
    this.container.appendChild(this.svgEl);
    this.initBdcElements();
  }

  /**
   * Пересчитывает позиции BDC-меток и обновляет масштаб всей сетки.
   * Вызывается каждый кадр из игрового цикла.
   */
  public updateMarks(): void {
    if (!this.svgEl) return;

    // --- Обновление масштаба SVG для имитации оптического зума ---
    const baseFov = 75; // FOV без приближения
    const scale = baseFov / this.camera.fov;
    this.svgEl.style.transform = `scale(${scale})`;

    // --- Обновление позиций BDC меток ---
    if (this.bdcElements.length === 0) return;

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
      const y = centerY + vbOffset;

      const { mark, label } = this.bdcElements[i];
      const size = 12;
      const d = `M${centerX - size} ${y - size/3} L${centerX} ${y + size/2} L${centerX + size} ${y - size/3}`;
      mark.setAttribute('d', d);
      mark.setAttribute('opacity', String(Math.max(0.3, 1 - i / this.ranges.length * 0.5)));

      label.setAttribute('x', String(centerX - 55));
      label.setAttribute('y', String(y + 3));
      label.textContent = `${r}`;
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', () => this.updateMarks());
    this.container.remove();
  }
}
