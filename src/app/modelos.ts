// Espejo en TypeScript de los mensajes de proto/galeras.proto (tal como los entrega el gateway en JSON).
export type NivelAlerta = 'NIVEL_ALERTA_UNSPECIFIED' | 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO';
export type TipoSismo = 'TIPO_SISMO_UNSPECIFIED' | 'VT' | 'LP' | 'TREMOR';

export interface LecturaSismica { estacion_id: string; timestamp_ms: number; amplitud_um_s: number; frecuencia_hz: number; }
export interface Estacion { id: string; nombre: string; lat: number; lon: number; en_linea: boolean; ultima_amplitud: number; }
export interface Umbrales { amplitud_sismo: number; sismos_amarillo: number; sismos_naranja: number; sismos_rojo: number; }
export interface EstadoVolcan { nivel: NivelAlerta; estaciones: Estacion[]; sismos_ventana: number; umbrales: Umbrales; nivel_confirmado: NivelAlerta; }
export interface SismoDetectado { estacion_id: string; amplitud: number; frecuencia_hz: number; tipo: TipoSismo; }
export interface CambioAlerta { anterior: NivelAlerta; nuevo: NivelAlerta; motivo: string; }
export interface Evento {
  timestamp_ms: number;
  payload?: 'lectura' | 'sismo' | 'cambio_alerta';
  lectura?: LecturaSismica;
  sismo?: SismoDetectado;
  cambio_alerta?: CambioAlerta;
}
export interface ComandoOperador {
  operador: string;
  ajustar_umbrales?: Umbrales;
  confirmar_alerta?: NivelAlerta;
  solicitar_estado?: boolean;
}
export interface RespuestaOperador { resultado?: 'ack' | 'error' | 'estado'; ack?: string; error?: string; estado?: EstadoVolcan; }

export type TipoRpc = 'unario' | 'streaming_cliente' | 'streaming_servidor' | 'bidireccional';
export type Metricas = Record<TipoRpc, { llamadas: number; mensajes: number; activas: number }>;

export type MensajeGateway =
  | { tipo: 'estado'; estado: EstadoVolcan }
  | { tipo: 'evento'; evento: Evento }
  | { tipo: 'operador'; respuesta: RespuestaOperador }
  | { tipo: 'metricas'; metricas: Metricas; enjambreHasta: number }
  | { tipo: 'enjambre'; hasta: number };

export const ESTACIONES_ORDEN = ['ANG', 'CRA', 'URC', 'CUF'] as const;
export const COLOR_ESTACION: Record<string, string> = { ANG: '#1F4E8C', CRA: '#A3262A', URC: '#2E6B3A', CUF: '#A8740F' };
export const NIVELES: NivelAlerta[] = ['VERDE', 'AMARILLO', 'NARANJA', 'ROJO'];
