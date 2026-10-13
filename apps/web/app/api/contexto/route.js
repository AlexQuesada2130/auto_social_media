import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { listar } from "@/lib/store";
import { tasaInteraccion, MOTIVOS_DESCARTE } from "@mesa/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo que la rutina necesita saber antes de escribir: qué se descartó y por
// qué, qué funcionó, y qué cambios se han pedido.
//
// Usa la misma llave que la ingesta, y a propósito devuelve resumen y no
// borradores enteros: para escribir mejor no hace falta leerlo todo, y así
// una llave filtrada sigue sin exponer la cola.

function llaveCorrecta(req) {
  const real = process.env.INGEST_TOKEN;
  if (!real) return false;
  const cab = req.headers.get("authorization") || "";
  const dada = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  const a = crypto.createHash("sha256").update(dada).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

const nombreMotivo = (id) =>
  MOTIVOS_DESCARTE.find((m) => m.id === id)?.nombre || id;

export async function GET(req) {
  if (!llaveCorrecta(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const todos = await listar();
  const primeraLinea = (t) => t.split("\n")[0].slice(0, 120);

  // Por qué se descarta, agrupado. Es lo que evita repetir el mismo error.
  const porMotivo = {};
  for (const b of todos) {
    if (b.estado !== "descartado" || !b.motivoDescarte) continue;
    (porMotivo[b.motivoDescarte] ||= []).push(primeraLinea(b.texto));
  }

  const medidos = todos
    .filter((b) => b.metricas && tasaInteraccion(b.metricas) !== null)
    .sort((a, b) => tasaInteraccion(b.metricas) - tasaInteraccion(a.metricas));

  return NextResponse.json({
    evita: Object.entries(porMotivo).map(([id, ejemplos]) => ({
      motivo: nombreMotivo(id),
      ejemplos: ejemplos.slice(0, 5),
    })),
    funcionaron: medidos.slice(0, 3).map((b) => ({
      arranque: primeraLinea(b.texto),
      caracteres: b.texto.length,
      interaccion: Number(tasaInteraccion(b.metricas).toFixed(1)),
    })),
    cambiosPedidos: todos
      .filter((b) => b.notas)
      .slice(0, 5)
      .map((b) => ({ sobre: primeraLinea(b.texto), pidio: b.notas })),
    yaTratados: todos
      .filter((b) => ["aprobado", "publicado"].includes(b.estado))
      .map((b) => primeraLinea(b.texto))
      .slice(0, 20),
    pendientesSinLeer: todos.filter((b) => (b.estado || "pendiente") === "pendiente").length,
  });
}
