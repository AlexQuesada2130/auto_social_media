"use client";

import { useCallback, useEffect, useState } from "react";
import { partirPorPliegue, revisar, LIMITE_CARACTERES, URL_COMPOSITOR } from "@mesa/shared";
import Estado from "./estado";

const YO = {
  nombre: "Alejandro Gabriel Quesada Sánchez",
  rol: "Desarrollador & Especialista en Automatización | Consultor Comercial IT",
  iniciales: "AQ",
};

const HERRAMIENTAS = [
  { tipo: "Imagen", nombre: "Gemini", que: "Hasta 100 al día, 4K", url: "https://gemini.google.com/" },
  { tipo: "Imagen", nombre: "Bing Creator", que: "DALL·E 3, sin límite", url: "https://www.bing.com/images/create" },
  { tipo: "Imagen", nombre: "Leonardo", que: "150 créditos diarios", url: "https://leonardo.ai/" },
  { tipo: "Vídeo", nombre: "Kling AI", que: "66 créditos al día", url: "https://klingai.com/" },
  { tipo: "Vídeo", nombre: "Luma", que: "30 clips al mes", url: "https://lumalabs.ai/dream-machine" },
  { tipo: "Vídeo", nombre: "CapCut", que: "Edición, sin límite", url: "https://www.capcut.com/" },
];

const VACIO = {
  pendiente: ["Nada pendiente", "Cuando haya propuestas nuevas aparecerán aquí."],
  aprobado: ["Nada aprobado", "Lo que apruebes se queda aquí, listo para publicar."],
  descartado: ["Nada descartado", "Lo que rechaces se guarda por si cambias de idea."],
};

export default function Pagina() {
  const [sesion, setSesion] = useState(null); // null = comprobando
  const [borradores, setBorradores] = useState([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [editando, setEditando] = useState({});
  const [error, setError] = useState("");
  const [idea, setIdea] = useState("");
  const [guardandoIdea, setGuardandoIdea] = useState(false);
  const [verEstado, setVerEstado] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/drafts", { cache: "no-store" });
    if (res.status === 401) { setSesion(false); return; }
    if (!res.ok) { setError("No se pudieron cargar los borradores"); return; }
    const { borradores } = await res.json();
    setBorradores(borradores);
    setSesion(true);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app sigue funcionando; solo pierde el push.
      });
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then(({ sesion }) => (sesion ? cargar() : setSesion(false)))
      .catch(() => setSesion(false));
  }, [cargar]);

  async function parchear(id, cambios) {
    const res = await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "No se pudo guardar");
      return;
    }
    setError("");
    cargar();
  }

  async function echarIdea(e) {
    e.preventDefault();
    const texto = idea.trim();
    if (!texto) return;
    setGuardandoIdea(true);
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, origen: "idea tuya" }),
    });
    setGuardandoIdea(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "No se pudo guardar la idea");
      return;
    }
    setIdea("");
    setError("");
    setFiltro("pendiente");
    cargar();
  }

  if (sesion === null) return <main className="wrap"><div className="note">Comprobando sesión…</div></main>;
  if (sesion === false) return <Puerta alEntrar={cargar} />;

  const visibles = borradores.filter((d) => (d.estado || "pendiente") === filtro);
  const nPend = borradores.filter((d) => (d.estado || "pendiente") === "pendiente").length;
  const nApro = borradores.filter((d) => d.estado === "aprobado").length;

  return (
    <main className="wrap">
      <header className="masthead">
        <h1>Mesa de Redacción</h1>
        <div className="tally">
          <span><b>{nPend}</b> pendientes</span>
          <span><b>{nApro}</b> aprobados</span>
          <button
            className="btn ghost estado-boton"
            onClick={() => setVerEstado((v) => !v)}
            aria-expanded={verEstado}
          >
            Estado
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {["pendiente", "aprobado", "descartado"].map((f) => (
          <button
            key={f} role="tab" className="tab" id={`tab-${f}`}
            aria-selected={filtro === f} onClick={() => setFiltro(f)}
          >
            {f === "pendiente" ? "Pendientes" : f === "aprobado" ? "Aprobados" : "Descartados"}
          </button>
        ))}
      </div>

      {verEstado && <Estado onCerrar={() => setVerEstado(false)} />}

      {error && <p className="error">{error}</p>}

      <form className="echar" onSubmit={echarIdea}>
        <label htmlFor="idea" className="echar-label">
          Algo que has visto o se te ha ocurrido
        </label>
        <textarea
          id="idea" value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder="Pega aquí un post que te haya llamado la atención, o escribe la idea en bruto. No hace falta que esté redactado."
        />
        <div className="echar-pie">
          <span className="counter">{idea.length} caracteres</span>
          <button className="btn primary" disabled={guardandoIdea || !idea.trim()}>
            {guardandoIdea ? "Guardando…" : "A la cola"}
          </button>
        </div>
      </form>

      <div className="queue">
        {visibles.length === 0 ? (
          <div className="note"><b>{VACIO[filtro][0]}</b>{VACIO[filtro][1]}</div>
        ) : (
          visibles.map((d) => (
            <Tarjeta
              key={d.id} borrador={d}
              editando={Object.prototype.hasOwnProperty.call(editando, d.id)}
              textoEditado={editando[d.id]}
              onEditar={(t) => setEditando((e) => ({ ...e, [d.id]: t }))}
              onCancelar={() => setEditando(({ [d.id]: _, ...r }) => r)}
              onGuardar={() => {
                const t = (editando[d.id] || "").trim();
                if (!t) return;
                setEditando(({ [d.id]: _, ...r }) => r);
                parchear(d.id, { texto: t });
              }}
              onEstado={(estado) => parchear(d.id, { estado })}
            />
          ))
        )}
      </div>

      <section className="toolbox">
        <h2>Para el visual</h2>
        <p>Los posts salen en texto. Cuando uno pida imagen o vídeo, aquí tienes las gratuitas.</p>
        <div className="tool-grid">
          {HERRAMIENTAS.map((t) => (
            <a key={t.nombre} className="tool" href={t.url} target="_blank" rel="noopener">
              <span className="kind">{t.tipo}</span>
              <span className="tool-name">{t.nombre}</span>
              <span className="tool-what">{t.que}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function Puerta({ alEntrar }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setEnviando(false);
    if (res.ok) alEntrar();
    else setError("Contraseña incorrecta");
  }

  return (
    <form className="gate" onSubmit={entrar}>
      <h1>Mesa de Redacción</h1>
      <p>Introduce la contraseña para ver la cola.</p>
      <input
        id="password" type="password" value={password} autoFocus
        autoComplete="current-password" aria-label="Contraseña"
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <span className="error">{error}</span>}
      <button className="btn primary" disabled={enviando || !password}>
        {enviando ? "Comprobando…" : "Entrar"}
      </button>
    </form>
  );
}

function Tarjeta({ borrador, editando, textoEditado, onEditar, onCancelar, onGuardar, onEstado }) {
  const [copiado, setCopiado] = useState(false);
  const estado = borrador.estado || "pendiente";
  const texto = editando ? textoEditado : borrador.texto || "";
  const [antes, despues] = partirPorPliegue(texto);
  const avisos = revisar(texto);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { /* el navegador lo bloqueó: queda el botón de LinkedIn */ }
  }

  const urlComponer = URL_COMPOSITOR + encodeURIComponent(texto);

  return (
    <article className={`card is-${estado}`}>
      <div className="card-top">
        <span className={`badge ${estado}`}>{estado}</span>
        <span className="origin">{borrador.origen || "propuesta"}</span>
      </div>

      <div className="preview">
        <div className="who">
          <div className="avatar">{YO.iniciales}</div>
          <div>
            <div className="who-name">{YO.nombre}</div>
            <div className="who-role">{YO.rol}</div>
          </div>
        </div>

        {editando ? (
          <>
            <textarea
              id={`ta-${borrador.id}`} value={textoEditado}
              aria-label="Texto del post"
              onChange={(e) => onEditar(e.target.value)}
            />
            <div className={`counter${textoEditado.length > LIMITE_CARACTERES ? " over" : ""}`}>
              {textoEditado.length} / {LIMITE_CARACTERES} caracteres
            </div>
          </>
        ) : (
          <>
            <p className="post-text">{antes}</p>
            {despues && <><div className="fold">pliegue · ver más</div><p className="post-text">{despues}</p></>}
            {avisos.length > 0 && (
              <div className="warns">
                Revisa antes de publicar:
                <ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
            {borrador.notaVisual && (
              <div className="visual-note"><b>Visual: </b>{borrador.notaVisual}</div>
            )}
          </>
        )}
      </div>

      <div className="actions">
        {editando ? (
          <>
            <button className="btn primary" onClick={onGuardar}>Guardar</button>
            <button className="btn ghost" onClick={onCancelar}>Cancelar</button>
          </>
        ) : (
          <>
            {estado !== "aprobado" && (
              <button className="btn primary" onClick={() => onEstado("aprobado")}>Aprobar</button>
            )}
            <button className="btn" onClick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>
            <a
              className="btn" target="_blank" rel="noopener" onClick={copiar}
              href={urlComponer.length <= 8000 ? urlComponer : "https://www.linkedin.com/feed/"}
            >
              Abrir LinkedIn
            </a>
            <button className="btn ghost" onClick={() => onEditar(borrador.texto || "")}>Editar</button>
            {estado === "descartado" ? (
              <button className="btn ghost" onClick={() => onEstado("pendiente")}>Recuperar</button>
            ) : (
              <button className="btn ghost" onClick={() => onEstado("descartado")}>Descartar</button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
