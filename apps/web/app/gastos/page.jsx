"use client";

import { MoneyManager } from "../_finanzas/money";
import { Marco } from "../_finanzas/marco";

export default function Gastos() {
  return (
    <Marco titulo="Gastos mensuales" subtitulo="Ingresos, gastos, presupuestos y ahorro del mes.">
      <MoneyManager />
    </Marco>
  );
}
