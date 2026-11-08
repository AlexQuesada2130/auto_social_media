"use client";

// Cripto · Hoy: primero lo que hace TU robot, luego el mercado.
//  1. Alertas, solo si pasa algo (freno cerca, cripto a punto de cruzar su
//     media, robot pausado o fallando). Si no, "todo en orden".
//  2. Tu robot hoy: valor, resultado, gráfico, medidor del freno y lo que ha
//     hecho cada día.
//  3. El mercado en una lista compacta; tocar una fila enseña su horquilla.

import { useCallback, useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useCandado } from "../candado";
import { Chispa, Horquilla } from "./monitor-cripto";

const eur = (x, d) => x.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: d ?? (Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 1 ? 2 : 4) });
const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;
const NOMBRE = { nucleo: "Acumulación", satelite: "Tendencia" };

function alertas(robot, mercado) {
  const a = [];
  if (robot?.ultimoError) a.push({ tono: "neg", texto: `El robot no pudo operar: ${robot.ultimoError.mensaje}` });
  if (robot?.pausado) a.push({ tono: "warn", texto: "El robot está pausado: no compra ni vende." });
  for (const [id, p] of Object.entries(robot?.partes ?? {})) {
    if (p.frenado) a.push({ tono: "warn", texto: `Freno activo en ${NOMBRE[id]}: decide en «Detalle» si vuelve a entrar.` });
    else if (p.margenFreno < 0.08) a.push({ tono: "warn", texto: `${NOMBRE[id]}: el freno salta si cae un ${(p.margenFreno * 100).toFixed(1)} % más.` });
  }
  for (const c of mercado?.criptos ?? []) {
    if (c.aCruce != null && Math.abs(c.aCruce) < 0.02) {
      a.push({ tono: "info", texto: `${c.cripto} a un ${Math.abs(c.aCruce * 100).toFixed(1)} % de ${c.sobreMedia ? "salir de" : "entrar en"} tendencia: el robot ${c.sobreMedia ? "vendería" : "compraría"} su parte.` });
    }
  }
  if (mercado?.deAyer) a.push({ tono: "info", texto: `Kraken no responde: tendencias calculadas con los cierres del ${mercado.cierresDe}.` });
  return a;
}

function LineaTiempo({ operaciones }) {
  const porDia = new Map();
  for (const o of operaciones) {
    if (!porDia.has(o.fecha)) porDia.set(o.fecha, []);
    porDia.get(o.fecha).push(o);
  }
  const dias = [...porDia.entries()].slice(0, 6);
  if (!dias.length) return <p className="text-xs text-muted">Todavía no ha operado.</p>;
  return (
    <ol className="relative space-y-3 border-l border-rule pl-4">
      {dias.map(([fecha, ops]) => {
        const compras = ops.filter((o) => o.tipo === "compra"), ventas = ops.filter((o) => o.tipo === "venta");
        const lista = (l) => [...new Set(l.map((o) => o.cripto))].join(", ");
        return (
          <li key={fecha} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
            <div className="text-[11px] text-muted">{new Date(fecha + "T00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</div>
            <div className="text-sm text-ink">
              {compras.length > 0 && <span>Compró {lista(compras)} <span className="font-mono text-muted">({eur(compras.reduce((s, o) => s + o.importe, 0), 2)})</span></span>}
              {compras.length > 0 && ventas.length > 0 && <span className="text-muted"> · </span>}
              {ventas.length > 0 && <span>Vendió {lista(ventas)} <span className="font-mono text-muted">({eur(ventas.reduce((s, o) => s + o.importe, 0), 2)})</span></span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MedidorFreno({ partes }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(partes).map(([id, p]) => {
        const lleno = p.frenado ? 0 : Math.min(1, (p.margenFreno ?? 0) / 0.25);
        return (
          <div key={id} className="space-y-1">
            <div className="flex justify-between text-[11px]"><span className="text-muted">{NOMBRE[id]}</span><span className={p.frenado ? "text-warn" : "text-muted"}>{p.frenado ? "frenado" : `margen ${(p.margenFreno * 100).toFixed(0)} %`}</span></div>
            <div className="h-2 rounded-full bg-rule-soft overflow-hidden"><div className={`h-full rounded-full ${lleno > 0.4 ? "bg-pos" : lleno > 0.15 ? "bg-warn" : "bg-neg"}`} style={{ width: `${lleno * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function FilaMercado({ c, posicion }) {
  const [abierta, setAbierta] = useState(false);
  const sube = (c.cambio ?? 0) >= 0;
  return (
    <li className="py-2.5">
      <button onClick={() => setAbierta((x) => !x)} className="flex w-full items-center gap-3 text-left" aria-expanded={abierta}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${c.sobreMedia ? "bg-pos" : "bg-rule"}`} title={c.sobreMedia ? "En tendencia" : "Fuera de tendencia"} />
        <span className="w-12 text-sm font-semibold text-ink">{c.cripto}</span>
        <span className="w-20 shrink-0"><Chispa valores={c.chispa} /></span>
        <span className="flex-1 text-right font-mono text-sm text-ink">{eur(c.precio)}</span>
        {c.cambio != null && <span className={`w-16 text-right font-mono text-xs ${sube ? "text-pos" : "text-neg"}`}>{pct(c.cambio)}</span>}
      </button>
      {abierta && (
        <div className="mt-2 ml-5 space-y-2 text-[11px] text-muted">
          {posicion > 0.005 && <p>El robot tiene <b className="text-ink">{eur(posicion, 2)}</b> en {c.cripto}.</p>}
          {c.sma100 != null && <p>{c.sobreMedia ? "En tendencia" : "Fuera de tendencia"}: {c.sobreMedia ? "saldría" : "entraría"} si {c.sobreMedia ? "cae" : "sube"} un {Math.abs(c.aCruce * 100).toFixed(1)} % (media 100 días: {eur(c.sma100)}).</p>}
          <Horquilla h={c.horquilla} precio={c.precio} />
        </div>
      )}
    </li>
  );
}

export function CriptoHoy({ robot, onIrDetalle }) {
  const { cerrar } = useCandado();
  const [mercado, setMercado] = useState(null);
  const [error, setError] = useState("");
  const pidiendo = useRef(false);

  const cargar = useCallback(async () => {
    if (pidiendo.current || document.hidden) return;
    pidiendo.current = true;
    try {
      const r = await fetch("/api/mercado-cripto", { cache: "no-store" });
      if (r.status === 401) return cerrar();
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sin datos");
      setMercado(j); setError("");
    } catch (e) { setError(e.message); } finally { pidiendo.current = false; }
  }, [cerrar]);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15_000);
    const vuelve = () => !document.hidden && cargar();
    document.addEventListener("visibilitychange", vuelve);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vuelve); };
  }, [cargar]);

  const lista = alertas(robot, mercado);
  const tonos = { neg: "border-neg bg-neg-bg", warn: "border-warn bg-warn-bg", info: "border-rule bg-field" };
  const posiciones = {};
  for (const p of Object.values(robot?.partes ?? {})) for (const [c, v] of Object.entries(p.posiciones ?? {})) posiciones[c] = (posiciones[c] ?? 0) + v;
  const enTendencia = mercado?.criptos.filter((c) => c.sobreMedia).length ?? 0;

  return (
    <div className="space-y-5">
      {/* 1. Alertas */}
      {lista.length === 0 ? (
        <p className="rounded-2xl border border-pos bg-pos-bg px-4 py-3 text-sm font-semibold text-pos">✓ Todo en orden</p>
      ) : (
        <div className="space-y-2">{lista.map((x, i) => <p key={i} className={`rounded-2xl border px-4 py-3 text-sm text-ink ${tonos[x.tono]}`}>{x.texto}</p>)}</div>
      )}

      {/* 2. Tu robot hoy */}
      {robot ? (
        <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Tu robot hoy · papel</div>
              <div className="text-4xl font-semibold font-mono text-ink leading-tight">{eur(robot.valor, 2)}</div>
              <div className={`text-sm font-mono ${robot.resultado >= 0 ? "text-pos" : "text-neg"}`}>
                {robot.resultado >= 0 ? "+" : ""}{eur(robot.resultado, 2)} sobre {eur(robot.aportado, 0)} · semana {pct(robot.semana)}
              </div>
            </div>
            <button onClick={onIrDetalle} className="text-xs text-accent hover:underline shrink-0">Detalle</button>
          </div>
          {robot.historial.length > 1 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={robot.historial}>
                  <XAxis dataKey="fecha" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 12 }} formatter={(v) => eur(v, 2)} />
                  <Line type="monotone" dataKey="valor" name="Valor" stroke="var(--serie-1)" strokeWidth={2} dot={false} />
                  <Line type="stepAfter" dataKey="aportado" name="Aportado" stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <MedidorFreno partes={robot.partes} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Lo que ha hecho</div>
            <LineaTiempo operaciones={robot.operaciones} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-rule bg-card p-5 text-sm text-muted">
          {robot === null ? <>El robot aún no ha arrancado. <button onClick={onIrDetalle} className="text-accent hover:underline">Arrancarlo</button></> : "Cargando el robot…"}
        </div>
      )}

      {/* 3. Mercado */}
      <div className="rounded-2xl border border-rule bg-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-ink">Mercado</h3>
          <span className="text-[11px] text-muted inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pos" /> en vivo · {enTendencia}/{mercado?.criptos.length ?? 15} en tendencia
          </span>
        </div>
        {error && <p className="text-xs text-neg">{error}</p>}
        {!mercado && !error && <p className="text-xs text-muted py-3">Cargando precios…</p>}
        {mercado && (
          <ul className="divide-y divide-rule">
            {mercado.criptos.map((c) => <FilaMercado key={c.cripto} c={c} posicion={posiciones[c.cripto] ?? 0} />)}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted">Toca una cripto para ver su horquilla a 30 días. No predice si sube o baja; no es asesoramiento financiero.</p>
      </div>
    </div>
  );
}
