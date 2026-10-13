"use client";

/**
 * Barra inferior. Abajo porque es donde llega el pulgar: en un iPhone grande
 * la parte alta de la pantalla no se alcanza con una mano.
 *
 * Los iconos van dibujados a mano en SVG en vez de cargar una librería entera
 * por cuatro siluetas. Trazo heredado del color del texto, así que siguen el
 * tema sin tocarlos.
 */

const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ICONOS = {
  cola: (
    <>
      <path d="M4 7h11M4 12h11M4 17h7" {...TRAZO} />
      <circle cx="19" cy="17" r="3" {...TRAZO} />
    </>
  ),
  resultados: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...TRAZO} />
    </>
  ),
  comentar: (
    <>
      <path d="M21 11.5a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 11.5Z" {...TRAZO} />
      <path d="M8.5 11h7M8.5 14.5h4" {...TRAZO} />
    </>
  ),
  estado: (
    <>
      <circle cx="12" cy="12" r="8.5" {...TRAZO} />
      <path d="M12 7.5v5l3 2" {...TRAZO} />
    </>
  ),
};

const PESTANAS = [
  { id: "cola", nombre: "Cola" },
  { id: "resultados", nombre: "Resultados" },
  { id: "comentar", nombre: "Comentar" },
  { id: "estado", nombre: "Estado" },
];

export default function Nav({ activa, onCambiar, pendientes }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {PESTANAS.map((p) => {
        const viva = activa === p.id;
        return (
          <button
            key={p.id}
            className={`nav-boton${viva ? " viva" : ""}`}
            onClick={() => onCambiar(p.id)}
            aria-current={viva ? "page" : undefined}
            aria-label={p.nombre}
          >
            <span className="nav-icono">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                {ICONOS[p.id]}
              </svg>
              {p.id === "cola" && pendientes > 0 && (
                <span className="nav-punto" aria-hidden="true">
                  {pendientes > 9 ? "9+" : pendientes}
                </span>
              )}
            </span>
            <span className="nav-texto">{p.nombre}</span>
          </button>
        );
      })}
    </nav>
  );
}
