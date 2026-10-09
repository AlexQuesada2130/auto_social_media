import { NextResponse } from "next/server";
import { autorizado } from "@/lib/auth";
import { listar, anadir, dondeGuarda, listarTokens, olvidarTokens,
         listarSubs, olvidarSubs } from "@/lib/store";
import { enviar } from "@/lib/push";
import { enviarWeb } from "@/lib/webpush";
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

  // Avisar solo de lo que llega de fuera. Notificarle a alguien la idea que
  // acaba de escribir en su propio teléfono es ruido.
  let aviso = null;
  if (borrador.origen !== "idea tuya" && cuerpo.avisar !== false) {
    const primeraLinea = texto.split("\n")[0].slice(0, 90);

    // Dos canales: la app de Expo y la PWA instalada. Da igual cuál tenga
    // puesto; si tiene los dos, le llega por los dos.
    const [expo, web] = await Promise.all([
      enviar(await listarTokens(), {
        titulo: "Propuesta nueva", cuerpo: primeraLinea, datos: { id: borrador.id },
      }),
      enviarWeb(await listarSubs(), {
        titulo: "Propuesta nueva", cuerpo: primeraLinea, url: "/",
      }),
    ]);
    await Promise.all([olvidarTokens(expo.caducados), olvidarSubs(web.caducadas)]);
    aviso = {
      expo: expo.enviados, web: web.enviados,
      motivo: expo.motivo || web.motivo,
    };
  }

  return NextResponse.json({ borrador, aviso }, { status: 201 });
}
