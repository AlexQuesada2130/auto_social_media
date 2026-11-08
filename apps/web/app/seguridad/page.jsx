"use client";

// Seguridad: Face ID, bloqueo automático y cerrar sesión, en su propia
// pantalla (antes ocupaba medio Inicio).

import { useState } from "react";
import Link from "next/link";
import { useCandado } from "../candado";
import { BotonCandado } from "../nav-global";

export default function Seguridad() {
  const { datos, actualizar, salir, faceId } = useCandado();
  const [aviso, setAviso] = useState("");
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
        <h1>Seguridad</h1>
        <div className="tally"><Link href="/" className="btn ghost estado-boton">Volver</Link></div>
        <BotonCandado />
      </header>
      <section className="hub-ajustes">
        {faceId.disponible ? (
          <div className="hub-fila">
            <div>
              <b>Face ID</b>
              <span>{faceId.activo ? "Abre la app y descifra tu dinero." : "Entra sin escribir la contraseña."}</span>
            </div>
            <button className={`btn${faceId.activo ? "" : " primary"}`} onClick={alternarFaceId}>
              {faceId.activo ? "Desactivar" : "Activar"}
            </button>
          </div>
        ) : (
          <div className="hub-fila"><div><b>Face ID</b><span>Este dispositivo no lo ofrece al navegador.</span></div></div>
        )}
        {aviso && <p className="error">{aviso}</p>}
        <div className="hub-fila">
          <div>
            <b>Bloqueo automático</b>
            <span>Sin actividad, o con la app en segundo plano, se cierra todo.</span>
          </div>
          <select value={minutos} aria-label="Minutos hasta el bloqueo"
            onChange={(e) => { const n = Number(e.target.value); actualizar((d) => ({ ...d, settings: { ...d.settings, autoLockMinutes: n } })); }}>
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
