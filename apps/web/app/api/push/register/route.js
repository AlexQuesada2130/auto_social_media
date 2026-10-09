import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { registrarToken, listarTokens } from "@/lib/store";
import { tokenValido } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(req) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let token;
  try {
    ({ token } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!tokenValido(token)) {
    return NextResponse.json(
      { error: "Eso no parece un token de Expo" }, { status: 400 },
    );
  }

  const tokens = await registrarToken(token);
  return NextResponse.json({ registrados: tokens.length });
}

export async function GET(req) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ registrados: (await listarTokens()).length });
}
