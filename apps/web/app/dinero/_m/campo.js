import { useCallback } from "react";
import { useCandado } from "../../candado";

// Un campo de la bóveda como si fuera un useState: [valor, setValor].
export function useVaultField(campo, porDefecto) {
  const { datos, actualizar } = useCandado();
  const valor = datos[campo] ?? porDefecto;
  const setValor = useCallback(
    (sig) => actualizar((d) => ({ ...d, [campo]: typeof sig === "function" ? sig(d[campo] ?? porDefecto) : sig })),
    [campo, porDefecto, actualizar]
  );
  return [valor, setValor];
}
