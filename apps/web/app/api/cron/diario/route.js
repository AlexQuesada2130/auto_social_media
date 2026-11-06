import { NextResponse } from "next/server";
import { leerRecordatorios } from "@/lib/recordatorios";
import { listarSubs } from "@/lib/store";
import { enviarWeb } from "@/lib/webpush";

// Tarea diaria de Vercel Cron (vercel.json). Vercel la llama con
// "Authorization: Bearer $CRON_SECRET"; sin esa variable no hace nada.
// Hoy: el recordatorio mensual de los fondos. El aviso no lleva importes:
// el cálculo se hace en el móvil al abrir Dinero.

export const runtime = "nodejs";

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const hoy = new Date().getUTCDate();
  const { fondos } = await leerRecordatorios();
  const enviados = [];
  if (fondos?.dia && fondos.dia === hoy) {
    const r = await enviarWeb(await listarSubs(), {
      titulo: "Revisa tus fondos",
      cuerpo: "Actualiza los valores en Dinero y te digo cómo repartir la aportación de este mes.",
      url: "/dinero",
    });
    enviados.push({ tipo: "fondos", ...r });
  }
  return NextResponse.json({ dia: hoy, enviados });
}
