"use client";

// Barra global: salta entre secciones sin volver atrás. Arriba y fija, porque
// la sección Social ya usa la barra inferior para sus propias pestañas.

import Link from "next/link";
import { usePathname } from "next/navigation";

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const SECCIONES = [
  { href: "/", nombre: "Inicio", icono: <path d="M3 11 12 4l9 7v9H3z M9 20v-6h6v6" {...T} /> },
  { href: "/inversiones", nombre: "Inversiones", icono: <path d="M3 17l6-6 4 4 8-8 M15 7h6v6" {...T} /> },
  { href: "/linkedin", nombre: "Social", icono: <path d="M21 11.5a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 11.5Z" {...T} /> },
  { href: "/cripto", nombre: "Cripto", icono: <><circle cx="12" cy="12" r="8.5" {...T} /><path d="M9.5 8h4a2 2 0 0 1 0 4h-4h4.5a2 2 0 0 1 0 4h-4.5z M11 6.5v1.5 M11 16v1.5" {...T} /></> },
  { href: "/gastos", nombre: "Gastos", icono: <path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6 M17 13h.01" {...T} /> },
];

export default function NavGlobal({ onBloquear }) {
  const ruta = usePathname();
  return (
    <nav className="navg" aria-label="Secciones de la app">
      {SECCIONES.map((s) => {
        const viva = s.href === "/" ? ruta === "/" : ruta.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} className={`navg-enlace${viva ? " viva" : ""}`} aria-current={viva ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{s.icono}</svg>
            <span>{s.nombre}</span>
          </Link>
        );
      })}
      <button className="navg-enlace navg-candado" onClick={onBloquear} aria-label="Bloquear">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" {...T} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...T} /></svg>
        <span>Bloquear</span>
      </button>
    </nav>
  );
}
