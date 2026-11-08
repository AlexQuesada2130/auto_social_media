"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Marco } from "../_finanzas/marco";
import { SummaryCard } from "../_finanzas/portfolio-tracker";
import { eur, lucide } from "../_finanzas/components";
import { useCandado } from "../candado";
import { CriptoHoy } from "../_finanzas/cripto-hoy";

const NOMBRE_PARTE = { nucleo: "Acumulación (70 %)", satelite: "Trading por tendencia (30 %)" };
const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)} %`;

function Parte({ id, p, onAccion, ocupado }) {
  const posiciones = Object.entries(p.posiciones).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border border-rule bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{NOMBRE_PARTE[id]}</h3>
          <p className="text-xs text-muted mt-0.5">
            {p.agentes} agente{p.agentes === 1 ? "" : "s"} · reserva {eur(p.reserva)} · invertido al {(p.exposicion * 100).toFixed(0)} %
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-ink font-mono">{eur(p.valor)}</div>
          <div className={`text-xs font-mono ${p.valor >= p.aportado ? "text-pos" : "text-neg"}`}>{eur(p.valor - p.aportado)} sobre {eur(p.aportado)}</div>
        </div>
      </div>

      {p.frenado && (
        <div className="rounded-xl border border-warn bg-warn-bg p-3 text-sm text-ink space-y-2">
          <p>
            <b>Freno activo.</b> Cayó un 25 % desde su mejor momento y vendí {p.decision === "salir" ? "todo" : "la mitad"}.
            {p.decision === "volver" ? " Volviendo a entrar en tramos semanales." : p.decision === "salir" ? " Fuera hasta que digas «volver»." : ` Si no dices nada, vuelvo a entrar en ${Math.max(0, 30 - p.diasFuera)} días.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button disabled={ocupado} onClick={() => onAccion("volver", id)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-text disabled:opacity-40">Volver ya</button>
            {p.decision !== null && <button disabled={ocupado} onClick={() => onAccion("esperar", id)} className="rounded-lg border border-rule px-3 py-1.5 text-xs text-ink disabled:opacity-40">Que decida el robot (30 días)</button>}
            {p.decision !== "salir" && <button disabled={ocupado} onClick={() => onAccion("salir", id)} className="rounded-lg border border-neg px-3 py-1.5 text-xs text-neg disabled:opacity-40">Salir del todo</button>}
          </div>
        </div>
      )}

      {posiciones.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {posiciones.map(([c, v]) => (
            <span key={c} className="rounded-md border border-rule bg-field px-2 py-1 text-xs"><b className="text-ink">{c}</b> <span className="font-mono text-muted">{eur(v)}</span></span>
          ))}
        </div>
      ) : <p className="text-xs text-muted">Sin posiciones ahora mismo: todo en efectivo.</p>}
    </div>
  );
}

export default function Cripto() {
  const { cerrar } = useCandado();
  const [robot, setRobot] = useState(undefined);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [pestana, setPestana] = useState("hoy");

  const cargar = useCallback(async () => {
    const r = await fetch("/api/robot", { cache: "no-store" });
    if (r.status === 401) return cerrar();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error || "No se pudo cargar el robot");
    setRobot(j.robot);
  }, [cerrar]);
  useEffect(() => { cargar(); }, [cargar]);

  async function accion(nombre, parte) {
    setOcupado(true); setError("");
    const r = await fetch("/api/robot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: nombre, parte }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setRobot(j.robot); else setError(j.error || "No se pudo hacer");
    setOcupado(false);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <Marco titulo="Cripto" subtitulo="Tu robot en papel y el mercado en vivo (precios reales de Kraken, dinero ficticio)."
      pestanas={[{ id: "hoy", nombre: "Hoy" }, { id: "robot", nombre: "Detalle del robot" }]} activa={pestana} onPestana={setPestana}>
      {pestana === "hoy" && <CriptoHoy robot={robot} onIrDetalle={() => setPestana("robot")} />}
      {pestana === "robot" && <>
      {error && <p className="text-sm text-neg">{error}</p>}
      {robot === undefined && !error && <p className="text-sm text-muted">Cargando…</p>}

      {robot === null && (
        <div className="rounded-2xl border border-rule bg-card p-6 space-y-3">
          <h2 className="text-base font-semibold text-ink">El robot aún no ha arrancado</h2>
          <p className="text-sm text-muted max-w-2xl">
            Arrancará solo en la próxima ejecución diaria (entre las 07:00 y las 08:00 en Madrid), o ahora si pulsas el botón. Empieza con 50 € ficticios
            y suma 10 € cada semana. No toca dinero real ni necesita ninguna cuenta.
          </p>
          <button disabled={ocupado} onClick={() => accion("ejecutar")} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-40">
            {ocupado ? "Arrancando… (tarda unos 20 s)" : "Arrancar ahora"}
          </button>
        </div>
      )}

      {robot && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-accent-bg text-accent px-2 py-1 font-semibold">PAPEL</span>
            <span className="text-muted">Desde {robot.inicio} · {robot.dias} día{robot.dias === 1 ? "" : "s"} · última ejecución {robot.ultimoDia}</span>
            {robot.pausado && <span className="rounded-md bg-warn-bg text-warn px-2 py-1 font-semibold">PAUSADO</span>}
            {robot.ultimoError && <span className="text-neg">Último fallo: {robot.ultimoError.mensaje}</span>}
            <span className="flex-1" />
            {robot.ultimoDia !== hoy && !robot.pausado && (
              <button disabled={ocupado} onClick={() => accion("ejecutar")} className="rounded-lg border border-rule px-3 py-1.5 text-ink disabled:opacity-40">{ocupado ? "Ejecutando…" : "Ejecutar hoy"}</button>
            )}
            <button disabled={ocupado} onClick={() => accion(robot.pausado ? "reanudar" : "pausar")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-40 ${robot.pausado ? "border-accent text-accent" : "border-neg text-neg"}`}>
              {robot.pausado ? "Reanudar" : <><lucide.Lock size={12} /> Parar el robot</>}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Valor (si vendiera hoy)" value={eur(robot.valor)} tone="neutral" icon={<lucide.Wallet size={16} />} />
            <SummaryCard label="Aportado" value={eur(robot.aportado)} tone="neutral" icon={<lucide.Download size={16} />} />
            <SummaryCard label="Resultado" value={`${robot.resultado >= 0 ? "+" : ""}${eur(robot.resultado)}`} tone={robot.resultado >= 0 ? "positive" : "negative"}
              icon={robot.resultado >= 0 ? <lucide.TrendingUp size={16} /> : <lucide.TrendingDown size={16} />} />
            <SummaryCard label="Esta semana" value={pct(robot.semana)} sub={`${robot.semanaOps} operaciones`} tone={robot.semana >= 0 ? "positive" : "negative"} icon={<lucide.Compass size={16} />} />
          </div>

          {robot.historial.length > 1 && (
            <div className="rounded-2xl border border-rule bg-card p-5">
              <h3 className="text-sm font-semibold text-ink mb-3">Valor frente a lo aportado</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={robot.historial}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="fecha" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 8, fontSize: 12 }} formatter={(v) => eur(v)} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="valor" name="Valor" stroke="var(--serie-1)" strokeWidth={2} dot={false} />
                    <Line type="stepAfter" dataKey="aportado" name="Aportado" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {Object.entries(robot.partes).map(([id, p]) => <Parte key={id} id={id} p={p} onAccion={accion} ocupado={ocupado} />)}
          </div>

          <div className="rounded-2xl border border-rule bg-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-1">Cuándo actúa</h3>
            <p className="text-xs text-muted leading-relaxed">
              Una vez al día, entre las 07:00 y las 08:00 (Madrid). Acumulación: compra cada lunes con los 10 € y reequilibra cada 30 días. Tendencia:
              revisa cada día y opera solo cuando una cripto cruza su media de 100 días. Freno: lo vigila cada día. Memoria de errores: la cripto
              que el trading vende con pérdida queda vetada 30 días, y los clones lo heredan. La reserva es ganancia blindada: no
              se usa para rescatar. Resumen al móvil los lunes. Cesta: BTC, ETH, XRP, SOL, TRX, ZEC, HYPE, DOGE, LINK, ADA, XLM, BCH, NEAR, UNI y LTC.
            </p>
          </div>

          <div className="rounded-2xl border border-rule bg-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Últimas operaciones</h3>
            {robot.operaciones.length === 0 ? <p className="text-xs text-muted">Todavía ninguna.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] uppercase tracking-wider text-muted text-left">
                    <th className="py-1.5 pr-3 font-medium">Fecha</th><th className="py-1.5 pr-3 font-medium">Parte</th><th className="py-1.5 pr-3 font-medium">Operación</th>
                    <th className="py-1.5 pr-3 font-medium">Cripto</th><th className="py-1.5 pr-3 font-medium text-right">Importe</th><th className="py-1.5 font-medium text-right">Precio</th>
                  </tr></thead>
                  <tbody className="divide-y divide-rule">
                    {robot.operaciones.map((o, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 text-muted">{o.fecha}</td>
                        <td className="py-1.5 pr-3 text-muted">{o.parte === "nucleo" ? "Acumulación" : "Tendencia"}</td>
                        <td className={`py-1.5 pr-3 ${o.tipo === "compra" ? "text-ink" : "text-muted"}`}>{o.tipo === "compra" ? "Compra" : "Venta"}</td>
                        <td className="py-1.5 pr-3 font-semibold text-ink">{o.cripto}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{eur(o.importe)}</td>
                        <td className="py-1.5 text-right font-mono text-muted">{o.precio.toLocaleString("es-ES", { maximumFractionDigits: 4 })} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      </>}
    </Marco>
  );
}
