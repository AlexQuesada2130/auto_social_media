// Preferencias de recordatorios. Solo datos que no dicen nada de tu dinero:
// el día del mes en que quieres el aviso de los fondos.

import { leer, guardar } from "./kvpropio";

const CLAVE = "mesa:recordatorios";

export const leerRecordatorios = () => leer(CLAVE, {});
export const guardarRecordatorios = (datos) => guardar(CLAVE, datos);
