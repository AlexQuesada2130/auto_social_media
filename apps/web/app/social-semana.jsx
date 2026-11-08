"use client";

// "Tu semana" en Social: lo publicado frente al objetivo, la racha de semanas
// seguidas cumpliéndolo, lo aprobado que espera y si la cola está llena (la
// ingesta deja de entregar al llegar al tope).
//
// Solo cuenta la fecha de publicación (publicadoEl), que se fija una vez al
// marcar el post publicado. Editarlo después no lo mueve de semana.

import { TOPE_PENDIENTES } from "@mesa/shared";

const OBJETIVO = 2;           // posts por semana: lo eligió Alejandro

const lunes = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fechaPub = (b) => new Date(b.publicadoEl);

export default function SemanaSocial({ borradores }) {
  const publicados = borradores.filter((b) => b.estado === "publicado" && b.publicadoEl).map(fechaPub);
  const esta = lunes(new Date());
  const enSemana = (ini) => publicados.filter((f) => f >= ini && f < new Date(ini.getTime() + 7 * 864e5)).length;
  const hechos = enSemana(esta);

  // Racha: semanas seguidas cumpliendo el objetivo. La actual cuenta en cuanto
  // se cumple; mientras no, la racha viene de las anteriores.
  let racha = 0;
  let semana = hechos >= OBJETIVO ? esta : new Date(esta.getTime() - 7 * 864e5);
  while (enSemana(semana) >= OBJETIVO && racha < 520) { racha++; semana = new Date(semana.getTime() - 7 * 864e5); }

  const aprobados = borradores.filter((b) => b.estado === "aprobado").length;
  const pendientes = borradores.filter((b) => (b.estado || "pendiente") === "pendiente").length;
  const llena = pendientes >= TOPE_PENDIENTES;

  return (
    <section className="semana" aria-label="Tu semana en LinkedIn">
      <div className="semana-dato">
        <span className="semana-etiqueta">Esta semana</span>
        <span className="semana-cifra">{hechos}<small>/{OBJETIVO}</small></span>
        <span className="semana-puntos" aria-hidden="true">
          {Array.from({ length: OBJETIVO }, (_, i) => <i key={i} className={i < hechos ? "hecho" : ""} />)}
        </span>
      </div>
      <div className="semana-dato">
        <span className="semana-etiqueta">Semanas cumpliendo</span>
        <span className="semana-cifra">{racha}<small> sem.</small></span>
      </div>
      <div className="semana-dato">
        <span className="semana-etiqueta">Aprobados por publicar</span>
        <span className="semana-cifra">{aprobados}</span>
      </div>
      {llena && (
        <p className="semana-aviso">
          La cola está llena ({pendientes}/{TOPE_PENDIENTES}): la rutina no traerá propuestas nuevas hasta que apruebes o descartes alguna.
        </p>
      )}
    </section>
  );
}
