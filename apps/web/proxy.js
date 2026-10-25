import { NextResponse } from "next/server";

// Content Security Policy con nonce por petición.
//
// Desde que el dinero vive en este mismo origen, un script inyectado en
// cualquier página alcanzaría la clave de la bóveda en memoria. Esta cabecera
// es la barrera: solo se ejecutan los scripts que Next firma con el nonce de
// esta petición, y nada puede enviar datos a otro dominio (connect-src 'self').
//
// style-src admite 'unsafe-inline' a propósito: React y los gráficos usan
// atributos style, y un estilo inyectado no puede leer ni enviar nada.

export function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Solo el propio origen: cuantos menos destinos, menos sitios a donde
    // mandar una clave. El puente del chat (estado.jsx) queda fuera: es HTTP
    // plano en la red de casa, y desde una página HTTPS el navegador lo
    // bloquea igualmente por contenido mixto.
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: cabeceras } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  return res;
}

export const config = {
  matcher: [
    {
      // Ni la API (la ingesta de la rutina no debe notar nada) ni lo estático.
      source: "/((?!api|_next/static|_next/image|sw.js|manifest.webmanifest|icono-).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
