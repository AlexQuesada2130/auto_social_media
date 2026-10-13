import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { anadir, listarTokens, olvidarTokens, listarSubs, olvidarSubs } from "@/lib/store";
import { enviar } from "@/lib/push";
import { enviarWeb } from "@/lib/webpush";
import { nuevoBorrador, LIMITE_CARACTERES } from "@mesa/shared";

export const runtime = "nodejs";

// Llave de un solo propósito: dejar propuestas en la cola.
//
// Existe aparte de la contraseña porque la usa una rutina en la nube, cuyo
// prompt queda almacenado. Si se filtrara, lo peor que puede hacer quien la
// tenga es añadirte borradores. No puede leer la cola, ni aprobar, ni borrar.
function llaveCorrecta(req) {
  const real = process.env.INGEST_TOKEN;
  if (!real) return false;
  const cabecera = req.headers.get("authorization") || "";
  const dada = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  const a = crypto.createHash("sha256").update(dada).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req) {
  if (!llaveCorrecta(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  // Acepta una propuesta o un lote: una rutina diaria suele traer varias.
  const entradas = Array.isArray(cuerpo.propuestas) ? cuerpo.propuestas : [cuerpo];
  if (entradas.length > 10) {
    return NextResponse.json(
      { error: "Máximo 10 propuestas por envío" }, { status: 400 },
    );
  }

  const creados = [];
  const rechazados = [];

  for (const e of entradas) {
    const texto = String(e?.texto || "").trim();
    if (!texto) { rechazados.push("vacío"); continue; }
    if (texto.length > LIMITE_CARACTERES) {
      rechazados.push(`${texto.length} caracteres, pasa del límite`);
      continue;
    }
    creados.push(await anadir(nuevoBorrador({
      texto,
      origen: String(e.origen || "rutina automática").slice(0, 60),
      notaVisual: String(e.notaVisual || "").slice(0, 300),
      promptVisual: String(e.promptVisual || "").slice(0, 1500),
    })));
  }

  // Un solo aviso por lote, no uno por propuesta.
  let aviso = null;
  if (creados.length) {
    const cuerpoAviso = creados.length === 1
      ? creados[0].texto.split("\n")[0].slice(0, 90)
      : `${creados.length} propuestas nuevas en la cola`;
    const [expo, web] = await Promise.all([
      enviar(await listarTokens(), { titulo: "Propuestas nuevas", cuerpo: cuerpoAviso, datos: {} }),
      enviarWeb(await listarSubs(), { titulo: "Propuestas nuevas", cuerpo: cuerpoAviso, url: "/" }),
    ]);
    await Promise.all([olvidarTokens(expo.caducados), olvidarSubs(web.caducadas)]);
    aviso = { expo: expo.enviados, web: web.enviados };
  }

  return NextResponse.json(
    { creadas: creados.length, ids: creados.map((c) => c.id), rechazadas: rechazados, aviso },
    { status: creados.length ? 201 : 400 },
  );
}
