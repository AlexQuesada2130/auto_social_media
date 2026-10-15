"use client";

import { useMemo, useState } from "react";
import { tasaInteraccion, pesoConversacion, comoFue, CAMPOS_METRICA } from "@mesa/shared";
import Graficos from "./graficos";

/**
 * Qué tienen en común los que funcionaron.
 *
 * Con pocos posts esto no es estadística, es una pista. Por eso se dice cuántos
 * hay detrás de cada observación: con tres no se concluye nada.
 */
function patrones(publicados) {
  const con = publicados.filter((p) => tasaInteraccion(p.metricas) !== null);
  if (con.length < 3) return null;

  const ordenados = [...con].sort(
    (a, b) => tasaInteraccion(b.metricas) - tasaInteraccion(a.metricas),
  );
  const corte = Math.max(1, Math.round(ordenados.length / 3));
  const mejores = ordenados.slice(0, corte);
  const peores = ordenados.slice(-corte);

  const medir = (xs, f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;

  return {
    n: con.length,
    tasaMedia: medir(con, (p) => tasaInteraccion(p.metricas)),
    largoMejores: Math.round(medir(mejores, (p) => p.texto.length)),
    largoPeores: Math.round(medir(peores, (p) => p.texto.length)),
    preguntaMejores: Math.round(100 * medir(mejores, (p) => (p.texto.includes("?") ? 1 : 0))),
    preguntaPeores: Math.round(100 * medir(peores, (p) => (p.texto.includes("?") ? 1 : 0))),
    listaMejores: Math.round(100 * medir(mejores, (p) => (/^\d\.-/m.test(p.texto) ? 1 : 0))),
    mejor: ordenados[0],
  };
}

export default function Resultados({ borradores, onGuardar }) {
  const [editando, setEditando] = useState(null);
  const [valores, setValores] = useState({});

  const publicados = useMemo(
    () => borradores.filter((b) => b.estado === "publicado" || b.metricas),
    [borradores],
  );
  const aprobados = useMemo(
    () => borradores.filter((b) => b.estado === "aprobado"),
    [borradores],
  );
  const p = useMemo(() => patrones(publicados), [publicados]);

  function abrir(b) {
    setEditando(b.id);
    setValores(b.metricas || {});
  }

  async function guardar(id) {
    await onGuardar(id, { metricas: valores, publicadoEl: new Date().toISOString() });
    setEditando(null);
    setValores({});
  }

  const sinMedir = publicados.filter((b) => !tasaInteraccion(b.metricas));
  const medidos = publicados.filter((b) => tasaInteraccion(b.metricas) !== null);

  const tarjeta = (b) => {
    const t = tasaInteraccion(b.metricas);
    const conv = pesoConversacion(b.metricas);
    const v = comoFue(b.metricas);
    const abierto = editando === b.id;
    return (
      <article key={b.id} className={`card medido ${v.nivel}`}>
        <div className="card-top">
          <span className={`badge m-${v.nivel}`}>{v.etiqueta}</span>
          {t !== null && <span className="tasa">{t.toFixed(1)}% interacción</span>}
        </div>
        <div className="preview">
          <p className="post-text">{b.titulo || b.texto.split("\n")[0]}</p>

          {abierto ? (
            <div className="metricas-form">
              {CAMPOS_METRICA.map((c) => (
                <label key={c.id} className="campo-metrica">
                  <span>{c.nombre}<small>{c.ayuda}</small></span>
                  <input
                    id={`m-${b.id}-${c.id}`} type="number" min="0" inputMode="numeric"
                    value={valores[c.id] ?? ""}
                    onChange={(e) => setValores((x) => ({ ...x, [c.id]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          ) : b.metricas ? (
            <div className="metricas-vista">
              {CAMPOS_METRICA.map((c) => (
                <div key={c.id}>
                  <b>{b.metricas[c.id] ?? "—"}</b>
                  <span>{c.nombre}</span>
                </div>
              ))}
            </div>
          ) : null}

          {conv !== null && conv > 0 && !abierto && (
            <p className="estado-pie">
              {conv.toFixed(0)} comentarios por cada 100 reacciones.
              {conv >= 15 ? " Buena señal: generó conversación, no solo aprobación." : ""}
            </p>
          )}
        </div>
        <div className="actions">
          {abierto ? (
            <>
              <button className="btn primary" onClick={() => guardar(b.id)}>Guardar</button>
              <button className="btn ghost" onClick={() => setEditando(null)}>Cancelar</button>
            </>
          ) : (
            <button className="btn" onClick={() => abrir(b)}>
              {b.metricas ? "Actualizar cifras" : "Apuntar cifras"}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="resultados">
      <div className="doble-panel">
        <div className="panel">
          <h2 className="panel-titulo">
            Por medir
            {sinMedir.length > 0 && <span className="panel-cuenta">{sinMedir.length}</span>}
          </h2>
          {sinMedir.length === 0 ? (
            <p className="panel-vacio">
              Nada esperando cifras. Cuando marques un post como publicado,
              aparecerá aquí.
            </p>
          ) : (
            <div className="queue">{sinMedir.map(tarjeta)}</div>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-titulo">
            Medidos
            {medidos.length > 0 && <span className="panel-cuenta">{medidos.length}</span>}
          </h2>
          {medidos.length === 0 ? (
            <p className="panel-vacio">
              Apunta las cifras de la izquierda y los posts pasarán a este lado.
            </p>
          ) : (
            <div className="queue">{medidos.map(tarjeta)}</div>
          )}
        </div>
      </div>

      <h2 className="titulo-lista">Gráficos</h2>
      <Graficos publicados={publicados} />

      {p ? (
        <div className="panel-patrones">
          <h2>Lo que te está funcionando</h2>
          <p className="aviso-muestra">
            Sobre {p.n} posts con datos. Con menos de diez, esto son pistas, no
            conclusiones.
          </p>
          <ul className="patrones">
            <li>
              <b>{p.tasaMedia.toFixed(1)}%</b> de interacción media.
              {p.tasaMedia >= 3 ? " Por encima de lo normal en LinkedIn." : " Hay margen."}
            </li>
            <li>
              Tus mejores posts rondan los <b>{p.largoMejores}</b> caracteres;
              los peores, <b>{p.largoPeores}</b>.
              {Math.abs(p.largoMejores - p.largoPeores) > 300
                ? p.largoMejores < p.largoPeores
                  ? " Te funciona lo corto."
                  : " Te funciona lo largo."
                : " La longitud no parece decidir nada."}
            </li>
            <li>
              Acaban con pregunta el <b>{p.preguntaMejores}%</b> de los mejores
              y el <b>{p.preguntaPeores}%</b> de los peores.
            </li>
            <li>
              El <b>{p.listaMejores}%</b> de los mejores lleva lista numerada.
            </li>
          </ul>
        </div>
      ) : (
        <div className="note">
          <b>Aún no hay con qué comparar</b>
          Apunta las cifras de al menos tres posts publicados y empezaré a
          decirte qué tienen en común los que funcionan.
        </div>
      )}

      {aprobados.length > 0 && (
        <div className="recordatorio">
          Tienes <b>{aprobados.length}</b> aprobado{aprobados.length > 1 ? "s" : ""} sin
          publicar. Cuando lo publiques, vuelve y apunta las cifras.
        </div>
      )}

    </section>
  );
}
