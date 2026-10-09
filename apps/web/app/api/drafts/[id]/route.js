import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { parchear, borrar } from "@/lib/store";
import { ESTADOS, LIMITE_CARACTERES } from "@mesa/shared";

export const runtime = "nodejs";

const noPasa = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });

export async function PATCH(req, { params }) {
  if (!autorizado(req)) return noPasa();
  const { id } = await params;

  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const cambios = {};

  if (cuerpo.estado !== undefined) {
    if (!ESTADOS.includes(cuerpo.estado)) {
      return NextResponse.json(
        { error: `Estado desconocido. Son: ${ESTADOS.join(", ")}` },
        { status: 400 },
      );
    }
    cambios.estado = cuerpo.estado;
  }

  if (cuerpo.texto !== undefined) {
    const texto = String(cuerpo.texto).trim();
    if (!texto) return NextResponse.json({ error: "El texto no puede quedar vacío" }, { status: 400 });
    if (texto.length > LIMITE_CARACTERES) {
      return NextResponse.json(
        { error: `Son ${texto.length} caracteres y el límite es ${LIMITE_CARACTERES}` },
        { status: 400 },
      );
    }
    cambios.texto = texto;
  }

  if (cuerpo.notaVisual !== undefined) cambios.notaVisual = String(cuerpo.notaVisual);

  if (!Object.keys(cambios).length) {
    return NextResponse.json({ error: "No hay nada que cambiar" }, { status: 400 });
  }

  const borrador = await parchear(id, cambios);
  if (!borrador) return NextResponse.json({ error: "No existe ese borrador" }, { status: 404 });
  return NextResponse.json({ borrador });
}

export async function DELETE(req, { params }) {
  if (!autorizado(req)) return noPasa();
  const { id } = await params;
  const habia = await borrar(id);
  if (!habia) return NextResponse.json({ error: "No existe ese borrador" }, { status: 404 });
  return NextResponse.json({ borrado: id });
}
