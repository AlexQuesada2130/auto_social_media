import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { listar, anadir, dondeGuarda } from "@/lib/store";
import { nuevoBorrador, LIMITE_CARACTERES } from "@mesa/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noPasa = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });

export async function GET(req) {
  if (!autorizado(req)) return noPasa();
  return NextResponse.json({ borradores: await listar(), almacen: dondeGuarda });
}

export async function POST(req) {
  if (!autorizado(req)) return noPasa();

  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const texto = String(cuerpo.texto || "").trim();
  if (!texto) {
    return NextResponse.json({ error: "El borrador está vacío" }, { status: 400 });
  }
  if (texto.length > LIMITE_CARACTERES) {
    return NextResponse.json(
      { error: `Son ${texto.length} caracteres y el límite es ${LIMITE_CARACTERES}` },
      { status: 400 },
    );
  }

  const borrador = await anadir(
    nuevoBorrador({ texto, origen: cuerpo.origen, notaVisual: cuerpo.notaVisual }),
  );
  return NextResponse.json({ borrador }, { status: 201 });
}
