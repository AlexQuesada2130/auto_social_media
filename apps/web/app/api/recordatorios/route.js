import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { leerRecordatorios, guardarRecordatorios } from "@/lib/recordatorios";

export const runtime = "nodejs";

const noPasa = () => NextResponse.json({ error: "No autorizado" }, { status: 401 });

export async function GET(req) {
  if (!autorizado(req)) return noPasa();
  return NextResponse.json(await leerRecordatorios());
}

/** Solo se acepta el día del mes (1-28) o 0 para no avisar. Nada más. */
export async function POST(req) {
  if (!autorizado(req)) return noPasa();
  let cuerpo;
  try { cuerpo = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const dia = Number(cuerpo?.fondos?.dia);
  if (!Number.isInteger(dia) || dia < 0 || dia > 28) return NextResponse.json({ error: "Día inválido" }, { status: 400 });
  const actual = await leerRecordatorios();
  return NextResponse.json(await guardarRecordatorios({ ...actual, fondos: { dia } }));
}
