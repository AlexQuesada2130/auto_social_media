"use client";

import { useCallback, useEffect, useState } from "react";

const SEMAFORO = {
  bien: { punto: "ok", texto: "Funcionando" },
  aviso: { punto: "aviso", texto: "Atención" },
  parado: { punto: "mal", texto: "Parado" },
  "sin estrenar": { punto: "aviso", texto: "Sin estrenar" },
};

/** El puente vive en el Mac, así que solo lo puede comprobar el navegador. */
function usarPuente() {
  const [chat, setChat] = useState({ estado: "comprobando", detalle: "" });

  useEffect(() => {
    const url = localStorage.getItem("mesa.puente") || "http://192.168.1.29:3200";
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 3000);
    fetch(`${url.replace(/\/$/, "")}/salud`, { signal: corte.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setChat({ estado: "bien", detalle: "el puente del Mac responde" }))
      .catch(() =>
        setChat({
          estado: "parado",
          detalle: "no responde: el Mac está apagado, fuera de la red, o sin puente.py",
        }),
      )
      .finally(() => clearTimeout(reloj));
    return () => { clearTimeout(reloj); corte.abort(); };
  }, []);

  return chat;
}

export default function Estado({ onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [suscribiendo, setSuscribiendo] = useState(false);
  const chat = usarPuente();

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/estado", { cache: "no-store" });
      if (!r.ok) throw new Error("no se pudo leer el estado");
      setDatos(await r.json());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function activarAvisos() {
    setSuscribiendo(true);
    setError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Este navegador no admite notificaciones. En iPhone hay que añadir la app a la pantalla de inicio primero.");
      }
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") throw new Error("No diste permiso de notificaciones");

      const reg = await navigator.serviceWorker.ready;
      const { clavePublica } = await (await fetch("/api/push/web")).json();
      if (!clavePublica) throw new Error("El servidor no tiene claves VAPID configuradas");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: clavePublica,
      });
      const r = await fetch("/api/push/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!r.ok) throw new Error("El servidor rechazó la suscripción");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
    setSuscribiendo(false);
  }

  const filas = datos ? [
    { nombre: "Almacén", ...datos.almacen },
    { nombre: "Notificaciones", ...datos.avisos },
    { nombre: "Generador de propuestas", ...datos.generador },
    { nombre: "Chat con Claude", ...chat },
  ] : [];

  return (
    <section className="estado">
      <div className="estado-top">
        <h2>Estado del servicio</h2>
        <button className="btn ghost" onClick={onCerrar}>Cerrar</button>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="estado-lista">
        {filas.map((f) => {
          const s = SEMAFORO[f.estado] || { punto: "aviso", texto: f.estado };
          return (
            <li key={f.nombre} className="estado-fila">
              <span className={`punto ${s.punto}`} aria-hidden="true" />
              <span className="estado-nombre">{f.nombre}</span>
              <span className="estado-detalle">{f.detalle}</span>
            </li>
          );
        })}
        {!datos && !error && <li className="estado-detalle">Comprobando…</li>}
      </ul>

      {datos && (
        <>
          <div className="estado-cifras">
            <div><b>{datos.cola.pendientes}</b><span>pendientes</span></div>
            <div><b>{datos.cola.aprobados}</b><span>aprobados</span></div>
            <div><b>{datos.cola.total}</b><span>en total</span></div>
          </div>
          <p className="estado-pie">
            Versión <code>{datos.version}</code> · comprobado a las{" "}
            {new Date(datos.momento).toLocaleTimeString("es-ES")}
          </p>
        </>
      )}

      <button className="btn primary" onClick={activarAvisos} disabled={suscribiendo}>
        {suscribiendo ? "Activando…" : "Activar notificaciones en este dispositivo"}
      </button>
      <p className="estado-pie">
        En iPhone, primero añade la app a la pantalla de inicio desde Compartir.
        Safari no admite notificaciones desde una pestaña normal.
      </p>
    </section>
  );
}
