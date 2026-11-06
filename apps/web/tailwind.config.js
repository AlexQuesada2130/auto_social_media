/** @type {import('tailwindcss').Config} */
module.exports = {
  // Solo la sección de dinero usa Tailwind. Sin preflight, para no tocar los
  // estilos de la Mesa, y con todo colgando de #dinero para no chocar con sus
  // clases globales (.card, .btn, .panel…).
  content: ["./app/dinero/**/*.{js,jsx}"],
  important: "#dinero",
  corePlugins: { preflight: false },
  theme: {
    extend: {
      // Los colores salen de las variables de globals.css, así que Dinero
      // sigue el modo claro/oscuro y el morado de la Mesa. Positivo, negativo
      // y aviso solo se usan donde el color significa algo.
      colors: {
        paper: "var(--paper)",
        card: "var(--card)",
        field: "var(--field)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        rule: "var(--rule)",
        "rule-soft": "var(--rule-soft)",
        accent: "var(--accent)",
        "accent-bg": "var(--accent-bg)",
        "accent-text": "var(--accent-text)",
        pos: "var(--pos)",
        "pos-bg": "var(--pos-bg)",
        neg: "var(--neg)",
        "neg-bg": "var(--neg-bg)",
        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`serie-${n}`, `var(--serie-${n})`])),
      },
      boxShadow: { glow: "var(--glow)" },
      // Las esquinas de la Mesa: 10px en tarjetas, 3px en botones y campos.
      borderRadius: { md: "3px", lg: "4px", xl: "8px", "2xl": "10px" },
    },
  },
  plugins: [],
};
