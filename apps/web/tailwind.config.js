/** @type {import('tailwindcss').Config} */
module.exports = {
  // Solo la sección de dinero usa Tailwind. Sin preflight, para no tocar los
  // estilos de la Mesa, y con todo colgando de #dinero para no chocar con sus
  // clases globales (.card, .btn, .panel…).
  content: ["./app/dinero/**/*.{js,jsx}"],
  important: "#dinero",
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
