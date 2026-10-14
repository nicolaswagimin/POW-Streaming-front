import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, viewChild } from '@angular/core';
import { GalerasService } from './galeras.service';
import { COLOR_ESTACION, ESTACIONES_ORDEN, LecturaSismica } from './modelos';

const VENTANA_MS = 40_000;
const DURACION_LECTURA_MS = 400;
const AMPLITUD_MAX = 300; // µm/s que llenan medio carril
const MARGEN_IZQ = 44;
const PAPEL = '#F6F7F3';
const RETICULA = '#CBD4D3';
const TINTA = '#1E2B35';

interface Trazo extends LecturaSismica { fase: number; }

/** Helicorder: 4 carriles de papel milimetrado con la traza de cada estación. */
@Component({
  selector: 'app-helicorder',
  template: `
    <div class="heli" #contenedor>
      <canvas #lienzo role="img" [attr.aria-label]="'Helicorder de las 4 estaciones, últimos ' + ventanaSeg + ' segundos'"></canvas>
    </div>
  `,
})
export class Helicorder {
  readonly umbral = input(60);
  readonly ventanaSeg = VENTANA_MS / 1000;

  private readonly servicio = inject(GalerasService);
  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private trazos = new Map<string, Trazo[]>(ESTACIONES_ORDEN.map((id) => [id, []]));
  private sismos: { estacion: string; ts: number }[] = [];
  private ancho = 0;
  private alto = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const quitarLectura = this.servicio.alLeer((l) => {
        this.trazos.get(l.estacion_id)?.push({ ...l, fase: Math.random() * Math.PI * 2 });
      });
      const quitarSismo = this.servicio.alSismo((s, ts) => this.sismos.push({ estacion: s.estacion_id, ts }));

      const medir = () => {
        const div = this.contenedor().nativeElement;
        const canvas = this.lienzo().nativeElement;
        const dpr = window.devicePixelRatio || 1;
        this.ancho = div.clientWidth;
        this.alto = div.clientHeight;
        canvas.width = Math.round(this.ancho * dpr);
        canvas.height = Math.round(this.alto * dpr);
        canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.dibujar();
      };
      const observador = new ResizeObserver(medir);
      observador.observe(this.contenedor().nativeElement);
      medir();

      // Con movimiento reducido el papel avanza a saltos de 1 s en lugar de desplazarse de forma continua.
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let raf = 0;
      let intervalo: ReturnType<typeof setInterval> | undefined;
      if (reducido) {
        intervalo = setInterval(() => this.dibujar(), 1000);
      } else {
        const bucle = () => { this.dibujar(); raf = requestAnimationFrame(bucle); };
        raf = requestAnimationFrame(bucle);
      }

      destroyRef.onDestroy(() => {
        quitarLectura();
        quitarSismo();
        observador.disconnect();
        cancelAnimationFrame(raf);
        clearInterval(intervalo);
      });
    });
  }

  private dibujar(): void {
    const ctx = this.lienzo().nativeElement.getContext('2d');
    if (!ctx || !this.ancho || !this.alto) return;
    const ahora = Date.now();
    const w = this.ancho;
    const h = this.alto;
    const anchoTraza = w - MARGEN_IZQ;
    const altoCarril = h / ESTACIONES_ORDEN.length;
    const x = (t: number) => MARGEN_IZQ + anchoTraza - ((ahora - t) / VENTANA_MS) * anchoTraza;
    const escala = (amp: number) => Math.sqrt(Math.min(amp, AMPLITUD_MAX) / AMPLITUD_MAX) * (altoCarril / 2 - 4);

    // Papel milimetrado: líneas menores cada 1 s y mayores cada 5 s, que se desplazan con el tiempo.
    ctx.fillStyle = PAPEL;
    ctx.fillRect(0, 0, w, h);
    const pxPorSeg = anchoTraza / (VENTANA_MS / 1000);
    const segInicio = Math.floor((ahora - VENTANA_MS) / 1000);
    for (let s = segInicio; s <= ahora / 1000; s++) {
      const xs = x(s * 1000);
      if (xs < MARGEN_IZQ) continue;
      const mayor = s % 5 === 0;
      ctx.strokeStyle = RETICULA;
      ctx.globalAlpha = mayor ? 0.9 : 0.4;
      ctx.lineWidth = mayor ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, h); ctx.stroke();
      if (mayor && pxPorSeg * 5 > 40) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = TINTA;
        ctx.font = '500 10px "Barlow Condensed", sans-serif';
        ctx.fillText(`-${Math.round((ahora - s * 1000) / 1000)} s`, xs + 3, h - 4);
      }
    }
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = RETICULA;
    ctx.lineWidth = 0.5;
    for (let y = 0; y <= h; y += altoCarril / 8) {
      ctx.beginPath(); ctx.moveTo(MARGEN_IZQ, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ESTACIONES_ORDEN.forEach((id, i) => {
      const centro = altoCarril * i + altoCarril / 2;
      const color = COLOR_ESTACION[id];

      // Separador de carril y etiqueta.
      ctx.strokeStyle = TINTA;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      if (i > 0) { ctx.beginPath(); ctx.moveTo(0, altoCarril * i); ctx.lineTo(w, altoCarril * i); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = '700 13px "Barlow Condensed", sans-serif';
      ctx.fillText(id, 8, centro + 4);

      // Umbral de sismo: líneas punteadas simétricas.
      const yUmbral = escala(this.umbral());
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(MARGEN_IZQ, centro - yUmbral); ctx.lineTo(w, centro - yUmbral);
      ctx.moveTo(MARGEN_IZQ, centro + yUmbral); ctx.lineTo(w, centro + yUmbral);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Traza de tinta: cada lectura es una oscilación de 400 ms según su amplitud y frecuencia.
      const lista = this.trazos.get(id)!;
      while (lista.length && lista[0].timestamp_ms < ahora - VENTANA_MS - DURACION_LECTURA_MS) lista.shift();
      ctx.save();
      ctx.beginPath();
      ctx.rect(MARGEN_IZQ, altoCarril * i, anchoTraza, altoCarril);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x(lista[0]?.timestamp_ms - DURACION_LECTURA_MS || ahora), centro);
      for (const l of lista) {
        const x0 = x(l.timestamp_ms - DURACION_LECTURA_MS);
        const x1 = x(l.timestamp_ms);
        const a = escala(l.amplitud_um_s);
        const ciclos = Math.max(1, l.frecuencia_hz * (DURACION_LECTURA_MS / 1000));
        const pasos = Math.max(6, Math.ceil(x1 - x0));
        for (let k = 0; k <= pasos; k++) {
          const u = k / pasos;
          const envolvente = Math.sin(Math.PI * u); // sube y baja dentro de la lectura
          ctx.lineTo(x0 + u * (x1 - x0), centro - a * envolvente * Math.sin(l.fase + u * ciclos * 2 * Math.PI));
        }
      }
      ctx.stroke();
      ctx.restore();
    });

    // Marcas de sismo detectado (triángulo en el borde superior del carril).
    this.sismos = this.sismos.filter((s) => s.ts > ahora - VENTANA_MS);
    for (const s of this.sismos) {
      const i = ESTACIONES_ORDEN.indexOf(s.estacion as (typeof ESTACIONES_ORDEN)[number]);
      if (i < 0) continue;
      const xs = x(s.ts);
      const y0 = altoCarril * i + 3;
      ctx.fillStyle = COLOR_ESTACION[s.estacion];
      ctx.beginPath(); ctx.moveTo(xs - 5, y0); ctx.lineTo(xs + 5, y0); ctx.lineTo(xs, y0 + 7); ctx.closePath(); ctx.fill();
    }
  }
}
