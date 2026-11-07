import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { monitor } from "@/lib/robot/mercado";

export const runtime = "nodejs";
export const maxDuration = 60; // la primera visita del día descarga los cierres (~17 s)

export async function GET(req) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json({ actualizado: new Date().toISOString(), criptos: await monitor() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
