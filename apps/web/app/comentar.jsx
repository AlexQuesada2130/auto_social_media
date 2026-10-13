"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Comentar en posts de otros.
 *
 * Pegas el post ajeno y se queda esperando. La rutina, en su siguiente pasada,
 * redacta el comentario y lo devuelve aquí. Por eso funciona con el Mac
 * apagado: lo escribe la misma rutina que ya escribe tus posts, sin coste.
 */
export default function Comentar() {
  const [lista, setLista] = useState([]);
  const [post, setPost] = useState("");
  const [de, setDe] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/comentarios", { cache: "no-store" });
      if (!r.ok) throw new Error("No se pudo cargar");
      setLista((await r.json()).comentarios || []);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function anadir(e) {
    e.preventDefault();
    const texto = post.trim();
    if (!texto) return;
    setGuardando(true);
    setError("");
    const r = await fetch("/api/comentarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postAjeno: texto, de: de.trim() }),
    });
    setGuardando(false);
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error || "No se pudo guardar");
      return;
    }
    setPost(""); setDe("");
    cargar();
  }

  async function copiar(c) {
    try {
      await navigator.clipboard.writeText(c.comentario);
      setCopiado(c.id);
      setTimeout(() => setCopiado(null), 1600);
    } catch { /* bloqueado por el navegador */ }
  }

  const esperando = lista.filter((c) => !c.comentario);
  const listos = lista.filter((c) => c.comentario);

  return (
    <section className="comentar">
      <form className="echar" onSubmit={anadir}>
        <label htmlFor="post-ajeno" className="echar-label">
          UN POST DE OTRO AL QUE QUIERES ENTRAR
        </label>
        <textarea
          id="post-ajeno" value={post} onChange={(e) => setPost(e.target.value)}
          placeholder="Pega aquí el post entero. Cuanto más completo, mejor sale el comentario."
        />
        <input
          id="autor" type="text" value={de} onChange={(e) => setDe(e.target.value)}
          placeholder="De quién es (opcional)"
        />
        <div className="echar-pie">
          <span className="estado-pie">Lo redacta la rutina en su próxima pasada.</span>
          <button className="btn primary" disabled={guardando || !post.trim()}>
            {guardando ? "Guardando…" : "A la cola"}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {esperando.length > 0 && (
        <>
          <h2 className="titulo-lista">Esperando comentario ({esperando.length})</h2>
          <div className="queue">
            {esperando.map((c) => (
              <article key={c.id} className="card is-pendiente">
                <div className="card-top">
                  <span className="badge pendiente">en cola</span>
                  <span className="origin">{c.de || "sin autor"}</span>
                </div>
                <p className="resumen">
                  {c.postAjeno.replace(/\n+/g, " ").slice(0, 150)}…
                </p>
              </article>
            ))}
          </div>
        </>
      )}

      <h2 className="titulo-lista">Listos para pegar</h2>
      {listos.length === 0 ? (
        <div className="note">
          <b>Todavía nada redactado</b>
          Pega arriba un post que te interese y la rutina te devolverá el
          comentario. Comentar bien en posts de otros rinde más que publicar.
        </div>
      ) : (
        <div className="queue">
          {listos.map((c) => (
            <article key={c.id} className={`card ${c.usado ? "is-descartado" : "is-aprobado"}`}>
              <div className="card-top">
                <span className={`badge ${c.usado ? "descartado" : "aprobado"}`}>
                  {c.usado ? "usado" : "listo"}
                </span>
                <span className="origin">{c.de || "sin autor"}</span>
              </div>
              <div className="preview">
                <p className="estado-pie">Sobre: {c.postAjeno.replace(/\n+/g, " ").slice(0, 90)}…</p>
                <p className="post-text" style={{ marginTop: 10 }}>{c.comentario}</p>
              </div>
              <div className="actions">
                <button className="btn primary" onClick={() => copiar(c)}>
                  {copiado === c.id ? "Copiado ✓" : "Copiar"}
                </button>
                <button
                  className="btn" onClick={async () => {
                    await fetch("/api/comentarios", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: c.id, usado: !c.usado }),
                    });
                    cargar();
                  }}
                >
                  {c.usado ? "Marcar sin usar" : "Ya comentado"}
                </button>
                <button
                  className="btn ghost" onClick={async () => {
                    await fetch(`/api/comentarios?id=${c.id}`, { method: "DELETE" });
                    cargar();
                  }}
                >
                  Borrar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
