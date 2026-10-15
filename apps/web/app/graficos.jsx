"use client";

import { useId, useState } from "react";
import { tasaInteraccion } from "@mesa/shared";

/**
 * Gráficos de rendimiento.
 *
 * Dos formas, elegidas por el trabajo de cada dato:
 *
 * - Tasa de interacción por post: comparar magnitudes. Barras ordenadas, todas
 *   del mismo violeta. Los posts son categorías nominales (cambiar su orden no
 *   cambia el significado), así que colorearlas por su valor gastaría el canal
 *   de identidad para no decir nada que la longitud no diga ya.
 *
 * - Composición de la interacción: parte y todo. Barra apilada con tres
 *   categorías reales, cada una con su color.
 *
 * Las paletas están validadas con el comprobador: separación bajo daltonismo,
 * mínimo de croma y contraste sobre el fondo, en claro y en oscuro por separado.
 */

const SERIES = [
  { id: "reacciones", nombre: "Reacciones" },
  { id: "comentarios", nombre: "Comentarios" },
  { id: "compartidos", nombre: "Compartidos" },
];

const corto = (t) => {
  const l = (t || "").split("\n")[0];
  return l.length > 34 ? l.slice(0, 33) + "…" : l;
};

/** Barras ordenadas: tasa de interacción por post. */
function BarrasTasa({ datos }) {
  const [sobre, setSobre] = useState(null);
  const tope = Math.max(...datos.map((d) => d.tasa), 1);
  const alto = 22;
  const hueco = 14;

  return (
    <figure className="grafico">
      <figcaption>
        <h3>Interacción por post</h3>
        <p>Qué porcentaje de quien lo vio hizo algo. Media de LinkedIn: 2-3%.</p>
      </figcaption>

      <div className="barras" role="img"
           aria-label={`Tasa de interacción de ${datos.length} posts, de ${datos[0].tasa.toFixed(1)}% a ${datos[datos.length-1].tasa.toFixed(1)}%`}>
        {datos.map((d, i) => {
          const ancho = (d.tasa / tope) * 100;
          const destacado = sobre === null || sobre === i;
          return (
            <div
              key={d.id} className="barra-fila"
              onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)}
              style={{ marginBottom: i === datos.length - 1 ? 0 : hueco }}
            >
              <span className="barra-etiqueta" title={d.titulo}>{corto(d.titulo)}</span>
              <div className="barra-pista">
                <div
                  className="barra-marca"
                  style={{
                    width: `${Math.max(ancho, 1.5)}%`,
                    height: alto,
                    opacity: destacado ? 1 : 0.45,
                  }}
                />
                {/* Solo se etiqueta el extremo, no todos: un número en cada
                    barra se convierte en ruido y deja de leerse. */}
                <span className={`barra-valor${i === 0 ? " extremo" : ""}`}>
                  {d.tasa.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/** Barra apilada: de qué está hecha la interacción de cada post. */
function Composicion({ datos }) {
  const [sobre, setSobre] = useState(null);
  const id = useId();

  return (
    <figure className="grafico">
      <figcaption>
        <h3>De qué está hecha esa interacción</h3>
        <p>
          Un comentario cuesta mucho más que un “me gusta”. Mucha barra azul
          significa conversación, no solo aprobación.
        </p>
      </figcaption>

      <ul className="leyenda">
        {SERIES.map((s) => (
          <li key={s.id}>
            <span className={`punto-serie s-${s.id}`} aria-hidden="true" />
            {s.nombre}
          </li>
        ))}
      </ul>

      <div className="barras">
        {datos.map((d, i) => {
          const total = SERIES.reduce((n, s) => n + (d.m[s.id] || 0), 0) || 1;
          return (
            <div key={d.id} className="barra-fila" style={{ marginBottom: 14 }}>
              <span className="barra-etiqueta" title={d.titulo}>{corto(d.titulo)}</span>
              <div className="barra-pista apilada" role="img"
                   aria-label={SERIES.map((s) => `${s.nombre}: ${d.m[s.id] || 0}`).join(", ")}>
                {SERIES.map((s) => {
                  const v = d.m[s.id] || 0;
                  if (!v) return null;
                  const clave = `${id}-${d.id}-${s.id}`;
                  return (
                    <div
                      key={s.id} className={`segmento s-${s.id}`}
                      style={{ width: `${(v / total) * 100}%` }}
                      onMouseEnter={() => setSobre(clave)}
                      onMouseLeave={() => setSobre(null)}
                    >
                      {sobre === clave && (
                        <span className="globo">{s.nombre}: {v}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export default function Graficos({ publicados }) {
  const datos = publicados
    .map((b) => ({
      id: b.id,
      titulo: b.titulo || b.texto,
      tasa: tasaInteraccion(b.metricas),
      m: b.metricas || {},
    }))
    .filter((d) => d.tasa !== null)
    .sort((a, b) => b.tasa - a.tasa);

  if (datos.length === 0) {
    return (
      <div className="note">
        <b>Todavía no hay nada que dibujar</b>
        Apunta las cifras de un post publicado y aparecerán aquí los gráficos.
      </div>
    );
  }

  const conComposicion = datos.filter((d) =>
    SERIES.some((s) => d.m[s.id]),
  );

  return (
    <section className="graficos">
      <BarrasTasa datos={datos} />
      {conComposicion.length > 0 && <Composicion datos={conComposicion} />}

      {datos.length < 4 && (
        <p className="estado-pie">
          Con {datos.length} post{datos.length > 1 ? "s" : ""} medido
          {datos.length > 1 ? "s" : ""}, esto es una foto, no una tendencia.
          A partir de cuatro empieza a significar algo.
        </p>
      )}
    </section>
  );
}
