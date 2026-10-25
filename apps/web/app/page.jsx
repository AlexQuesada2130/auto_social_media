"use client";

// Panel de control: la pantalla que se ve al abrir la app.
// Una tarjeta por herramienta y, debajo, lo que afecta a todas (Face ID,
// bloqueo, salir). Para añadir una herramienta nueva: otra ruta y otra tarjeta.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCandado } from "./candado";

const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function resumenDinero(datos) {
  const hoy = new Date();
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  let ingresos = 0;
  let gastos = 0;
  for (const t of datos.transactions) {
    if (!t.date.startsWith(mes)) continue;
    if (t.type === "income") ingresos += t.amount;
    else gastos += t.amount;
  }
  return { ingresos, gastos, balance: ingresos - gastos };
}

export default function Panel() {
  const { datos, actualizar, cerrar, salir, faceId } = useCandado();
  const [pendientes, setPendientes] = useState(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    fetch("/api/drafts", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) cerrar();
        return r.ok ? r.json() : null;
      })
      .then((j) => j && setPendientes(j.borradores.filter((d) => (d.estado || "pendiente") === "pendiente").length))
      .catch(() => {});
  }, [cerrar]);

  const dinero = resumenDinero(datos);
  const minutos = datos.settings?.autoLockMinutes ?? 15;

  async function alternarFaceId() {
    setAviso("");
    try {
      if (faceId.activo) faceId.quitar();
      else await faceId.activar();
    } catch (e) {
      setAviso(e.message);
    }
  }

  return (
    <main className="wrap">
      <header className="masthead">
        <h1>Mesa</h1>
        <div className="tally">
          <button className="btn ghost estado-boton" onClick={cerrar}>Bloquear</button>
        </div>
      </header>

      <div className="hub-rejilla">
        <Link href="/linkedin" className="hub-tarjeta">
          <span className="hub-tipo">LinkedIn</span>
          <span className="hub-cifra">{pendientes ?? "—"}</span>
          <span className="hub-pie">
            {pendientes === null ? "Cargando la cola…" : pendientes === 1 ? "propuesta pendiente" : "propuestas pendientes"}
          </span>
        </Link>

        <Link href="/dinero" className="hub-tarjeta">
          <span className="hub-tipo">Dinero</span>
          <span className={`hub-cifra${dinero.balance < 0 ? " hub-rojo" : ""}`}>
            {dinero.balance > 0 ? "+" : ""}{eur(dinero.balance)}
          </span>
          <span className="hub-pie">
            balance de este mes · {eur(dinero.ingresos)} entran, {eur(dinero.gastos)} salen
          </span>
        </Link>
      </div>

      <section className="hub-ajustes">
        <h2>Seguridad</h2>
        {faceId.disponible && (
          <div className="hub-fila">
            <div>
              <b>Face ID</b>
              <span>{faceId.activo ? "Abre la app y descifra tu dinero." : "Entra sin escribir la contraseña."}</span>
            </div>
            <button className={`btn${faceId.activo ? "" : " primary"}`} onClick={alternarFaceId}>
              {faceId.activo ? "Desactivar" : "Activar"}
            </button>
          </div>
        )}
        {aviso && <p className="error">{aviso}</p>}
        <div className="hub-fila">
          <div>
            <b>Bloqueo automático</b>
            <span>Sin actividad, o con la app en segundo plano, se cierra todo.</span>
          </div>
          <select
            value={minutos}
            aria-label="Minutos hasta el bloqueo"
            onChange={(e) => {
              const n = Number(e.target.value);
              actualizar((d) => ({ ...d, settings: { ...d.settings, autoLockMinutes: n } }));
            }}
          >
            {[1, 5, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
        <div className="hub-fila">
          <div>
            <b>Cerrar sesión</b>
            <span>Bloquea y además olvida la sesión de este dispositivo.</span>
          </div>
          <button className="btn ghost" onClick={salir}>Salir</button>
        </div>
      </section>
    </main>
  );
}
