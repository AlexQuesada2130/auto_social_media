import { NextResponse } from "next/server";
import { leerRecordatorios } from "@/lib/recordatorios";
import { listarSubs, olvidarSubs } from "@/lib/store";
import { enviarWeb } from "@/lib/webpush";
import { ejecutarDia, leerRobot, guardarRobot, resumen, textoSemanal } from "@/lib/robot/servicio";

// Tarea diaria de Vercel Cron (vercel.json, 08:00 UTC = 09:00 en Madrid en
// invierno). Vercel la llama con "Authorization: Bearer $CRON_SECRET"; sin
// esa variable no hace nada. En Hobby solo hay una ejecución al día, así que
// todo lo diario vive aquí y lo semanal se decide por fecha.
//
//  1. El robot de cripto avanza un día (en papel).
//  2. Lunes: resumen semanal del robot.
//  3. El día elegido: recordatorio de los fondos (sin importes).

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const ahora = new Date();
  const avisos = [];

  // 1. Robot
  let robot = null;
  try {
    const r = await ejecutarDia();
    robot = r.estado;
    for (const a of r.avisos) avisos.push({ ...a, url: "/cripto" });
  } catch (e) {
    // Un fallo de Kraken no debe tumbar el resto. Se avisa si se repite 3 días.
    robot = await leerRobot();
    if (robot) {
      robot.ultimoError = { fecha: ahora.toISOString(), mensaje: e.message, veces: (robot.ultimoError?.veces ?? 0) + 1 };
      await guardarRobot(robot);
      if (robot.ultimoError.veces === 3) avisos.push({ titulo: "El robot no ha podido operar", cuerpo: `Lleva 3 días fallando: ${e.message}`, url: "/cripto" });
    }
  }

  // 2. Resumen semanal (lunes)
  if (ahora.getUTCDay() === 1 && robot?.historial?.length > 1) {
    avisos.push({ titulo: "Cripto bot · tu semana (papel)", cuerpo: textoSemanal(resumen(robot)), url: "/cripto" });
  }

  // 3. Recordatorio de fondos
  const { fondos } = await leerRecordatorios();
  if (fondos?.dia && fondos.dia === ahora.getUTCDate()) {
    avisos.push({ titulo: "Revisa tus fondos", cuerpo: "Actualiza los valores y te digo cómo repartir la aportación de este mes.", url: "/inversiones" });
  }

  const enviados = [];
  if (avisos.length) {
    const subs = await listarSubs();
    for (const a of avisos) {
      const r = await enviarWeb(subs, { titulo: a.titulo, cuerpo: a.cuerpo, url: a.url });
      // Los móviles que ya no existen (app reinstalada, permiso quitado) se olvidan.
      if (r.caducadas.length) await olvidarSubs(r.caducadas);
      enviados.push({ titulo: a.titulo, enviados: r.enviados });
    }
  }
  return NextResponse.json({ dia: ahora.toISOString().slice(0, 10), robot: robot?.ultimoDia ?? null, enviados });
}
