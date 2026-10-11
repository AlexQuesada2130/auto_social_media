import { listar } from "@/lib/store";
import { tasaInteraccion } from "@mesa/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Instrucciones para la rutina diaria, servidas en abierto.
//
// Viven aquí y no dentro del prompt de la rutina por dos razones. Una: así se
// mejoran editando este archivo, sin tocar la rutina. Y dos: pueden incluir lo
// que los números dicen que le funciona, que cambia cada semana.
//
// No lleva ningún secreto: la llave de ingesta la aporta la rutina.

function aprendido(borradores) {
  const con = borradores
    .filter((b) => b.metricas && tasaInteraccion(b.metricas) !== null)
    .sort((a, b) => tasaInteraccion(b.metricas) - tasaInteraccion(a.metricas));

  if (con.length < 3) {
    return `Todavía no hay suficientes posts medidos (${con.length}) para sacar
conclusiones de lo que funciona. Cíñete a la estructura de abajo.`;
  }

  const corte = Math.max(1, Math.round(con.length / 3));
  const mejores = con.slice(0, corte);
  const media = (xs, f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;

  const largo = Math.round(media(mejores, (p) => p.texto.length));
  const pregunta = Math.round(100 * media(mejores, (p) => (p.texto.includes("?") ? 1 : 0)));
  const lista = Math.round(100 * media(mejores, (p) => (/^\d\.-/m.test(p.texto) ? 1 : 0)));
  const tasa = media(mejores, (p) => tasaInteraccion(p.metricas));

  return `Lo que dicen sus números, sobre ${con.length} posts medidos:

- Sus mejores posts rondan los ${largo} caracteres. Apunta ahí.
- El ${pregunta}% de los que mejor funcionan acaba con una pregunta.
- El ${lista}% lleva una lista numerada con el formato "1.-".
- Su tercio bueno saca un ${tasa.toFixed(1)}% de interacción.

Su mejor post hasta ahora empieza así, para que calibres el tono:
"${mejores[0].texto.split("\n")[0].slice(0, 180)}"

${con.length < 10
  ? "Ojo: con menos de diez posts medidos esto son pistas, no leyes. Si el tema pide otra cosa, haz otra cosa."
  : "Esto ya tiene base suficiente para guiarte."}`;
}

export async function GET() {
  let contexto;
  try {
    contexto = aprendido(await listar());
  } catch {
    contexto = "No pude leer el histórico. Cíñete a la estructura de abajo.";
  }

  const guia = `# Guía de redacción: posts de LinkedIn de Alejandro Quesada

## Quién es y para quién escribe

Desarrollador y especialista en automatización, consultor comercial IT.
Automatiza procesos y conecta sistemas (IA, CRM, telefonía) en empresas que ya
tienen las herramientas pero no las tienen hablando entre sí.

Escribe en ESPAÑOL para quien decide el presupuesto de tecnología en una pyme:
gerentes, responsables de IT, jefes de operaciones. Usa vocabulario de
desarrollador, pero no escribe para desarrolladores.

## Qué hacer hoy

1. Busca en la web novedades de los últimos 3 días sobre: automatización de
   procesos en empresa, coste real de la IA aplicada, MCP y conexión de modelos
   a datos, CRM y telefonía conectada (CTI), agentes de IA en desarrollo.
   Descarta notas de prensa y lanzamientos sin sustancia para una pyme española.

2. Escribe 2 o 3 posts completos siguiendo la estructura de abajo.

3. Entrégalos como se indica al final.

## La estructura, que es siempre la misma

1. Apertura que contradice lo que el lector da por hecho. Una o dos frases.
2. El problema en concreto, con una escena o una cifra de la noticia.
3. El término técnico nombrado y traducido en la misma línea. Así:
   "Model Routing (enrutamiento de modelos)".
4. Contraste con las etiquetas literales "Antes:" y "Ahora:", una escena en cada.
5. Un matiz que conceda algo. Nunca vende una solución como absoluta.
6. Cierre aforístico de una o dos frases.
7. Tres o cuatro hashtags en CamelCase al final, sin texto después.

## Muletillas suyas: úsalas

- "Para que nos entendamos:" para bajar un concepto técnico a tierra.
- "El cambio en el día a día es brutal:" como bisagra hacia el Antes/Ahora.
- "Ojo," para introducir una advertencia.
- "Y no, no se trata solo de..." para desmontar la interpretación fácil.

Listas numeradas con el formato "1.-", con ese guion. Segunda persona siempre:
"tu empresa", "estás pagando", "te conviene". Frases de dos palabras junto a
párrafos largos. Analogías de objeto cotidiano para lo abstracto.

## Lo que NO debe aparecer

- Guiones largos. Ni uno.
- Emoji en el cuerpo.
- Peticiones de interacción: nada de "¿qué opinas?" ni "comenta abajo".
- Nombres de clientes.
- Promesas de resultado garantizado.
- Jerga de consultoría: sinergia, holístico, disruptivo, piedra angular,
  robusto, aprovechar, crucial, en el mundo actual, cabe destacar.

## Cifras

Nunca inventes un dato suyo. Si un post pide una cifra que no tienes, escribe
{{tu número}} y sigue. Las cifras de la noticia sí puedes usarlas, citando de
dónde salen.

## Lo que sus propios números dicen

${contexto}

## Cómo entregarlos

Un solo POST con todos los posts juntos a:

  https://auto-social-media-eight.vercel.app/api/ingesta

Cabecera: Authorization: Bearer LA_LLAVE_QUE_TRAES_EN_TU_PROMPT
Cuerpo:

{"propuestas":[
  {"texto":"...el post entero...","origen":"rutina · tema","notaVisual":"qué imagen pediría"},
  {"texto":"...","origen":"rutina · tema"}
]}

Máximo 3000 caracteres por post. Un único envío, no uno por post: así le llega
una sola notificación en vez de tres.

Cuando termines, di en una línea cuántas mandaste y de qué van. Nada más.
`;

  return new Response(guia, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
