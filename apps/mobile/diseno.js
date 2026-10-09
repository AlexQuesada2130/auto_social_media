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
  return oscuro
    ? {
        papel: "#15140f", tarjeta: "#1e1d18", elevado: "#262520",
        tinta: "#ece8e0", suave: "#a39d93", tenue: "#7d766c",
        linea: "#33302a", lineaSuave: "#282621",
        acento: "#e2795a", acentoBg: "#3a2119", acentoTexto: "#15140f",
        ok: "#7bc09f", okBg: "#1b2f26",
        off: "#8a8279", offBg: "#26241f",
        campo: "#26241f", sombra: "#000000",
      }
    : {
        papel: "#f1efe9", tarjeta: "#ffffff", elevado: "#faf9f6",
        tinta: "#1f1d1a", suave: "#6a655d", tenue: "#938d84",
        linea: "#ddd8cf", lineaSuave: "#e8e4dc",
        acento: "#b4472b", acentoBg: "#f7e6e0", acentoTexto: "#ffffff",
        ok: "#2d6349", okBg: "#e0ece6",
        off: "#8a8279", offBg: "#e9e6e0",
        campo: "#faf9f6", sombra: "#1f1d1a",
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
