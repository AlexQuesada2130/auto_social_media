import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { autorizado } from "@/lib/auth";
import { listarComentarios, anadirComentario, parchearComentario, borrarComentario } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Posts de otros a los que quieres comentar.
//
// Tú pegas el post ajeno; la rutina, en su siguiente pasada, redacta el
// comentario y lo devuelve aquí. Así funciona con el Mac apagado y sin coste,
// reusando la misma rutina que ya escribe tus posts.

/** La rutina entra con la llave de ingesta; tú, con tu sesión. */
function rutina(req) {
  const real = process.env.INGEST_TOKEN;
  if (!real) return false;
  const cab = req.headers.get("authorization") || "";
  const dada = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  const a = crypto.createHash("sha256").update(dada).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req) {
  if (!autorizado(req) && !rutina(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const todos = await listarComentarios();
  // La rutina solo necesita los que están sin redactar.
  if (!autorizado(req)) {
    return NextResponse.json({
      pendientes: todos.filter((c) => !c.comentario)
        .map(({ id, postAjeno, de }) => ({ id, postAjeno, de })),
    });
  }
  return NextResponse.json({ comentarios: todos });
}

export async function POST(req) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let cuerpo;
  try { cuerpo = await req.json(); } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const postAjeno = String(cuerpo.postAjeno || "").trim();
  if (!postAjeno) return NextResponse.json({ error: "Pega el post" }, { status: 400 });
  if (postAjeno.length > 3000) {
    return NextResponse.json({ error: "El post es demasiado largo" }, { status: 400 });
  }

  const c = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    postAjeno,
    de: String(cuerpo.de || "").slice(0, 80),
    comentario: "",
    creado: new Date().toISOString(),
  };
  await anadirComentario(c);
  return NextResponse.json({ comentario: c }, { status: 201 });
}

export async function PATCH(req) {
  const esRutina = rutina(req);
  if (!autorizado(req) && !esRutina) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let cuerpo;
  try { cuerpo = await req.json(); } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!cuerpo.id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const cambios = {};
  if (cuerpo.comentario !== undefined) cambios.comentario = String(cuerpo.comentario).slice(0, 1250);
  if (cuerpo.usado !== undefined && !esRutina) cambios.usado = Boolean(cuerpo.usado);
  if (!Object.keys(cambios).length) {
    return NextResponse.json({ error: "Nada que cambiar" }, { status: 400 });
  }

  const c = await parchearComentario(cuerpo.id, cambios);
  if (!c) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ comentario: c });
}

export async function DELETE(req) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const habia = await borrarComentario(id);
  if (!habia) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ borrado: id });
}
