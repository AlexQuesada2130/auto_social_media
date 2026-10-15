"use client";

import { useCallback, useEffect, useState } from "react";
import { partirPorPliegue, revisar, LIMITE_CARACTERES, URL_COMPOSITOR, MOTIVOS_DESCARTE, tituloDe, diasParado, DIAS_PARA_AVISAR } from "@mesa/shared";
import Estado from "./estado";
import { disponible, activo, activar, desactivar, desbloquear } from "./faceid";
import Resultados from "./resultados";
import Nav from "./nav";
import Comentar from "./comentar";

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

const ESTADO_NOMBRE = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  descartado: "Descartado",
  publicado: "Publicado",
};

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
  const [vista, setVista] = useState("cola");
  const [bloqueado, setBloqueado] = useState(false);
  const [hayFaceId, setHayFaceId] = useState(false);
  const [faceIdOn, setFaceIdOn] = useState(false);

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
    (async () => {
      setHayFaceId(await disponible());
      setFaceIdOn(activo());
      let hay = false;
      try {
        hay = (await (await fetch("/api/auth")).json()).sesion;
      } catch { /* sin red: se pedirá la contraseña */ }

      if (!hay) return setSesion(false);
      if (activo()) {
        // La sesión existe pero no se abre hasta que lo autorice la cara.
        setBloqueado(true);
        setSesion(true);
        return;
      }
      cargar();
    })();
  }, [cargar]);

  async function abrirConCara() {
    if (await desbloquear()) {
      setBloqueado(false);
      setError("");
      cargar();
    } else {
      setError("Face ID no lo dio por bueno. Inténtalo otra vez o entra con la contraseña.");
    }
  }

  async function parchear(id, cambios) {
    const res = await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setError(error || "No se pudo guardar");
      throw new Error(error || "No se pudo guardar");
    }
    setError("");
    await cargar();
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
  if (sesion === false) return <Puerta alEntrar={cargar} hayFaceId={hayFaceId} />;

  if (bloqueado) {
    return (
      <main className="wrap">
        <form className="gate" onSubmit={(e) => { e.preventDefault(); abrirConCara(); }}>
          <h1>Mesa de Redacción</h1>
          <p>Tu sesión está guardada. Desbloquéala con Face ID.</p>
          {error && <span className="error">{error}</span>}
          <button className="btn primary" type="submit">Desbloquear con Face ID</button>
          <button
            type="button" className="btn ghost"
            onClick={async () => {
              desactivar();
              setFaceIdOn(false);
              await fetch("/api/auth", { method: "DELETE" });
              setBloqueado(false);
              setSesion(false);
            }}
          >
            Entrar con la contraseña
          </button>
        </form>
      </main>
    );
  }

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
          {hayFaceId && (
            <button
              className="btn ghost estado-boton"
              style={faceIdOn ? { color: "var(--accent)", fontWeight: 700 } : undefined}
              onClick={async () => {
                if (faceIdOn) { desactivar(); setFaceIdOn(false); return; }
                try { await activar(); setFaceIdOn(true); setError(""); }
                catch (e) { setError(e.message); }
              }}
            >
              Face ID
            </button>
          )}
        </div>
      </header>

      {vista === "resultados" && (
        <Resultados borradores={borradores} onGuardar={parchear} />
      )}
      {vista === "estado" && <Estado onCerrar={() => setVista("cola")} />}
      {vista === "comentar" && <Comentar />}

      {vista === "cola" && (<>
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
              onCampo={parchear}
            />
          ))
        )}
      </div>

      </>)}

      <Nav activa={vista} onCambiar={setVista} pendientes={nPend} />

      {vista === "cola" && (
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
      )}
    </main>
  );
}

function Puerta({ alEntrar, hayFaceId }) {
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
    if (!res.ok) return setError("Contraseña incorrecta");
    if (hayFaceId && !activo()) {
      // Se propone ahora, no antes: aquí ya se entiende para qué sirve.
      try { await activar(); } catch { /* si dice que no, se entra igual */ }
    }
    alEntrar();
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

function Tarjeta({ borrador, editando, textoEditado, onEditar, onCancelar, onGuardar, onEstado, onCampo }) {
  const [copiado, setCopiado] = useState(false);
  const [copiadoVisual, setCopiadoVisual] = useState(false);
  const [preguntandoMotivo, setPreguntandoMotivo] = useState(false);
  const [notas, setNotas] = useState(borrador.notas || "");
  const [verNotas, setVerNotas] = useState(Boolean(borrador.notas));
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [notaGuardada, setNotaGuardada] = useState(false);
  const [errorNota, setErrorNota] = useState("");
  // Las tarjetas nacen plegadas: con veinte en la cola, desplegadas no se
  // pueden recorrer. Se ve el titulo y el arranque, y se abre lo que interesa.
  const [desplegado, setDesplegado] = useState(false);
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
        <span className={`badge ${estado}`}>{ESTADO_NOMBRE[estado] || estado}</span>
        <span className="origin">{borrador.origen || "propuesta"}</span>
        {borrador.notas && <span className="nota-chip">Con nota</span>}
        {(diasParado(borrador) ?? 0) >= DIAS_PARA_AVISAR && (
          <span className="parado-chip">{diasParado(borrador)} días sin publicar</span>
        )}
      </div>

      <button
        className="titulo-tarjeta"
        onClick={() => setDesplegado((d) => !d)}
        aria-expanded={desplegado}
      >
        <span>{borrador.titulo || tituloDe(borrador.texto || "")}</span>
        <span className="chevron" aria-hidden="true">{desplegado ? "▲" : "▼"}</span>
      </button>

      {(desplegado || editando) && (
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
            {despues && <><div className="fold">Pliegue · ver más</div><p className="post-text">{despues}</p></>}
            {avisos.length > 0 && (
              <div className="warns">
                Revisa antes de publicar:
                <ul>{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
            {borrador.promptVisual && (
              <div className="visual-prompt">
                <div className="visual-top">
                  <span>Prompt para la imagen</span>
                  <button
                    className="btn ghost mini"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(borrador.promptVisual);
                        setCopiadoVisual(true);
                        setTimeout(() => setCopiadoVisual(false), 1600);
                      } catch { /* el navegador lo bloqueó */ }
                    }}
                  >
                    {copiadoVisual ? "Copiado ✓" : "Copiar"}
                  </button>
                </div>
                <p>{borrador.promptVisual}</p>
                <div className="visual-enlaces">
                  <a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini</a>
                  <a href="https://www.bing.com/images/create" target="_blank" rel="noopener">Bing</a>
                  <a href="https://klingai.com/" target="_blank" rel="noopener">Kling</a>
                </div>
              </div>
            )}
            {borrador.notaVisual && !borrador.promptVisual && (
              <div className="visual-note"><b>Visual: </b>{borrador.notaVisual}</div>
            )}
          </>
        )}
      </div>
      )}

      {!desplegado && !editando && (
        <p className="resumen" onClick={() => setDesplegado(true)}>
          {(borrador.texto || "").replace(/\n+/g, " ")}
        </p>
      )}

      {verNotas && (
        <div className="notas">
          <label htmlFor={`n-${borrador.id}`}>Qué quieres que cambie</label>
          <textarea
            id={`n-${borrador.id}`} value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Acórtalo. Cambia el gancho. Quítale el final."
          />
          <div className="notas-pie">
            <span className={`estado-pie${errorNota ? " nota-error" : ""}`}>
              {errorNota
              || (notaGuardada ? "Guardada. La leeré y reescribiré esta propuesta."
              : "La leeré y reescribiré esta propuesta.")}
            </span>
            <button
              className={`btn mini${notaGuardada ? " nota-ok" : ""}`}
              disabled={guardandoNota || notas.trim() === (borrador.notas || "")}
              onClick={async () => {
              setGuardandoNota(true);
              setErrorNota("");
              try {
              await onCampo(borrador.id, { notas: notas.trim() });
              setNotaGuardada(true);
              setTimeout(() => setNotaGuardada(false), 2500);
            } catch (e) {
            setErrorNota("No se pudo guardar. Inténtalo otra vez.");
          }
          setGuardandoNota(false);
        }}
        >
        {guardandoNota ? "Guardando…" : notaGuardada ? "Guardada ✓" : "Guardar nota"}
        </button>
        </div>
        </div>
      )}

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
            {estado === "aprobado" && (
              <button
                className="btn publicada"
                onClick={() => onEstado("publicado")}
                title="Márcalo cuando lo hayas publicado en LinkedIn"
              >
                Ya publicada
              </button>
            )}
            <button
              className={`btn ghost${borrador.notas ? " con-nota" : ""}`}
              onClick={() => {
                // Abrir la tarjeta al pedir cambios: hay que ver el texto que
                // estás pidiendo cambiar.
                if (!verNotas) setDesplegado(true);
                setVerNotas((v) => !v);
              }}
              aria-expanded={verNotas}
            >
              {borrador.notas ? "Nota ✓" : "Pedir cambios"}
            </button>
            {estado === "descartado" ? (
              <button className="btn ghost" onClick={() => onEstado("pendiente")}>Recuperar</button>
            ) : (
              <button className="btn ghost" onClick={() => setPreguntandoMotivo(true)}>Descartar</button>
            )}
          </>
        )}
      </div>

      {preguntandoMotivo && (
        <div className="motivos">
          <span>¿Por qué lo descartas? Así dejo de traerte lo mismo.</span>
          <div className="motivos-botones">
            {MOTIVOS_DESCARTE.map((m) => (
              <button
                key={m.id} className="btn mini"
                onClick={() => {
                  setPreguntandoMotivo(false);
                  onCampo(borrador.id, { estado: "descartado", motivoDescarte: m.id });
                }}
              >
                {m.nombre}
              </button>
            ))}
          </div>
          <button className="btn ghost mini" onClick={() => setPreguntandoMotivo(false)}>
            Cancelar
          </button>
        </div>
      )}
    </article>
  );
}
