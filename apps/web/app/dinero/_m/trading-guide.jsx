import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────
//  Hook: trae los artículos de la ruta /api/noticias (app/api/noticias/route.js)
// ─────────────────────────────────────────────────────────────────────────
function useNewsData() {
  const [state, setState] = useState({ loading: true, articles: [], error: null });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/noticias')
      .then(async (r) => {
        if (!r.ok) {
          let detail = `HTTP ${r.status}`;
          try {
            const j = await r.json();
            if (j?.error) detail = j.error;
          } catch (_) { /* ignore */ }
          throw new Error(detail);
        }
        return r.json();
      })
      .then((articles) => {
        if (cancelled) return;
        setState({ loading: false, articles: Array.isArray(articles) ? articles : [], error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, articles: [], error: err.message || 'Error desconocido' });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────
//  Categorías para filtrar
// ─────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'fondos', label: 'Fondos' },
  { id: 'mercados', label: 'Mercados' },
  { id: 'boglehead', label: 'Indexados' },
  { id: 'fiscal', label: 'Fiscalidad' },
];

const CATEGORY_KEYWORDS = {
  fondos: ['fondo', 'etf', 'ucits', 'vanguard', 'fidelity', 'ishares', 'amundi'],
  mercados: ['bolsa', 'mercado', 'ibex', 'sp500', 's&p', 'nasdaq', 'dólar', 'dolar', 'euro', 'wall street'],
  boglehead: ['index', 'indexado', 'pasiv', 'boglehead', 'msci', 'ftse'],
  fiscal: ['irpf', 'fiscal', 'impuesto', 'traspas', 'hacienda', 'declaración', 'declaracion'],
};

// ─────────────────────────────────────────────────────────────────────────
//  Tarjeta de artículo
// ─────────────────────────────────────────────────────────────────────────
function ArticleCard({ article }) {
  const date = article.pubDate
    ? new Date(article.pubDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const stripped = (article.summary ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const cleanSummary = stripped.length > 160 ? stripped.slice(0, 160) + '…' : stripped;

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-5 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          {article.source}
        </span>
        {date && <span className="text-[10px] text-slate-600 font-mono">{date}</span>}
      </div>
      <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition leading-snug line-clamp-2">
        {article.title}
      </h3>
      {cleanSummary && (
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
          {cleanSummary}
        </p>
      )}
      <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition mt-auto">
        Leer artículo <span>↗</span>
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Guías estáticas (contenido propio, no scrapeado)
// ─────────────────────────────────────────────────────────────────────────
const GUIDES = [
  {
    id: 'boglehead',
    icon: '🧭',
    title: 'La filosofía Boglehead',
    body: 'Invierte en fondos indexados de bajo coste, diversifica globalmente, aporta de forma regular y mantén el rumbo. John Bogle demostró que batir al mercado de forma consistente es casi imposible. La mejor estrategia es ser el mercado.',
    tips: ['TER < 0,20% es excelente', 'Reinvierte dividendos (clase ACC)', 'Ignora la volatilidad diaria'],
  },
  {
    id: 'dca',
    icon: '📅',
    title: 'Aportaciones periódicas (DCA)',
    body: 'Dollar-Cost Averaging: invierte la misma cantidad cada mes, independientemente del precio del mercado. Cuando el mercado baja, compras más participaciones. Cuando sube, compras menos. Elimina el riesgo de timing.',
    tips: ['Automatiza la aportación el día de cobro', 'No pares en caídas — ese es el momento de comprar más', 'La constancia supera a la inteligencia'],
  },
  {
    id: 'rebalanceo',
    icon: '⚖️',
    title: 'Rebalanceo de cartera',
    body: 'Con el tiempo, un fondo crece más que otro y rompe tu asignación objetivo (ej. 80% World / 20% EM). El rebalanceo consiste en vender el que más ha subido y comprar el que se ha quedado atrás para restaurar el equilibrio. Hazlo 1-2 veces al año.',
    tips: ['En España, vender genera evento fiscal (IRPF)', 'Rebalancea aportando al fondo rezagado cuando sea posible', 'Umbral del 5% de desviación es una regla habitual'],
  },
  {
    id: 'fiscal',
    icon: '🇪🇸',
    title: 'Fiscalidad en España',
    body: 'Los fondos de inversión gozan de ventaja fiscal única: puedes traspasar entre fondos SIN tributar. Solo pagas impuestos al vender definitivamente. Las ganancias tributan como rendimiento del capital mobiliario (19-28% según tramo).',
    tips: ['Traspaso entre fondos: 0% impuestos', 'Venta: 19% hasta 6.000€, 21% hasta 50.000€, 23-28% por encima', 'Compensa pérdidas con ganancias en el mismo año'],
  },
  {
    id: 'ter',
    icon: '💸',
    title: 'El impacto del TER',
    body: 'El TER (Total Expense Ratio) es el coste anual del fondo. Parece pequeño, pero su efecto en 30 años es devastador. Un 0,12% de TER vs un 1,5% de TER en 30 años con 100.000€ puede suponer más de 150.000€ de diferencia.',
    tips: ['Fidelity MSCI World: 0,12% TER', 'Evita fondos activos con TER > 0,50%', 'Usa Morningstar o JustETF para comparar'],
  },
];

function GuideCard({ guide }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition ${open ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/60'}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{guide.icon}</span>
          <span className="text-sm font-semibold text-white">{guide.title}</span>
        </div>
        <span className="text-slate-500 transition">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-slate-800">
          <p className="text-sm text-slate-300 leading-relaxed mt-4">{guide.body}</p>
          <ul className="mt-3 space-y-1">
            {guide.tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-emerald-400 mt-0.5 flex-none">✓</span> {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────
export function TradingGuide() {
  const { loading, articles, error } = useNewsData();
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('guia'); // 'guia' | 'noticias'

  const filteredArticles = articles.filter((a) => {
    if (activeCategory === 'all') return true;
    const text = `${a.title} ${a.summary}`.toLowerCase();
    const keywords = CATEGORY_KEYWORDS[activeCategory];
    return keywords ? keywords.some((k) => text.includes(k)) : true;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            📚 Aprende a Invertir
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Guías en español para inversores indexados + últimas noticias de mercado.
          </p>
        </div>
        {/* Tabs */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
          {[{ id: 'guia', label: '📖 Guía' }, { id: 'noticias', label: '📰 Noticias' }].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'guia' && (
        <div className="flex flex-col gap-3">
          {GUIDES.map((g) => <GuideCard key={g.id} guide={g} />)}
        </div>
      )}

      {activeTab === 'noticias' && (
        <>
          {/* Filtros por categoría */}
          <div className="flex flex-wrap gap-2 mb-5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  activeCategory === c.id
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
              <div className="animate-spin mr-3 h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent"></div>
              Obteniendo noticias…
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-400 text-sm">
              Error cargando noticias: {error}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredArticles.length > 0
                ? filteredArticles.map((a, i) => <ArticleCard key={`${a.link}-${i}`} article={a} />)
                : <div className="col-span-full text-center py-8 text-slate-500 text-sm">Sin artículos para este filtro.</div>
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
