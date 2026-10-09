import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { registrarSub, listarSubs } from "@/lib/store";
import { clavePublica, hayClaves } from "@/lib/webpush";

export const runtime = "nodejs";

/** La clave pública la necesita el navegador para suscribirse. */
export async function GET(req) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({
    clavePublica,
    activo: hayClaves,
    suscripciones: (await listarSubs()).length,
  });
}

export async function POST(req) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let sub;
  try {
    sub = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 });
  }

  const subs = await registrarSub({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return NextResponse.json({ suscripciones: subs.length });
}
