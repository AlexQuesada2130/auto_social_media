import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { autorizado } from "@/lib/auth";
import { listarSubs, olvidarSubs, listarTokens, olvidarTokens } from "@/lib/store";
import { enviarWeb } from "@/lib/webpush";
import { enviar } from "@/lib/push";

export const runtime = "nodejs";

// Lanza un aviso de prueba a los dispositivos suscritos.
//
// Existe porque sin él no hay forma de comprobar que las notificaciones
// funcionan: el único camino era que entrara una propuesta de verdad, y con
// la cola llena eso no ocurre. Una pieza que solo se puede probar cuando pasa
// algo real es una pieza que nadie prueba.
//
// Acepta la sesión o la llave de ingesta. La llave ya puede hacer sonar el
// teléfono creando propuestas, así que esto no le da ninguna capacidad nueva.

function llaveIngesta(req) {
  const real = process.env.INGEST_TOKEN;
  if (!real) return false;
  const cab = req.headers.get("authorization") || "";
  const dada = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  const a = crypto.createHash("sha256").update(dada).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req) {
  if (!autorizado(req) && !llaveIngesta(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [subs, tokens] = await Promise.all([listarSubs(), listarTokens()]);
  if (!subs.length && !tokens.length) {
    return NextResponse.json({
      enviados: 0,
      mensaje: "No hay ningún dispositivo suscrito. Activa las notificaciones desde Estado, con la app abierta desde su icono.",
    });
  }

  const cuerpo = `Prueba enviada a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  const [web, expo] = await Promise.all([
    enviarWeb(subs, { titulo: "Las notificaciones funcionan", cuerpo, url: "/linkedin" }),
    enviar(tokens, { titulo: "Las notificaciones funcionan", cuerpo, datos: {} }),
  ]);
  await Promise.all([olvidarSubs(web.caducadas), olvidarTokens(expo.caducados)]);

  return NextResponse.json({
    enviados: web.enviados + expo.enviados,
    navegadores: web.enviados,
    apps: expo.enviados,
    suscripcionesVivas: subs.length - (web.caducadas?.length || 0),
    motivo: web.motivo || expo.motivo || null,
  });
}
