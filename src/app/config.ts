// URL del gateway. Después de desplegar en Render, reemplaza esta constante por la URL de tu servicio.
export const BACKEND_URL_PRODUCCION = 'https://galeras-grpc.onrender.com';

const ES_LOCAL = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname ?? '');

export const BACKEND_URL = ES_LOCAL ? 'http://localhost:8080' : BACKEND_URL_PRODUCCION;
export const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws';

/** Espera antes del reintento n (1, 2, 4, 8… hasta 15 s). */
export function esperaReintento(intento: number): number {
  return Math.min(15_000, 1000 * 2 ** Math.max(0, intento - 1));
}
