import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { leerRobot, guardarRobot, resumen, ejecutarDia } from "@/lib/robot/servicio";

export const runtime = "nodejs";
export const maxDuration = 60; // Kraken pide ~1 s entre peticiones: 16 peticiones

const noPasa = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });

export async function GET(req) {
  if (!autorizado(req)) return noPasa();
  return NextResponse.json({ robot: resumen(await leerRobot()) });
}

/**
 * Órdenes desde la app:
 *  - ejecutar: avanza hoy si aún no se ha hecho (la tarea diaria lo hace sola).
 *  - volver | salir | esperar: respuesta al freno, en una parte o en las dos.
 *  - pausar | reanudar: el botón de parada.
 */
export async function POST(req) {
  if (!autorizado(req)) return noPasa();
  let cuerpo;
  try { cuerpo = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const { accion, parte } = cuerpo || {};

  if (accion === "ejecutar") {
    try {
      const { estado } = await ejecutarDia();
      return NextResponse.json({ robot: resumen(estado) });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
  }

  const estado = await leerRobot();
  if (!estado) return NextResponse.json({ error: "El robot aún no ha arrancado" }, { status: 409 });
  if (accion === "pausar" || accion === "reanudar") {
    estado.pausado = accion === "pausar";
  } else if (["volver", "salir", "esperar"].includes(accion)) {
    const ids = parte ? [parte] : Object.keys(estado.partes);
    for (const id of ids) {
      const P = estado.partes[id];
      if (!P?.frenado) continue;
      P.decision = accion === "esperar" ? null : accion;
      if (accion === "salir") { P.exposicion = 0; P.tramoVuelta = 0; }
    }
  } else {
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  }
  await guardarRobot(estado);
  return NextResponse.json({ robot: resumen(estado) });
}
