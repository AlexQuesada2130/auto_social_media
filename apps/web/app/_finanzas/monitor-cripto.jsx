"use client";

// Monitor en vivo de las 15 criptos del robot: precio, cambio desde el cierre
// de ayer, 30 días en miniatura, si está sobre su media de 100 días (lo que
// mira el robot) y la horquilla a 30 días. Se refresca cada 15 s solo
// mientras la pantalla está a la vista.

import { useCallback, useEffect, useRef, useState } from "react";
import { useCandado } from "../candado";

const eur = (x) => x.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: x >= 100 ? 0 : x >= 1 ? 2 : 4 });
const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;

function Chispa({ valores }) {
  if (!valores?.length) return null;
  const min = Math.min(...valores), max = Math.max(...valores);
  const W = 120, H = 34, pad = 3;
  const x = (i) => (i / (valores.length - 1)) * (W - 2 * pad) + pad;
  const y = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-10" role="img" aria-label="Últimos 30 días">
      <path d={d} fill="none" stroke="var(--serie-1)" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Horquilla({ h, precio }) {
  if (!h) return <p className="text-[11px] text-muted">Aún sin historial suficiente.</p>;
  // Escala común: del 5 % al 95 %, con un pequeño margen.
  const lo = Math.min(h.p5, precio) * 0.97, hi = Math.max(h.p95, precio) * 1.03;
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-rule-soft" aria-hidden="true">
        <div className="absolute inset-y-0 rounded-full bg-accent-bg border border-accent" style={{ left: pos(h.p5), right: `calc(100% - ${pos(h.p95)})` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-ink rounded" style={{ left: pos(precio) }} title="Precio ahora" />
      </div>
      <p className="text-[11px] text-muted">
        En 30 días, 9 de cada 10 veces: <span className="font-mono text-ink">{eur(h.p5)} – {eur(h.p95)}</span>
      </p>
    </div>
  );
}

function Tarjeta({ c }) {
  const sube = (c.cambio ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-rule bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">{c.cripto}</div>
          <div className="text-lg font-semibold font-mono text-ink leading-tight">{eur(c.precio)}</div>
        </div>
        {c.cambio != null && (
          <span className={`rounded-md px-2 py-0.5 text-xs font-mono font-semibold ${sube ? "bg-pos-bg text-pos" : "bg-neg-bg text-neg"}`} title="Desde el cierre de ayer">
            {pct(c.cambio)}
          </span>
        )}
      </div>
      <Chispa valores={c.chispa} />
      {c.sobreMedia != null && (
        <p className="text-[11px]">
          <span className={c.sobreMedia ? "text-pos" : "text-muted"}>{c.sobreMedia ? "● En tendencia" : "○ Fuera de tendencia"}</span>
          <span className="text-muted"> · {c.sobreMedia ? "saldría" : "entraría"} si {c.sobreMedia ? "cae" : "sube"} un {Math.abs(c.aCruce * 100).toFixed(1)} % (media 100 d: {eur(c.sma100)})</span>
        </p>
      )}
      <Horquilla h={c.horquilla} precio={c.precio} />
    </div>
  );
}

function Freno({ partes }) {
  if (!partes) return null;
  const NOMBRE = { nucleo: "Acumulación", satelite: "Tendencia" };
  return (
    <div className="rounded-2xl border border-rule bg-card p-4">
      <h3 className="text-sm font-semibold text-ink mb-3">Distancia al freno del robot</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(partes).map(([id, p]) => {
          // 25 % de margen = recién en máximo; 0 = salta el freno.
          const lleno = Math.min(1, (p.margenFreno ?? 0) / 0.25);
          return (
            <div key={id} className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-ink">{NOMBRE[id]}</span>
                <span className={`font-mono ${p.frenado ? "text-warn" : "text-muted"}`}>{p.frenado ? "freno activo" : `puede caer ${(p.margenFreno * 100).toFixed(1)} % más`}</span>
              </div>
              <div className="h-2 rounded-full bg-rule-soft overflow-hidden">
                <div className={`h-full rounded-full ${lleno > 0.4 ? "bg-pos" : lleno > 0.15 ? "bg-warn" : "bg-neg"}`} style={{ width: `${lleno * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MonitorCripto({ partes }) {
  const { cerrar } = useCandado();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [latido, setLatido] = useState(0);
  const pidiendo = useRef(false);

  const cargar = useCallback(async () => {
    if (pidiendo.current || document.hidden) return;
    pidiendo.current = true;
    try {
      const r = await fetch("/api/mercado-cripto", { cache: "no-store" });
      if (r.status === 401) return cerrar();
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sin datos");
      setDatos(j); setError(""); setLatido((x) => x + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      pidiendo.current = false;
    }
  }, [cerrar]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15_000);
    const vuelve = () => !document.hidden && cargar();
    document.addEventListener("visibilitychange", vuelve);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vuelve); };
  }, [cargar]);

  const enTendencia = datos?.criptos.filter((c) => c.sobreMedia).length ?? 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span key={latido} className="h-2 w-2 rounded-full bg-pos animate-ping" style={{ animationIterationCount: 1 }} />
          <span className="h-2 w-2 -ml-3.5 rounded-full bg-pos" />
          En vivo · Kraken
        </span>
        {datos && <span>Actualizado {new Date(datos.actualizado).toLocaleTimeString("es-ES")}</span>}
        {datos && <span>· {enTendencia} de {datos.criptos.length} en tendencia</span>}
        {error && <span className="text-neg">· {error}</span>}
      </div>

      <Freno partes={partes} />

      {!datos && !error && <p className="text-sm text-muted">Cargando precios… La primera vez del día tarda unos segundos.</p>}
      {datos && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {datos.criptos.map((c) => <Tarjeta key={c.cripto} c={c} />)}
        </div>
      )}

      <p className="text-[11px] text-muted leading-relaxed max-w-3xl">
        La horquilla no predice si una cripto va a subir o bajar: dice entre qué precios suele acabar a 30 días, según cómo se ha
        movido el último año. Comprobada sobre 1.167 casos pasados, el precio cayó dentro el 90,5 % de las veces (en BTC y ETH,
        el 82 %: en meses movidos se queda corta). No es asesoramiento financiero.
      </p>
    </div>
  );
}
