"use client";

import { MoneyManager } from "../_finanzas/money";
import { Marco } from "../_finanzas/marco";

export default function Gastos() {
  return (
    <Marco titulo="Gastos" subtitulo="Tu dinero de hoy, lo que te queda hasta cobrar y a dónde va cada nómina.">
      <MoneyManager />
    </Marco>
  );
}
