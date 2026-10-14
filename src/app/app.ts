import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GalerasService } from './galeras.service';
import { Helicorder } from './helicorder';
import { COLOR_ESTACION, NIVELES, NivelAlerta, TipoRpc, TipoSismo, Umbrales } from './modelos';

interface FilaRpc { clave: TipoRpc; tipo: string; firma: string; quien: string; uso: string; }

const NOMBRE_SISMO: Record<TipoSismo, string> = {
  TIPO_SISMO_UNSPECIFIED: '—', VT: 'Volcano-tectónico', LP: 'Largo periodo', TREMOR: 'Tremor',
};

@Component({
  selector: 'app-root',
  imports: [Helicorder, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './app.html',
})
export class App {
  protected readonly s = inject(GalerasService);
  protected readonly colores = COLOR_ESTACION;
  protected readonly niveles = NIVELES;
  protected readonly nombreSismo = NOMBRE_SISMO;

  protected readonly nivel = computed<NivelAlerta>(() => this.s.estado()?.nivel ?? 'NIVEL_ALERTA_UNSPECIFIED');
  protected readonly nivelTexto = computed(() => (this.nivel() === 'NIVEL_ALERTA_UNSPECIFIED' ? 'Sin datos' : this.nivel()));
  protected readonly confirmado = computed(() => {
    const n = this.s.estado()?.nivel_confirmado;
    return !n || n === 'NIVEL_ALERTA_UNSPECIFIED' ? 'Sin confirmar' : n;
  });
  protected readonly umbralAmplitud = computed(() => this.s.estado()?.umbrales.amplitud_sismo ?? 60);

  private readonly ahora = signal(Date.now());
  protected readonly enjambreRestante = computed(() => Math.max(0, Math.ceil((this.s.enjambreHasta() - this.ahora()) / 1000)));

  // Formulario del operador (se precarga con los umbrales que reporta el servidor).
  protected umbrales: Umbrales = { amplitud_sismo: 60, sismos_amarillo: 5, sismos_naranja: 12, sismos_rojo: 25 };
  protected nivelAConfirmar: NivelAlerta = 'VERDE';
  protected readonly avisoLocal = signal('');

  protected readonly rpcs: FilaRpc[] = [
    {
      clave: 'unario', tipo: 'Unario',
      firma: 'ObtenerEstado (ObtenerEstadoRequest) → EstadoVolcan',
      quien: 'Gateway → Servidor',
      uso: 'Foto del volcán al conectar cada navegador y cada 2 s (nivel, estaciones, umbrales). Deadline de 3 s.',
    },
    {
      clave: 'streaming_cliente', tipo: 'Streaming del cliente',
      firma: 'EnviarLecturas (stream LecturaSismica) → ResumenEnvio',
      quien: 'Simulador → Servidor',
      uso: 'Cada estación envía 8 lecturas (una cada 400 ms), cierra el stream y recibe un único resumen. Metadata x-estacion-id.',
    },
    {
      clave: 'streaming_servidor', tipo: 'Streaming del servidor',
      firma: 'SuscribirEventos (SuscripcionRequest) → stream Evento',
      quien: 'Servidor → Gateway',
      uso: 'Una suscripción por navegador que nunca termina: empuja lecturas, sismos y cambios de alerta (oneof payload).',
    },
    {
      clave: 'bidireccional', tipo: 'Bidireccional',
      firma: 'SesionOperador (stream ComandoOperador) → stream RespuestaOperador',
      quien: 'Gateway ⇄ Servidor',
      uso: 'Sesión del operador: ajustar umbrales, confirmar nivel, pedir estado. Respuestas ack, estado o error sin cortar la sesión.',
    },
  ];

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));

    let precargado = false;
    effect(() => {
      const e = this.s.estado();
      if (e && !precargado) {
        precargado = true;
        this.umbrales = { ...e.umbrales };
        if (e.nivel !== 'NIVEL_ALERTA_UNSPECIFIED') this.nivelAConfirmar = e.nivel;
      }
    });
  }

  protected claseNivel(n: string): string {
    return 'nivel-' + n.toLowerCase();
  }

  protected ajustarUmbrales(): void {
    this.comando({ ajustar_umbrales: { ...this.umbrales } });
  }

  protected confirmarNivel(): void {
    this.comando({ confirmar_alerta: this.nivelAConfirmar });
  }

  protected pedirEstado(): void {
    this.comando({ solicitar_estado: true });
  }

  protected enjambre(): void {
    if (!this.s.simularEnjambre()) this.avisoLocal.set('Sin conexión con el gateway: espera a que reconecte.');
  }

  private comando(c: Omit<Parameters<GalerasService['enviarComando']>[0], 'operador'>): void {
    const ok = this.s.enviarComando({ operador: this.s.operador, ...c });
    this.avisoLocal.set(ok ? '' : 'Sin conexión con el gateway: el comando no se envió.');
  }

  protected porcentaje(amp: number): number {
    return Math.min(100, (amp / 300) * 100);
  }
}
