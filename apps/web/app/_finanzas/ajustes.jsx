import React, { useEffect, useRef, useState } from 'react';
import { lucide } from './components';
import { useCandado } from '../candado';
import { copiaCifrada, esCopiaCifrada, abrirCopia, descargar, datosVacios } from '@/lib/boveda';

const hoy = () => new Date().toISOString().slice(0, 10);

const campo =
  "w-full rounded-lg border border-rule bg-field px-3 py-2 text-sm text-ink placeholder-faint focus:border-accent focus:outline-none";

function Seccion({ titulo, texto, children, peligro }) {
  return (
    <section className={`rounded-xl border p-4 ${peligro ? 'border-neg bg-neg-bg' : 'border-rule bg-field'}`}>
      <h3 className={`text-sm font-semibold ${peligro ? 'text-neg' : 'text-ink'}`}>{titulo}</h3>
      {texto && <p className="text-xs text-muted mt-1 mb-3 leading-relaxed">{texto}</p>}
      {children}
    </section>
  );
}

function Boton({ onClick, icono, children, tono = 'neutro', disabled, type = 'button', value }) {
  const tonos = {
    neutro: 'border-rule text-ink hover:border-accent hover:text-ink',
    peligro: 'border-neg text-neg hover:bg-neg-bg',
  };
  return (
    <button type={type} value={value} onClick={onClick} disabled={disabled}
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
          <p className="text-[11px] text-muted">Puede ser la misma de la app. La necesitarás para importarla en otro dispositivo.</p>
          <div className="flex gap-2">
            <Boton type="submit" disabled={!valida || ocupado} icono={<lucide.Lock size={14} />}>{ocupado ? 'Cifrando…' : 'Descargar copia cifrada'}</Boton>
            <button type="button" onClick={() => setPidiendo(false)} className="text-xs text-muted hover:text-ink px-2">Cancelar</button>
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
      <p className="text-[11px] text-muted mt-3 leading-relaxed">
        La copia cifrada es la recomendada. Los otros dos formatos van <span className="text-warn">sin cifrar</span>.
        Sirven también las copias de StadisticWallet.
      </p>
    </Seccion>
  );
}

// Añade una copia a lo que ya hay sin borrar nada. Las listas de objetos con
// id se unen por id (gana la copia); los objetos se mezclan campo a campo; el
// resto lo pone la copia si trae valor.
export function fusionar(actual, nuevo) {
  if (Array.isArray(actual) && Array.isArray(nuevo)) {
    if (![...actual, ...nuevo].every((x) => x && typeof x === 'object' && x.id != null)) return nuevo.length ? nuevo : actual;
    const porId = new Map(actual.map((x) => [x.id, x]));
    for (const x of nuevo) porId.set(x.id, porId.has(x.id) ? fusionar(porId.get(x.id), x) : x);
    return [...porId.values()];
  }
  if (actual && nuevo && typeof actual === 'object' && typeof nuevo === 'object' && !Array.isArray(actual) && !Array.isArray(nuevo)) {
    const r = { ...actual };
    for (const [k, v] of Object.entries(nuevo)) r[k] = k in actual ? fusionar(actual[k], v) : v;
    return r;
  }
  return nuevo ?? actual;
}

function Importar() {
  const { actualizar } = useCandado();
  const fichero = useRef(null);
  const [pendiente, setPendiente] = useState(null);
  const [clave, setClave] = useState('');
  const [aviso, setAviso] = useState(null);
  const [pegando, setPegando] = useState(false);
  const [texto, setTexto] = useState('');

  // Archivo o texto pegado: el mismo JSON de una copia.
  const leer = (nombre, bruto) => {
    setAviso(null);
    try {
      const o = JSON.parse(bruto);
      if (esCopiaCifrada(o)) setPendiente({ nombre, contenido: o, cifrada: true });
      else if (o?.schema === 1) setPendiente({ nombre, contenido: o, cifrada: false });
      else throw new Error();
      setPegando(false);
      setTexto('');
    } catch {
      setAviso({ error: true, texto: 'Eso no es una copia de dinero (tiene que ser el JSON completo, con "schema": 1)' });
    }
  };
  const elegir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) leer(f.name, await f.text());
  };

  const confirmar = async (e) => {
    e.preventDefault();
    const modo = e.nativeEvent.submitter?.value ?? 'anadir';
    try {
      const copia = pendiente.cifrada ? await abrirCopia(pendiente.contenido, clave) : { ...datosVacios(), ...pendiente.contenido };
      if (modo === 'reemplazar') actualizar(() => copia);
      else {
        const { schema, createdAt, updatedAt, settings, ...resto } = copia;
        actualizar((d) => fusionar(d, resto));
      }
      setPendiente(null);
      setClave('');
      setAviso({ texto: modo === 'reemplazar' ? `Reemplazado: ${copia.transactions?.length ?? 0} movimientos.` : 'Añadido a tus datos. No se ha borrado nada.' });
    } catch (err) {
      setAviso({ error: true, texto: err.message });
    }
  };

  return (
    <Seccion titulo="Importar copia" texto="Añade una copia a tu dinero o sustitúyelo por ella. Queda cifrado con la contraseña de la app.">
      {pendiente ? (
        <form onSubmit={confirmar} className="space-y-2">
          <div className="text-xs text-ink">Copia: <span className="font-mono">{pendiente.nombre}</span></div>
          {pendiente.cifrada && (
            <input type="password" autoFocus placeholder="Contraseña de esa copia" value={clave} onChange={(e) => setClave(e.target.value)} className={campo} />
          )}
          <p className="text-[11px] text-muted">«Añadir» junta la copia con lo que tienes (si algo existe en los dos, gana la copia). «Reemplazar» <span className="text-warn">borra lo actual</span>.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" value="anadir" disabled={pendiente.cifrada && !clave} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-text disabled:opacity-40">Añadir a mis datos</button>
            <Boton type="submit" value="reemplazar" tono="peligro" disabled={pendiente.cifrada && !clave}>Reemplazar</Boton>
            <button type="button" onClick={() => setPendiente(null)} className="text-xs text-muted hover:text-ink px-2">Cancelar</button>
          </div>
        </form>
      ) : pegando ? (
        <div className="space-y-2">
          <textarea autoFocus rows={8} spellCheck={false} placeholder='{ "schema": 1, ... }' value={texto} onChange={(e) => setTexto(e.target.value)} className={`${campo} font-mono text-xs`} aria-label="JSON de la copia" />
          <div className="flex gap-2">
            <Boton disabled={!texto.trim()} onClick={() => leer('texto pegado', texto)}>Continuar</Boton>
            <button type="button" onClick={() => { setPegando(false); setTexto(''); setAviso(null); }} className="text-xs text-muted hover:text-ink px-2">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton icono={<lucide.Upload size={14} />} onClick={() => fichero.current?.click()}>Elegir archivo…</Boton>
          <Boton onClick={() => setPegando(true)}>Pegar JSON</Boton>
        </div>
      )}
      <input ref={fichero} type="file" accept="application/json,.json" hidden onChange={elegir} />
      {aviso && <p className={`text-xs mt-2 ${aviso.error ? 'text-neg' : 'text-pos'}`}>{aviso.texto}</p>}
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
      <aside role="dialog" aria-label="Ajustes del dinero" className="relative h-full w-full max-w-md overflow-y-auto border-l border-rule bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2"><lucide.Settings size={16} /> Ajustes del dinero</h2>
          <button onClick={onCerrar} className="text-muted hover:text-ink" aria-label="Cerrar"><lucide.X size={18} /></button>
        </div>
        <div className="rounded-xl border border-accent bg-accent-bg p-3 text-xs text-accent flex gap-2">
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
