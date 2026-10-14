import { Injectable, signal } from '@angular/core';
import { esperaReintento, WS_URL } from './config';
import {
  ComandoOperador, EstadoVolcan, Evento, LecturaSismica, MensajeGateway, Metricas, RespuestaOperador, SismoDetectado,
} from './modelos';

export type EstadoConexion = 'conectando' | 'conectado' | 'reintentando';
export interface EntradaLog { id: number; ts: number; evento: Evento; }
export interface EntradaOperador { id: number; ts: number; respuesta: RespuestaOperador; }

const MAX_LOG = 80;
const MAX_RESPUESTAS = 30;

/** Conexión WebSocket con el gateway, expuesta como signals. */
@Injectable({ providedIn: 'root' })
export class GalerasService {
  readonly conexion = signal<EstadoConexion>('conectando');
  readonly intento = signal(0);
  readonly segundosReintento = signal(0);
  readonly estado = signal<EstadoVolcan | null>(null);
  readonly metricas = signal<Metricas | null>(null);
  readonly log = signal<EntradaLog[]>([]);
  readonly respuestas = signal<EntradaOperador[]>([]);
  readonly enjambreHasta = signal(0);
  /** Nombre del operador; viaja como metadata gRPC `x-operador` (vía el gateway). */
  readonly operador = `Operador-${Math.floor(100 + Math.random() * 900)}`;

  // Lecturas y sismos llegan ~10 por segundo: se entregan por callback al helicorder, no por signal.
  private oyentesLectura = new Set<(l: LecturaSismica) => void>();
  private oyentesSismo = new Set<(s: SismoDetectado, ts: number) => void>();
  private ws?: WebSocket;
  private secuencia = 0;
  private temporizador?: ReturnType<typeof setInterval>;

  constructor() {
    this.conectar();
  }

  alLeer(fn: (l: LecturaSismica) => void): () => void {
    this.oyentesLectura.add(fn);
    return () => this.oyentesLectura.delete(fn);
  }

  alSismo(fn: (s: SismoDetectado, ts: number) => void): () => void {
    this.oyentesSismo.add(fn);
    return () => this.oyentesSismo.delete(fn);
  }

  enviarComando(comando: ComandoOperador): boolean {
    return this.enviar({ tipo: 'comando', comando });
  }

  simularEnjambre(): boolean {
    return this.enviar({ tipo: 'enjambre' });
  }

  private enviar(msg: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private conectar(): void {
    clearInterval(this.temporizador);
    const ws = new WebSocket(`${WS_URL}?operador=${encodeURIComponent(this.operador)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.conexion.set('conectado');
      this.intento.set(0);
    };
    ws.onmessage = (m) => this.procesar(JSON.parse(m.data) as MensajeGateway);
    ws.onclose = () => this.programarReintento();
  }

  private programarReintento(): void {
    const n = this.intento() + 1;
    this.intento.set(n);
    this.conexion.set('reintentando');
    let restante = Math.round(esperaReintento(n) / 1000);
    this.segundosReintento.set(restante);
    this.temporizador = setInterval(() => {
      restante--;
      this.segundosReintento.set(Math.max(0, restante));
      if (restante <= 0) this.conectar();
    }, 1000);
  }

  private procesar(msg: MensajeGateway): void {
    switch (msg.tipo) {
      case 'estado':
        this.estado.set(msg.estado);
        break;
      case 'metricas':
        this.metricas.set(msg.metricas);
        this.enjambreHasta.set(msg.enjambreHasta);
        break;
      case 'enjambre':
        this.enjambreHasta.set(msg.hasta);
        break;
      case 'operador':
        if (msg.respuesta.resultado === 'estado' && msg.respuesta.estado) this.estado.set(msg.respuesta.estado);
        this.respuestas.update((r) => [{ id: ++this.secuencia, ts: Date.now(), respuesta: msg.respuesta }, ...r].slice(0, MAX_RESPUESTAS));
        break;
      case 'evento':
        this.procesarEvento(msg.evento);
        break;
    }
  }

  private procesarEvento(e: Evento): void {
    if (e.payload === 'lectura' && e.lectura) {
      this.oyentesLectura.forEach((fn) => fn(e.lectura!));
      return;
    }
    if (e.payload === 'sismo' && e.sismo) this.oyentesSismo.forEach((fn) => fn(e.sismo!, e.timestamp_ms));
    if (e.payload === 'cambio_alerta' && e.cambio_alerta) {
      const nuevo = e.cambio_alerta.nuevo;
      this.estado.update((s) => (s ? { ...s, nivel: nuevo } : s));
    }
    this.log.update((l) => [{ id: ++this.secuencia, ts: e.timestamp_ms, evento: e }, ...l].slice(0, MAX_LOG));
  }
}
