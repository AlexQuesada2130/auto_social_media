"use client";

// Inicio: las cuatro secciones en pequeño y, debajo, solo lo que requiere tu
// atención hoy. La seguridad tiene su propia pantalla (icono del escudo).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCandado } from "./candado";
import { BotonCandado } from "./nav-global";
import { resumenFinanzas } from "./_finanzas/saldo";

const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function resumenFondos(datos) {
  const fondos = datos.planFondos?.fondos ?? [];
  const total = fondos.reduce((s, f) => s + (f.valor || 0), 0);
  const invertido = fondos.reduce((s, f) => s + (f.invertido || 0), 0);
  const sumaObj = fondos.reduce((s, f) => s + (f.objetivo || 0), 0) || 1;
  const desvio = total > 0 ? Math.max(...fondos.map((f) => Math.abs((f.valor / total) * 100 - (f.objetivo / sumaObj) * 100))) : 0;
  const dias = datos.planFondos?.actualizado ? Math.floor((Date.now() - new Date(datos.planFondos.actualizado)) / 864e5) : null;
  return { total, invertido, desvio, umbral: datos.planFondos?.umbral ?? 5, dias };
}

const ESCUDO = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
  </svg>
);

export default function Inicio() {
  const { datos, cerrar } = useCandado();
  const [cola, setCola] = useState(null);
  const [robot, setRobot] = useState(undefined);

  useEffect(() => {
    fetch("/api/drafts", { cache: "no-store" })
      .then((r) => { if (r.status === 401) cerrar(); return r.ok ? r.json() : null; })
      .then((j) => j && setCola({
        pendientes: j.borradores.filter((d) => (d.estado || "pendiente") === "pendiente").length,
        aprobados: j.borradores.filter((d) => d.estado === "aprobado").length,
      }))
      .catch(() => {});
    fetch("/api/robot", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setRobot(j ? j.robot : null)).catch(() => setRobot(null));
  }, [cerrar]);

  const fondos = resumenFondos(datos);
  const fin = resumenFinanzas(datos);

  // Lo que requiere atención, de más a menos urgente.
  const pendiente = [];
  if (robot && Object.values(robot.partes).some((p) => p.frenado)) pendiente.push({ href: "/cripto", texto: "Freno activo en el robot: decide si vuelve a entrar o espera." });
  if (fin.configurado && fin.libre < 0) pendiente.push({ href: "/gastos", texto: `Has gastado ${eur(-fin.libre)} de lo reservado. Revisa tus gastos.` });
  else if (fin.vasPorEncima) pendiente.push({ href: "/gastos", texto: `Vas por encima de lo previsto: te quedan ${eur(fin.porDia)} al día hasta el ${fin.proximoCobro.slice(8)}.` });
  if (fondos.total > 0 && fondos.desvio > fondos.umbral) pendiente.push({ href: "/inversiones", texto: `Toca reequilibrar tus fondos (${fondos.desvio.toFixed(1)} puntos de desvío).` });
  if (fondos.dias != null && fondos.dias > 35) pendiente.push({ href: "/inversiones", texto: `Los valores de tus fondos son de hace ${fondos.dias} días.` });
  if (cola && cola.pendientes >= 20) pendiente.push({ href: "/linkedin", texto: `La cola de LinkedIn está llena (${cola.pendientes}): aprueba o descarta para recibir más.` });
  if (cola && cola.aprobados > 0) pendiente.push({ href: "/linkedin", texto: `${cola.aprobados} post${cola.aprobados === 1 ? "" : "s"} aprobado${cola.aprobados === 1 ? "" : "s"} esperando a publicarse.` });
  if (!fin.configurado) pendiente.push({ href: "/gastos", texto: "Escribe el saldo de tus cuentas en Gastos para saber cuánto tienes libre." });
  if (fin.pendiente > 0) pendiente.push({ href: "/gastos", texto: `Tienes ${eur(fin.pendiente)} en cargos pendientes. Márcalos cuando el banco los pase.` });

  return (
    <main className="wrap">
      <header className="masthead">
        <h1>Mesa</h1>
        <div className="tally">
          <Link href="/seguridad" className="candado-boton" aria-label="Seguridad" title="Seguridad">{ESCUDO}</Link>
        </div>
        <BotonCandado />
      </header>

      <div className="inicio-rejilla">
        <Link href="/inversiones" className="inicio-tarjeta">
          <span className="hub-tipo">Inversiones</span>
          <span className="inicio-cifra">{fondos.total > 0 ? eur(fondos.total) : "—"}</span>
          <span className="hub-pie">{fondos.invertido > 0 ? `${fondos.total >= fondos.invertido ? "+" : ""}${eur(fondos.total - fondos.invertido)} de ganancia` : "MyInvestor"}</span>
        </Link>
        <Link href="/linkedin" className="inicio-tarjeta">
          <span className="hub-tipo">Social</span>
          <span className="inicio-cifra">{cola ? cola.pendientes : "—"}</span>
          <span className="hub-pie">propuestas pendientes</span>
        </Link>
        <Link href="/cripto" className="inicio-tarjeta">
          <span className="hub-tipo">Cripto · papel</span>
          <span className={`inicio-cifra${robot && robot.resultado < 0 ? " hub-rojo" : ""}`}>
            {robot ? `${robot.resultado >= 0 ? "+" : ""}${robot.resultado.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}` : "—"}
          </span>
          <span className="hub-pie">{robot ? `sobre ${eur(robot.aportado)}` : robot === null ? "sin arrancar" : "…"}</span>
        </Link>
        <Link href="/gastos" className="inicio-tarjeta">
          <span className="hub-tipo">Libre</span>
          <span className={`inicio-cifra${fin.libre != null && fin.libre < 0 ? " hub-rojo" : ""}`}>{fin.libre != null ? eur(fin.libre) : "—"}</span>
          <span className="hub-pie">{fin.porDia != null ? `${eur(fin.porDia)}/día hasta el ${fin.proximoCobro.slice(8)}` : "pon tu saldo"}</span>
        </Link>
      </div>

      <section className="inicio-atencion">
        <h2>Hoy requiere tu atención</h2>
        {pendiente.length === 0 ? (
          <p className="inicio-ok">✓ Todo en orden.</p>
        ) : (
          <ul>
            {pendiente.map((p, i) => <li key={i}><Link href={p.href}>{p.texto}<span aria-hidden="true">›</span></Link></li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
