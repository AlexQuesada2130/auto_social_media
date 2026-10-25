"use client";

// La única puerta de la app.
//
// Una contraseña (o Face ID) abre las dos cosas a la vez:
//   - la sesión del servidor, que es lo que da acceso a la cola de LinkedIn;
//   - la bóveda del dinero, que se descifra aquí y no sale del dispositivo.
//
// Al cerrar (a mano o por inactividad) se olvida la clave del dinero de la
// memoria. La cookie de sesión se queda, como antes: lo que protege el
// candado es el dispositivo desbloqueado en manos de otro.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  hayBoveda, crearBoveda, abrirConPassword, abrirConPrf, guardar, cambiarPassword,
  datosFaceId, ponerFaceId, quitarFaceId, borrarBoveda, datosVacios,
} from "@/lib/boveda";
import { disponible, activar, desbloquear, olvidarAntiguo } from "./faceid";

const Contexto = createContext(null);

export function useCandado() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useCandado fuera de <Candado>");
  return c;
}

const ACTIVIDAD = ["pointerdown", "keydown", "scroll", "touchstart"];

export default function Candado({ children }) {
  const [estado, setEstado] = useState("comprobando"); // comprobando | cerrado | recifrar | abierto
  const [datos, setDatos] = useState(null);
  const [hayFaceId, setHayFaceId] = useState(false);
  const [faceIdOn, setFaceIdOn] = useState(false);
  const dek = useRef(null);
  const passwordNueva = useRef(null);
  const cola = useRef(Promise.resolve());

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app sigue funcionando; solo pierde el push.
      });
    }
    olvidarAntiguo();
    (async () => {
      setHayFaceId(await disponible());
      setFaceIdOn(Boolean(datosFaceId()));
      setEstado("cerrado");
    })();
  }, []);

  const abrirCon = useCallback((clave, d) => {
    dek.current = clave;
    passwordNueva.current = null;
    setDatos(d);
    setEstado("abierto");
  }, []);

  const cerrar = useCallback(() => {
    dek.current = null;
    setDatos(null);
    setFaceIdOn(Boolean(datosFaceId()));
    setEstado("cerrado");
  }, []);

  /** Entra con la contraseña de la app. Lanza Error con el motivo si falla. */
  const entrar = useCallback(async (password) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || "Contraseña incorrecta");
    }
    if (!hayBoveda()) {
      const d = datosVacios();
      abrirCon(await crearBoveda(password, d), d);
      return;
    }
    try {
      const { dek: clave, datos: d } = await abrirConPassword(password);
      abrirCon(clave, d);
    } catch {
      // El servidor la aceptó pero la bóveda no: la contraseña de la app
      // cambió desde la última vez en este dispositivo.
      passwordNueva.current = password;
      setEstado("recifrar");
    }
  }, [abrirCon]);

  /** Tras un cambio de contraseña: abre con la vieja y re-envuelve con la nueva. */
  const recifrar = useCallback(async (antigua) => {
    const { dek: clave, datos: d } = await abrirConPassword(antigua);
    await cambiarPassword(clave, passwordNueva.current);
    abrirCon(clave, d);
  }, [abrirCon]);

  /** Último recurso si no recuerda la contraseña antigua. */
  const empezarDeCero = useCallback(async () => {
    borrarBoveda();
    const d = datosVacios();
    abrirCon(await crearBoveda(passwordNueva.current, d), d);
  }, [abrirCon]);

  const entrarConCara = useCallback(async () => {
    let sesion = false;
    try { sesion = (await (await fetch("/api/auth")).json()).sesion; } catch {}
    if (!sesion) throw new Error("La sesión ha caducado. Entra con la contraseña.");
    const llave = datosFaceId();
    const secreto = llave && (await desbloquear(llave));
    if (!secreto) throw new Error("Face ID no lo dio por bueno. Inténtalo otra vez o usa la contraseña.");
    const { dek: clave, datos: d } = await abrirConPrf(secreto);
    abrirCon(clave, d);
  }, [abrirCon]);

  const activarFaceId = useCallback(async () => {
    const r = await activar();
    await ponerFaceId(dek.current, r);
    setFaceIdOn(true);
  }, []);

  const quitarCara = useCallback(() => {
    quitarFaceId();
    setFaceIdOn(false);
  }, []);

  const salir = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    cerrar();
  }, [cerrar]);

  /** Cambia los datos del dinero y los vuelve a cifrar. */
  const actualizar = useCallback((fn) => {
    setDatos((prev) => {
      const sig = { ...fn(prev), updatedAt: new Date().toISOString() };
      // En cola, para que un guardado lento nunca pise a uno posterior.
      cola.current = cola.current
        .then(() => dek.current && guardar(dek.current, sig))
        .catch((e) => console.error("No se pudo guardar la bóveda", e));
      return sig;
    });
  }, []);

  // Bloqueo por inactividad, también si la app pasa tiempo en segundo plano.
  // Sin opción de "nunca": con el dinero dentro, la app no se queda abierta
  // indefinidamente. Una copia vieja con 0 cae en el valor por defecto.
  const minutos = datos?.settings?.autoLockMinutes || 15;
  useEffect(() => {
    if (estado !== "abierto") return;
    const limite = minutos * 60_000;
    let timer;
    let oculto = 0;
    const reiniciar = () => {
      clearTimeout(timer);
      timer = setTimeout(cerrar, limite);
    };
    const visibilidad = () => {
      if (document.hidden) oculto = Date.now();
      else if (oculto && Date.now() - oculto > limite) cerrar();
      else reiniciar();
    };
    reiniciar();
    ACTIVIDAD.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    document.addEventListener("visibilitychange", visibilidad);
    return () => {
      clearTimeout(timer);
      ACTIVIDAD.forEach((e) => window.removeEventListener(e, reiniciar));
      document.removeEventListener("visibilitychange", visibilidad);
    };
  }, [estado, minutos, cerrar]);

  const valor = {
    datos, actualizar, cerrar, salir,
    faceId: { disponible: hayFaceId, activo: faceIdOn, activar: activarFaceId, quitar: quitarCara },
  };

  if (estado === "comprobando") {
    return <main className="wrap"><div className="note">Comprobando…</div></main>;
  }
  if (estado === "recifrar") {
    return <Recifrar onRecifrar={recifrar} onDeCero={empezarDeCero} onVolver={cerrar} />;
  }
  if (estado !== "abierto") {
    return (
      <Puerta
        onEntrar={entrar}
        onCara={faceIdOn ? entrarConCara : null}
      />
    );
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function Puerta({ onEntrar, onCara }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function intentar(fn) {
    setOcupado(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setOcupado(false);
    }
  }

  return (
    <main className="wrap">
      <form className="gate" onSubmit={(e) => { e.preventDefault(); intentar(() => onEntrar(password)); }}>
        <h1>Mesa</h1>
        <p>Una contraseña para todo: la cola de LinkedIn y tu dinero.</p>
        {onCara && (
          <button type="button" className="btn primary" disabled={ocupado} onClick={() => intentar(onCara)}>
            Desbloquear con Face ID
          </button>
        )}
        <input
          id="password" type="password" value={password} autoFocus={!onCara}
          autoComplete="current-password" aria-label="Contraseña" placeholder={onCara ? "O con la contraseña" : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <span className="error">{error}</span>}
        <button className={`btn${onCara ? "" : " primary"}`} disabled={ocupado || !password}>
          {ocupado ? "Abriendo…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function Recifrar({ onRecifrar, onDeCero, onVolver }) {
  const [antigua, setAntigua] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");

  return (
    <main className="wrap">
      <form
        className="gate"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setError("");
          try { await onRecifrar(antigua); } catch (err) { setError(err.message); setOcupado(false); }
        }}
      >
        <h1>La contraseña ha cambiado</h1>
        <p>
          Tu dinero en este dispositivo sigue cifrado con la contraseña anterior.
          Escríbela una vez y queda cifrado con la nueva.
        </p>
        <input
          type="password" value={antigua} autoFocus autoComplete="off"
          aria-label="Contraseña anterior" placeholder="Contraseña anterior"
          onChange={(e) => setAntigua(e.target.value)}
        />
        {error && <span className="error">{error}</span>}
        <button className="btn primary" disabled={ocupado || !antigua}>
          {ocupado ? "Cifrando…" : "Volver a cifrar"}
        </button>
        <button type="button" className="btn ghost" onClick={onVolver}>Cancelar</button>

        {!borrando ? (
          <button type="button" className="btn ghost" onClick={() => setBorrando(true)}>
            No la recuerdo
          </button>
        ) : (
          <>
            <p className="error">
              Sin la contraseña anterior, el dinero de este dispositivo no se puede abrir. Puedes
              empezar de cero e importar después una copia exportada. Escribe BORRAR para confirmar.
            </p>
            <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} aria-label="Confirmación" />
            <button type="button" className="btn" disabled={confirmacion !== "BORRAR"} onClick={onDeCero}>
              Borrar el dinero de este dispositivo
            </button>
          </>
        )}
      </form>
    </main>
  );
}
