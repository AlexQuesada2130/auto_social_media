"use client";

// "Tu semana" en Social: lo publicado frente al objetivo, la racha de semanas
// seguidas publicando, lo aprobado que espera y si la cola está llena (con 20
// pendientes la rutina deja de traer propuestas).

const OBJETIVO = 3;           // posts por semana (el ritmo previsto es 2-3)
const TOPE_COLA = 20;         // la ingesta deja de entregar con 20 pendientes

const lunes = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fechaPub = (b) => new Date(b.publicadoEl || b.actualizado || b.creado || 0);

export default function SemanaSocial({ borradores }) {
  const publicados = borradores.filter((b) => b.estado === "publicado").map(fechaPub);
  const esta = lunes(new Date());
  const enSemana = (ini) => publicados.filter((f) => f >= ini && f < new Date(ini.getTime() + 7 * 864e5)).length;
  const hechos = enSemana(esta);

  // Racha: semanas seguidas con al menos un post (la actual cuenta si ya hay).
  let racha = 0;
  let semana = hechos > 0 ? esta : new Date(esta.getTime() - 7 * 864e5);
  while (enSemana(semana) > 0 && racha < 520) { racha++; semana = new Date(semana.getTime() - 7 * 864e5); }

  const aprobados = borradores.filter((b) => b.estado === "aprobado").length;
  const pendientes = borradores.filter((b) => (b.estado || "pendiente") === "pendiente").length;
  const llena = pendientes >= TOPE_COLA;

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
        <span className="semana-etiqueta">Racha</span>
        <span className="semana-cifra">{racha}<small> sem.</small></span>
      </div>
      <div className="semana-dato">
        <span className="semana-etiqueta">Aprobados por publicar</span>
        <span className="semana-cifra">{aprobados}</span>
      </div>
      {llena && (
        <p className="semana-aviso">
          La cola está llena ({pendientes}/{TOPE_COLA}): la rutina no traerá propuestas nuevas hasta que apruebes o descartes alguna.
        </p>
      )}
    </section>
  );
}
