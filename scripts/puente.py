#!/usr/bin/env python3
"""
puente.py - deja que la app hable con tu Claude, sin clave de API.

Levanta un servidor pequeño en tu Mac que recibe mensajes de la app y los
ejecuta contra `claude -p`, es decir, contra tu propia suscripción. No hay
clave de API y no se factura nada por uso.

    MESA_SECRET=el-mismo-de-la-web python3 scripts/puente.py

Luego, en la app, el chat apunta a http://<ip-de-tu-mac>:3200.

Qué hay que saber:

  - Solo funciona con el Mac encendido, este proceso corriendo, y el teléfono
    en la misma red. Es la misma condición que ya impone Expo Go.
  - Acepta el mismo token firmado que emite la web, así que en el teléfono no
    queda ninguna contraseña guardada. Usa el MESA_SECRET de tu .env.local.
  - Cada petición arranca un proceso nuevo. Claude no recuerda nada entre
    llamadas, así que la app manda la conversación entera cada vez.
"""

import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PUERTO = int(os.environ.get("MESA_PUERTO_PUENTE", "3200"))
SECRETO = os.environ.get("MESA_SECRET")
ESPERA = int(os.environ.get("MESA_TIMEOUT", "180"))
MAX_CUERPO = 200_000

SISTEMA = (
    "Eres el editor de los posts de LinkedIn de quien te escribe. Respondes en "
    "español, en corto, sin rodeos. No inventas datos: si hace falta una cifra "
    "que no te han dado, escribes {{tu número}}. Nada de guiones largos ni de "
    "jerga corporativa."
)


def token_valido(token):
    """Mismo esquema que la web: '<caduca>.<hmac>' firmado con MESA_SECRET."""
    if not token or "." not in token:
        return False
    caduca, firma = token.split(".", 1)
    if not caduca.isdigit() or int(caduca) < time.time() * 1000:
        return False
    esperada = hmac.new(SECRETO.encode(), caduca.encode(), hashlib.sha256).digest()
    import base64
    esperada_b64 = base64.urlsafe_b64encode(esperada).rstrip(b"=").decode()
    return hmac.compare_digest(esperada_b64, firma)


def ejecutar_claude(prompt):
    """Lanza `claude -p`. Sin shell: el texto va como argumento, no se evalúa."""
    try:
        r = subprocess.run(
            ["claude", "-p", prompt, "--append-system-prompt", SISTEMA],
            capture_output=True, text=True, timeout=ESPERA,
        )
    except FileNotFoundError:
        return None, "no encuentro el ejecutable 'claude' en este Mac"
    except subprocess.TimeoutExpired:
        return None, f"Claude tardó más de {ESPERA} segundos"

    if r.returncode != 0:
        return None, (r.stderr or "").strip()[:400] or f"claude salió con {r.returncode}"
    salida = (r.stdout or "").strip()
    return (salida, None) if salida else (None, "Claude no devolvió nada")


def como_prompt(mensajes):
    """Aplana la conversación: cada llamada es independiente de la anterior."""
    if len(mensajes) == 1:
        return mensajes[0]["texto"]
    partes = []
    for m in mensajes:
        quien = "Tú" if m.get("de") == "claude" else "Él"
        partes.append(f"{quien}: {m['texto']}")
    partes.append(
        "\nResponde al último mensaje. Lo anterior es el hilo, para que tengas "
        "contexto; no lo repitas."
    )
    return "\n\n".join(partes)


class Puente(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def responder(self, codigo, cuerpo):
        datos = json.dumps(cuerpo, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(datos)

    def do_OPTIONS(self):
        self.responder(204, {})

    def do_GET(self):
        if self.path == "/salud":
            self.responder(200, {"vivo": True, "puerto": PUERTO})
        else:
            self.responder(404, {"error": "no existe"})

    def do_POST(self):
        if self.path != "/chat":
            return self.responder(404, {"error": "no existe"})

        cabecera = self.headers.get("Authorization", "")
        if not cabecera.startswith("Bearer ") or not token_valido(cabecera[7:]):
            return self.responder(401, {"error": "No autorizado"})

        largo = int(self.headers.get("Content-Length", 0))
        if largo > MAX_CUERPO:
            return self.responder(413, {"error": "mensaje demasiado largo"})

        try:
            cuerpo = json.loads(self.rfile.read(largo))
        except (json.JSONDecodeError, ValueError):
            return self.responder(400, {"error": "cuerpo inválido"})

        mensajes = cuerpo.get("mensajes") or []
        if not isinstance(mensajes, list) or not mensajes:
            return self.responder(400, {"error": "no hay mensajes"})
        if not all(isinstance(m, dict) and m.get("texto") for m in mensajes):
            return self.responder(400, {"error": "algún mensaje viene vacío"})

        texto, fallo = ejecutar_claude(como_prompt(mensajes))
        if fallo:
            return self.responder(502, {"error": fallo})
        self.responder(200, {"texto": texto})

    def log_message(self, formato, *args):
        # Una línea por petición, sin el ruido del servidor por defecto.
        print(f"  {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}",
              file=sys.stderr)


def ip_local():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    if not SECRETO:
        print("error: falta MESA_SECRET en el entorno. Es el mismo valor que\n"
              "pusiste en apps/web/.env.local y en Vercel.\n\n"
              "  MESA_SECRET=... python3 scripts/puente.py", file=sys.stderr)
        return 1

    servidor = ThreadingHTTPServer(("0.0.0.0", PUERTO), Puente)
    print(f"\n  Puente levantado en http://{ip_local()}:{PUERTO}")
    print(f"  Pon esa dirección en la app, en Ajustes del chat.")
    print(f"  Mientras esta ventana siga abierta, el chat funciona.\n")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  puente parado\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
