// Sistema de diseño de la app.
//
// Un solo sitio donde viven el color, la escala tipográfica y el espaciado, y
// donde se decide cómo se adapta a la pantalla. La escala sale del ancho real
// del dispositivo: un iPhone SE no debe recibir la misma métrica que un Pro Max.

import { Dimensions, PixelRatio, Platform } from "react-native";

// El iPhone de referencia es el 13/14/15 estándar, 390 puntos de ancho.
const BASE = 390;

export function metricas(ancho) {
  // Se recorta para que ni el SE quede ilegible ni el Max exagere.
  const factor = Math.min(Math.max(ancho / BASE, 0.88), 1.18);
  const esc = (n) => PixelRatio.roundToNearestPixel(n * factor);

  return {
    factor,
    compacto: ancho < 375,      // SE, mini
    ancho_comodo: ancho >= 430, // Pro Max, Plus
    esc,
    // Tipografía
    t: {
      titulo: esc(26),
      seccion: esc(17),
      cuerpo: esc(15),
      menor: esc(13),
      etiqueta: esc(11),
      micro: esc(10),
    },
    // Espaciado en una escala de 4
    e: {
      xs: esc(4), s: esc(8), m: esc(12), l: esc(16), xl: esc(24), xxl: esc(32),
    },
    // Apple pide 44 puntos mínimos de área táctil. No es negociable.
    toque: 44,
    radio: esc(10),
  };
}

export function paleta(oscuro) {
  // El acento es violeta. El verde de "aprobado" y el gris de "descartado" se
  // quedan aparte a propósito: el color semántico informa de un estado y no
  // debe confundirse con el color de marca, o deja de leerse de un vistazo.
  //
  // Los neutros llevan una ligera inclinación violeta en vez de ser grises
  // puros, para que el conjunto se lea como elegido y no como heredado.
  return oscuro
    ? {
        papel: "#141019", tarjeta: "#1e1826", elevado: "#272034",
        tinta: "#ece7f2", suave: "#a39bb0", tenue: "#7d7389",
        linea: "#332a40", lineaSuave: "#282133",
        acento: "#b794f6", acentoBg: "#2f2347", acentoTexto: "#141019",
        ok: "#7bc09f", okBg: "#1b2f26",
        off: "#8a8294", offBg: "#262030",
        campo: "#262030", sombra: "#000000",
        avatar: "#4a3570",
      }
    : {
        papel: "#f4f1f8", tarjeta: "#ffffff", elevado: "#faf8fc",
        tinta: "#1e1a26", suave: "#635d70", tenue: "#8d8799",
        linea: "#e0dae8", lineaSuave: "#ece7f2",
        acento: "#6b3fa0", acentoBg: "#efe7f9", acentoTexto: "#ffffff",
        ok: "#2d6349", okBg: "#e0ece6",
        off: "#8a8294", offBg: "#e9e5ee",
        campo: "#faf8fc", sombra: "#1e1a26",
        avatar: "#4a3570",
      };
}

/** Sombra suave, distinta en cada plataforma. */
export function sombra(c, nivel = 1) {
  if (Platform.OS === "android") return { elevation: nivel * 2 };
  return {
    shadowColor: c.sombra,
    shadowOpacity: 0.06 * nivel,
    shadowRadius: 4 * nivel,
    shadowOffset: { width: 0, height: nivel },
  };
}

export const ventana = () => Dimensions.get("window");
