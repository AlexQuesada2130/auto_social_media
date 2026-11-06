import { redirect } from "next/navigation";

// La antigua sección "Dinero" se repartió en Inversiones, Gastos y Cripto.
export default function Dinero() {
  redirect("/gastos");
}
