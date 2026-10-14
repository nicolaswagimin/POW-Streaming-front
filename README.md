# Observatorio Galeras — frontend (Angular)

Dashboard en vivo del monitoreo sísmico **simulado** del volcán Galeras. Es la cara visible de una
demostración de **gRPC**: el backend (https://github.com/nicolaswagimin/POW-Streaming-back) usa los 4
tipos de RPC, y este frontend los muestra por WebSocket.

- Helicorder en `<canvas>` con 4 carriles (ANG, CRA, URC, CUF), papel milimetrado y umbral punteado.
- Banda de nivel con los colores del semáforo (verde, amarillo, naranja, rojo).
- Tabla de estaciones, panel del operador (stream bidireccional) y log de eventos (stream del servidor).
- Sección «Cómo viaja cada dato por gRPC» con contadores en vivo de llamadas y mensajes.

Angular 22, standalone components y signals, sin SSR.

## Local

```bash
npm install
npm start      # http://localhost:4200, se conecta al gateway en http://localhost:8080
npm run build  # salida en dist/Streaming/browser
```

## Producción (Vercel)

1. Edita `src/app/config.ts` y pon en `BACKEND_URL_PRODUCCION` la URL de tu servicio en Render.
2. En Vercel elige **Add New → Project** e importa este repo. `vercel.json` ya fija la salida
   (`dist/Streaming/browser`) y la reescritura a `index.html`.

Si el backend de Render está dormido, la página muestra «Reintentando…» y se reconecta sola con
backoff (1, 2, 4, 8 y luego cada 15 s).

La guía completa (arquitectura, RPC y despliegue) está en el README del backend.
