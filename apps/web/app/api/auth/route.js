import { NextResponse } from "next/server";
import { passwordCorrecta, emitirToken, COOKIE, tokenValido,
         bloqueado, apuntarFallo, olvidarFallos } from "@/lib/auth";

export const runtime = "nodejs";

/** Comprueba si la sesión actual sigue viva, para no pedir la clave cada vez. */
export async function GET(req) {
  const cookie = req.cookies.get(COOKIE)?.value;
  return NextResponse.json({ sesion: tokenValido(cookie) });
}

export async function POST(req) {
  // Detrás de Vercel la IP real llega en x-forwarded-for; el primer valor es
  // el cliente y el resto son los proxies por los que pasó.
  const quien = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();

  const espera = bloqueado(quien);
  if (espera) {
    return NextResponse.json(
      { error: `Demasiados intentos. Prueba en ${Math.ceil(espera / 60)} minutos.` },
      { status: 429, headers: { "Retry-After": String(espera) } },
    );
  }

  let password;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!passwordCorrecta(password)) {
    apuntarFallo(quien);
    // Un retardo fijo desdibuja los intentos automatizados sin castigar al dueño.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  olvidarFallos(quien);
  const token = emitirToken();
  const res = NextResponse.json({ token });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ sesion: false });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
