import React, { useEffect, useRef, useState } from 'react';
import { lucide } from './components';
import { useCandado } from '../../candado';
import { copiaCifrada, esCopiaCifrada, abrirCopia, descargar, datosVacios } from '@/lib/boveda';

const hoy = () => new Date().toISOString().slice(0, 10);

const campo =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none";

function Seccion({ titulo, texto, children, peligro }) {
  return (
    <section className={`rounded-xl border p-4 ${peligro ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-950/50'}`}>
      <h3 className={`text-sm font-semibold ${peligro ? 'text-red-300' : 'text-white'}`}>{titulo}</h3>
      {texto && <p className="text-xs text-slate-400 mt-1 mb-3 leading-relaxed">{texto}</p>}
      {children}
    </section>
  );
}

function Boton({ onClick, icono, children, tono = 'neutro', disabled, type = 'button' }) {
  const tonos = {
    neutro: 'border-slate-700 text-slate-200 hover:border-emerald-500/60 hover:text-white',
    peligro: 'border-red-500/40 text-red-300 hover:bg-red-500/10',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-40 ${tonos[tono]}`}>
      {icono}{children}
    </button>
  );
}

function aCSV(movimientos) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [...movimientos]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [t.date, t.type === 'income' ? 'Ingreso' : 'Gasto', t.category,
      (t.type === 'income' ? t.amount : -t.amount).toFixed(2).replace('.', ','), t.note]);
  // ";" y coma decimal para que Excel en español lo abra bien a la primera.
  return '﻿' + [['Fecha', 'Tipo', 'Categoría', 'Importe', 'Nota'], ...filas].map((r) => r.map(esc).join(';')).join('\r\n');
}

function Exportar({ datos }) {
  const [pidiendo, setPidiendo] = useState(false);
  const [clave, setClave] = useState('');
  const [repite, setRepite] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const valida = clave.length >= 8 && clave === repite;

  const cifrada = async (e) => {
    e.preventDefault();
    setOcupado(true);
    const copia = await copiaCifrada(datos, clave);
    descargar(`dinero-copia-cifrada-${hoy()}.json`, JSON.stringify(copia), 'application/json');
    setOcupado(false);
    setPidiendo(false);
    setClave('');
    setRepite('');
  };

  return (
    <Seccion titulo="Exportar" texto="Las copias se generan en este dispositivo; no pasan por ningún servidor.">
      {pidiendo ? (
        <form onSubmit={cifrada} className="space-y-2">
          <input type="password" autoFocus autoComplete="new-password" placeholder="Contraseña para esta copia (mín. 8)" value={clave} onChange={(e) => setClave(e.target.value)} className={campo} />
          <input type="password" autoComplete="new-password" placeholder="Repítela" value={repite} onChange={(e) => setRepite(e.target.value)} className={campo} />
          <p className="text-[11px] text-slate-500">Puede ser la misma de la app. La necesitarás para importarla en otro dispositivo.</p>
          <div className="flex gap-2">
            <Boton type="submit" disabled={!valida || ocupado} icono={<lucide.Lock size={14} />}>{ocupado ? 'Cifrando…' : 'Descargar copia cifrada'}</Boton>
            <button type="button" onClick={() => setPidiendo(false)} className="text-xs text-slate-400 hover:text-white px-2">Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton icono={<lucide.Lock size={14} />} onClick={() => setPidiendo(true)}>Copia cifrada (.json)</Boton>
          <Boton icono={<lucide.Download size={14} />}
            onClick={() => descargar(`dinero-datos-${hoy()}.json`, JSON.stringify(datos, null, 2), 'application/json')}>
            Datos legibles (.json)
          </Boton>
          <Boton icono={<lucide.Download size={14} />} disabled={!datos.transactions.length}
            onClick={() => descargar(`dinero-movimientos-${hoy()}.csv`, aCSV(datos.transactions), 'text/csv;charset=utf-8')}>
            Movimientos (.csv)
          </Boton>
        </div>
      )}
      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
        La copia cifrada es la recomendada. Los otros dos formatos van <span className="text-amber-300/80">sin cifrar</span>.
        Sirven también las copias de StadisticWallet.
      </p>
    </Seccion>
  );
}

function Importar() {
  const { actualizar } = useCandado();
  const fichero = useRef(null);
  const [pendiente, setPendiente] = useState(null);
  const [clave, setClave] = useState('');
  const [aviso, setAviso] = useState(null);

  const elegir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAviso(null);
    try {
      const o = JSON.parse(await f.text());
      if (esCopiaCifrada(o)) setPendiente({ nombre: f.name, contenido: o, cifrada: true });
      else if (o?.schema === 1) setPendiente({ nombre: f.name, contenido: o, cifrada: false });
      else throw new Error();
    } catch {
      setAviso({ error: true, texto: 'Ese archivo no es una copia de dinero' });
    }
  };

  const confirmar = async (e) => {
    e.preventDefault();
    try {
      const sig = pendiente.cifrada ? await abrirCopia(pendiente.contenido, clave) : { ...datosVacios(), ...pendiente.contenido };
      actualizar(() => sig);
      setPendiente(null);
      setClave('');
      setAviso({ texto: `Importado: ${sig.transactions?.length ?? 0} movimientos.` });
    } catch (err) {
      setAviso({ error: true, texto: err.message });
    }
  };

  return (
    <Seccion titulo="Importar copia" texto="Sustituye el dinero de este dispositivo por el de una copia. Queda cifrado con la contraseña de la app.">
      {pendiente ? (
        <form onSubmit={confirmar} className="space-y-2">
          <div className="text-xs text-slate-300">Archivo: <span className="font-mono">{pendiente.nombre}</span></div>
          {pendiente.cifrada && (
            <input type="password" autoFocus placeholder="Contraseña de esa copia" value={clave} onChange={(e) => setClave(e.target.value)} className={campo} />
          )}
          <p className="text-[11px] text-amber-300/80">Esto reemplaza lo que tienes ahora.</p>
          <div className="flex gap-2">
            <Boton type="submit" tono="peligro" disabled={pendiente.cifrada && !clave}>Reemplazar mis datos</Boton>
            <button type="button" onClick={() => setPendiente(null)} className="text-xs text-slate-400 hover:text-white px-2">Cancelar</button>
          </div>
        </form>
      ) : (
        <Boton icono={<lucide.Upload size={14} />} onClick={() => fichero.current?.click()}>Elegir archivo…</Boton>
      )}
      <input ref={fichero} type="file" accept="application/json,.json" hidden onChange={elegir} />
      {aviso && <p className={`text-xs mt-2 ${aviso.error ? 'text-red-400' : 'text-emerald-400'}`}>{aviso.texto}</p>}
    </Seccion>
  );
}

function Vaciar() {
  const { actualizar } = useCandado();
  const [texto, setTexto] = useState('');
  return (
    <Seccion peligro titulo="Vaciar el dinero" texto="Borra movimientos, presupuestos y posiciones de este dispositivo. No se puede deshacer: exporta antes.">
      <div className="flex flex-wrap gap-2">
        <input placeholder='Escribe "BORRAR"' value={texto} onChange={(e) => setTexto(e.target.value)} className={`${campo} max-w-[12rem]`} />
        <Boton tono="peligro" disabled={texto !== 'BORRAR'} icono={<lucide.Trash size={14} />}
          onClick={() => { actualizar((d) => ({ ...datosVacios(), settings: d.settings })); setTexto(''); }}>
          Vaciar
        </Boton>
      </div>
    </Seccion>
  );
}

export function AjustesDinero({ onCerrar }) {
  const { datos } = useCandado();

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCerrar} />
      <aside role="dialog" aria-label="Ajustes del dinero" className="relative h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2"><lucide.Settings size={16} /> Ajustes del dinero</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-white" aria-label="Cerrar"><lucide.X size={18} /></button>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200/90 flex gap-2">
          <lucide.ShieldCheck size={14} className="shrink-0 mt-0.5" />
          <span>Cifrado con AES-256 y guardado solo en este dispositivo. No se envía al servidor. El móvil y el ordenador tienen cada uno el suyo: para pasar datos, exporta e importa una copia.</span>
        </div>
        <Exportar datos={datos} />
        <Importar />
        <Vaciar />
      </aside>
    </div>
  );
}
