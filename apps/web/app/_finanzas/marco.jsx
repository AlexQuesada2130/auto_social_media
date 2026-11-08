"use client";

// Marco común de las secciones de finanzas (Inversiones, Gastos, Cripto):
// título, pestañas internas y el acceso a "Datos y copias". La navegación
// entre secciones la pone la barra global (app/nav-global.jsx).

import { useState } from "react";
import { lucide } from "./components";
import { AjustesDinero } from "./ajustes";
import { BotonCandado } from "../nav-global";
import "./finanzas.css";

export function Marco({ titulo, subtitulo, pestanas, activa, onPestana, children }) {
  const [ajustes, setAjustes] = useState(false);
  return (
    <div id="finanzas">
      <div className="mx-auto max-w-7xl px-4 lg:px-10 pt-5 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setAjustes(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-rule px-3 text-xs text-muted hover:text-ink" title="Exportar, importar y vaciar">
              <lucide.Settings size={14} /> Datos
            </button>
            <BotonCandado />
          </div>
        </div>
        {subtitulo && <p className="text-xs text-muted">{subtitulo}</p>}
      </div>
      {pestanas && (
        <div className="mx-auto max-w-7xl px-4 lg:px-10">
          <div className="flex gap-1 rounded-xl bg-card border border-rule p-1 w-full sm:w-fit overflow-x-auto">
            {pestanas.map((p) => (
              <button key={p.id} onClick={() => onPestana(p.id)}
                className={`flex-1 sm:flex-none whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition ${activa === p.id ? "bg-accent-bg text-accent" : "text-muted hover:text-ink"}`}>
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 lg:px-10 py-6 space-y-8">
        {children}
        <footer className="pt-6 pb-2 flex items-center gap-2 text-[11px] text-muted">
          <lucide.ShieldCheck size={12} />
          <span>Cifrado en este dispositivo · Uso personal · No constituye asesoramiento financiero</span>
        </footer>
      </main>
      {ajustes && <AjustesDinero onCerrar={() => setAjustes(false)} />}
    </div>
  );
}
