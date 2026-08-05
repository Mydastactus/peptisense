const { useState, useMemo, useRef, useEffect } = React;

/* ---- lucide icon wrapper ---- */
const toPascal = (s) => s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join("");
function Icon({ name, size = 22, stroke = 2, className = "" }) {
  const icons = (window.lucide && window.lucide.icons) ? window.lucide.icons : {};
  const data = icons[name] || icons[toPascal(name)];
  if (!data) return null;
  const children = data.map((c, i) => React.createElement(c[0], { ...c[1], key: i }));
  return React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round",
    strokeLinejoin: "round", className,
  }, children);
}

/* ---- design tokens ---- */
const ACCENTS = {
  cyan: { hex:"#00F2FE", text:"text-[#00F2FE]", glow:"shadow-[0_0_24px_-4px_rgba(0,242,254,0.55)]", from:"from-[#00F2FE]", to:"to-[#14B8A6]", ring:"ring-[#00F2FE]/30", soft:"bg-[#00F2FE]/10", raw:"#00F2FE" },
  teal: { hex:"#14B8A6", text:"text-[#14B8A6]", glow:"shadow-[0_0_24px_-4px_rgba(20,184,166,0.55)]", from:"from-[#14B8A6]", to:"to-[#3B82F6]", ring:"ring-[#14B8A6]/30", soft:"bg-[#14B8A6]/10", raw:"#14B8A6" },
  blue: { hex:"#3B82F6", text:"text-[#3B82F6]", glow:"shadow-[0_0_24px_-4px_rgba(59,130,246,0.55)]", from:"from-[#3B82F6]", to:"to-[#00F2FE]", ring:"ring-[#3B82F6]/30", soft:"bg-[#3B82F6]/10", raw:"#3B82F6" },
};

/* ---- storage ---- */
const PKEY = "peptisense_protocols_v1";
function loadProtocols(){ try{ const d=JSON.parse(localStorage.getItem(PKEY)); return Array.isArray(d)?d:[]; }catch(e){ return []; } }
function saveProtocols(a){ try{ localStorage.setItem(PKEY, JSON.stringify(a)); }catch(e){} }

const HKEY = "peptisense_health_v1";
function loadHealth() { try { return JSON.parse(localStorage.getItem(HKEY)) || null; } catch (e) { return null; } }
function saveHealth(d) { try { localStorage.setItem(HKEY, JSON.stringify(d)); } catch (e) {} }
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const hoursFrom = (v) => (v == null ? null : (v > 24 ? v / 60 : v));
const fmtDur = (h) => { if (h == null) return "—"; const m = Math.round(h * 60); const hh = Math.floor(m / 60), mm = m % 60; return hh ? `${hh}h ${mm}m` : `${mm}m`; };

/* ---- primitives ---- */
function Sparkline({ data, color, height = 34 }) {
  const p = useMemo(() => {
    const w=100,h=height,min=Math.min(...data),max=Math.max(...data),span=(max-min)||1,step=w/(data.length-1);
    const pts=data.map((d,i)=>[i*step, h-((d-min)/span)*(h-6)-3]);
    const line=pts.map((q,i)=>`${i?"L":"M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
    return { line, area:`${line} L${w},${h} L0,${h} Z`, last:pts[pts.length-1] };
  }, [data,height]);
  const gid = "sp"+color.replace("#","");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{height}}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.35"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={p.area} fill={`url(#${gid})`} />
      <path d={p.line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={p.last[0]} cy={p.last[1]} r="2.6" fill={color} />
    </svg>
  );
}

function Panel({ className="", children, glow=false, accent }) {
  const a = ACCENTS[accent];
  return <div className={["relative rounded-3xl border border-[#30363D] bg-[#161B22]/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.45)]", (glow&&a)?a.glow:"", className].join(" ")}>{children}</div>;
}

function DeltaBadge({ delta }) {
  const up = delta >= 0;
  return <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", up?"bg-[#14B8A6]/15 text-[#14B8A6]":"bg-red-500/15 text-red-400"].join(" ")}>
    <Icon name={up?"trending-up":"trending-down"} size={12} stroke={2.5} />{up?"+":""}{delta}%
  </span>;
}

function SectionHeading({ title, hint, icon }) {
  return <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {icon && <Icon name={icon} size={16} className="text-[#00F2FE]" />}
      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-300">{title}</h2>
    </div>
    {hint && <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">{hint} <Icon name="chevron-right" size={13} /></span>}
  </div>;
}

/* small labelled input used in sheets */
function Field({ label, children }) {
  return <label className="mt-3 block">
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>;
}
const inputCls = "w-full rounded-xl border border-[#30363D] bg-[#0F172A] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-[#00F2FE]/50";

/* ---- header ---- */
function Header({ onProfile }) {
  const today = new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
  return <header className="flex items-center justify-between px-5 pt-6 pb-2">
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#00F2FE] to-[#3B82F6] shadow-[0_0_24px_-2px_rgba(0,242,254,0.7)]">
        <Icon name="atom" size={24} stroke={2.2} className="text-[#04121a]" />
        <span className="absolute inset-0 rounded-2xl bg-[#00F2FE]/30 blur-md -z-10" />
      </div>
      <div>
        <h1 className="text-[15px] font-extrabold tracking-[0.22em] text-white">PEPTISENSE</h1>
        <p className="text-xs text-slate-400">{today}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/10 px-3 py-1 text-xs font-semibold text-[#14B8A6]">
        <Icon name="shield-check" size={13} /> Private
      </span>
      <button onClick={onProfile} aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#14B8A6] to-[#3B82F6] text-[#04121a] ring-2 ring-[#00F2FE]/40 transition active:scale-95">
        <Icon name="user" size={20} stroke={2.4} />
      </button>
    </div>
  </header>;
}

function CalloutBanner() {
  return <div className="mx-5 mt-3 flex items-start gap-3 overflow-hidden rounded-2xl border border-[#00F2FE]/25 bg-gradient-to-r from-[#00F2FE]/10 via-[#14B8A6]/5 to-transparent p-4">
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00F2FE]/15 text-[#00F2FE]"><Icon name="alarm-clock" size={18} /></div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-white">Timing tip</p>
      <p className="text-[13px] leading-snug text-slate-300">For GH-releasing peptides, many protocols suggest fasting <span className="font-semibold text-[#00F2FE]">~2 hours</span> post-dose. Always confirm with your own protocol.</p>
    </div>
  </div>;
}

/* ---- protocols ---- */
function ProtocolCard({ p, onLog, onEdit }) {
  const a = ACCENTS[p.accent] || ACCENTS.cyan;
  const total = p.total || 0;
  const pct = total ? Math.round((p.done/total)*100) : 0;
  const complete = total>0 && p.done>=total;
  return <Panel accent={p.accent} glow className="p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${a.soft} ${a.text} ring-1 ${a.ring}`}><Icon name="syringe" size={26} /></div>
        <div className="min-w-0"><h3 className="text-lg font-bold leading-tight text-white truncate">{p.name}</h3><p className="text-sm text-slate-400 truncate">{p.route}</p></div>
      </div>
      <button onClick={()=>onEdit(p)} aria-label="Edit protocol" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#30363D] text-slate-400 transition hover:text-white"><Icon name="pencil" size={15} /></button>
    </div>
    <div className={`mt-5 text-3xl font-extrabold ${a.text}`}>{p.dose}</div>
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-400">This week</span><span className="font-semibold text-slate-200">{p.done}/{total} doses</span></div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[#0F172A]"><div className={`h-full rounded-full bg-gradient-to-r ${a.from} ${a.to} transition-all duration-500`} style={{width:`${pct}%`}} /></div>
    </div>
    <div className="mt-6 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <Icon name="clock" size={16} className={p.next?a.text:"text-slate-500"} />
        <span className="text-slate-400">Next</span>
        <span className={`font-semibold truncate ${p.next?a.text:"text-slate-500"}`}>{p.next||"—"}</span>
      </div>
      <button onClick={()=>onLog(p.id)} disabled={complete}
        className={["inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition", complete?"cursor-default bg-[#14B8A6]/15 text-[#14B8A6]":`bg-gradient-to-r ${a.from} ${a.to} text-[#04121a] active:scale-95 ${a.glow}`].join(" ")}>
        {complete ? <><Icon name="check" size={16} stroke={3} /> Done</> : <><Icon name="plus" size={16} stroke={3} /> Log Dose</>}
      </button>
    </div>
  </Panel>;
}

/* ---- reusable coverflow carousel: cards rotate/overlap around the center ---- */
function Coverflow({ items, renderCard, keyOf }) {
  const scroller = useRef(null);
  const raf = useRef(0);
  const idxRef = useRef(0);
  const [idx, setIdx] = useState(0);
  const [cardW, setCardW] = useState(260);

  const update = () => {
    const el = scroller.current; if (!el) return;
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
    const cards = el.querySelectorAll("[data-cf]");
    let best = 0, bestDist = Infinity;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const cc = r.left + r.width / 2;
      const delta = r.width ? (cc - mid) / r.width : 0;       // ~ -1 = one card left, +1 = one right
      const cl = Math.max(-2.4, Math.min(2.4, delta));
      const abs = Math.abs(cl), a1 = Math.min(abs, 1);
      const inner = c.children[0];
      if (inner) {
        const pull = r.width * 0.30;                          // slide neighbours toward centre so they overlap
        const rot = Math.max(-56, Math.min(56, -cl * 52));
        const scale = Math.max(0.70, 1 - a1 * 0.14 - Math.max(abs - 1, 0) * 0.05);
        const op = Math.max(0.25, 1 - a1 * 0.08 - Math.max(abs - 1, 0) * 0.5);
        inner.style.transform = `translateX(${-cl * pull}px) rotateY(${rot}deg) scale(${scale})`;
        inner.style.opacity = String(op);
        inner.style.pointerEvents = abs < 0.5 ? "auto" : "none"; // only the focused card is tappable
      }
      c.style.zIndex = String(1000 - Math.round(abs * 100));
      const d = Math.abs(cc - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best !== idxRef.current) { idxRef.current = best; setIdx(best); }
  };

  const layout = () => {
    const el = scroller.current; if (!el) return;
    const w = el.clientWidth;
    const cw = Math.max(230, Math.min(Math.round(w * 0.62), 340));
    const pad = Math.max(Math.round((w - cw) / 2), 8);
    el.style.paddingLeft = pad + "px";
    el.style.paddingRight = pad + "px";
    setCardW(cw);
  };

  useEffect(() => { layout(); const onR = () => { layout(); requestAnimationFrame(update); }; window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR); }, []);
  useEffect(() => { const t = requestAnimationFrame(update); return () => cancelAnimationFrame(t); }, [cardW, items.length]);

  const onScroll = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(update); };
  const goTo = (i) => {
    const el = scroller.current; if (!el) return;
    const cards = el.querySelectorAll("[data-cf]");
    const c = cards[Math.max(0, Math.min(i, cards.length - 1))]; if (!c) return;
    const r = c.getBoundingClientRect(); const er = el.getBoundingClientRect();
    el.scrollTo({ left: el.scrollLeft + (r.left + r.width / 2) - (er.left + el.clientWidth / 2), behavior: "smooth" });
  };

  return (
    <div>
      <div className="relative">
        <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto py-8">
          {items.map((it, i) => (
            <div key={keyOf ? keyOf(it, i) : i} data-cf className="shrink-0 snap-center" style={{ width: cardW, perspective: "1000px" }}>
              <div style={{ transformOrigin: "center center", transition: "transform .08s ease-out, opacity .08s ease-out", willChange: "transform" }}>
                {renderCard(it, i)}
              </div>
            </div>
          ))}
        </div>
        {idx > 0 && <button onClick={() => goTo(idx - 1)} aria-label="Previous" className="absolute left-2 top-1/2 z-[1100] hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#30363D] bg-[#161B22]/90 text-slate-300 backdrop-blur transition hover:text-white sm:grid"><Icon name="chevron-left" size={18} /></button>}
        {idx < items.length - 1 && <button onClick={() => goTo(idx + 1)} aria-label="Next" className="absolute right-2 top-1/2 z-[1100] hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#30363D] bg-[#161B22]/90 text-slate-300 backdrop-blur transition hover:text-white sm:grid"><Icon name="chevron-right" size={18} /></button>}
      </div>
      {items.length > 1 && (
        <div className="mt-1 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Card ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-[#00F2FE] shadow-[0_0_8px_#00F2FE]" : "w-1.5 bg-slate-600 hover:bg-slate-500"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveProtocols({ protocols, onLog, onEdit, onAdd }) {
  return (
    <section id="protocols" className="pt-6">
      <div className="flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-300">Active Protocols</h2>
          {protocols.length>0 && <span className="text-xs text-slate-500">{protocols.length} running</span>}
        </div>
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg bg-[#00F2FE]/10 px-2.5 py-1.5 text-xs font-bold text-[#00F2FE] transition active:scale-95"><Icon name="plus" size={14} stroke={2.6} /> Add</button>
      </div>
      {protocols.length === 0 ? (
        <div className="mt-3 px-5">
          <Panel className="p-7 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#00F2FE]/10 text-[#00F2FE]"><Icon name="syringe" size={22} /></div>
            <p className="mt-3 font-semibold text-white">No active protocols yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">Add your first protocol to start tracking doses, timing, and weekly compliance.</p>
            <button onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#3B82F6] px-4 py-2.5 text-sm font-bold text-[#04121a] transition active:scale-95"><Icon name="plus" size={16} stroke={2.6} /> Add a protocol</button>
          </Panel>
        </div>
      ) : (
        <div className="mt-1">
          <Coverflow items={protocols} keyOf={(p)=>p.id} renderCard={(p)=><ProtocolCard p={p} onLog={onLog} onEdit={onEdit} />} />
        </div>
      )}
    </section>
  );
}

/* ---- protocol add/edit sheet ---- */
function ProtocolSheet({ editing, onClose, onSave, onDelete }) {
  const isNew = editing === "new";
  const p = isNew ? null : editing;
  const [name, setName] = useState(p ? p.name : "");
  const doseParts = p ? String(p.dose||"").split(" ") : [];
  const [amount, setAmount] = useState(p ? (doseParts[0]||"") : "");
  const [unit, setUnit] = useState(p ? (doseParts[1]||"mcg") : "mcg");
  const [schedule, setSchedule] = useState(p ? (p.route==="—"?"":p.route) : "");
  const [total, setTotal] = useState(p ? p.total : 7);
  const [next, setNext] = useState(p ? p.next : "");
  const [accent, setAccent] = useState(p ? p.accent : "cyan");
  const [err, setErr] = useState("");
  const save = () => {
    if (!name.trim()) { setErr("Give your protocol a name."); return; }
    onSave({
      id: p ? p.id : "p" + Date.now().toString(36),
      name: name.trim(),
      dose: `${amount || "0"} ${unit}`,
      route: schedule.trim() || "—",
      accent,
      total: Math.max(parseInt(total) || 1, 1),
      done: p ? Math.min(p.done, Math.max(parseInt(total)||1,1)) : 0,
      next: next.trim(),
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-y-auto rounded-t-3xl border border-b-0 border-[#30363D] bg-[#161B22] p-5 pb-9" style={{maxHeight:"92vh"}} onClick={(e)=>e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#30363D]" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{isNew ? "Add protocol" : "Edit protocol"}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 transition hover:text-white"><Icon name="x" size={20} /></button>
        </div>

        <Field label="Peptide name"><input className={inputCls} value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. BPC-157" /></Field>
        <div className="flex gap-3">
          <div className="flex-1"><Field label="Dose amount"><input type="number" className={inputCls} value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="250" /></Field></div>
          <div className="w-28"><Field label="Unit"><select className={inputCls} value={unit} onChange={(e)=>setUnit(e.target.value)}><option>mcg</option><option>mg</option><option>IU</option><option>mL</option></select></Field></div>
        </div>
        <Field label="Schedule / route"><input className={inputCls} value={schedule} onChange={(e)=>setSchedule(e.target.value)} placeholder="e.g. Subcutaneous · Daily" /></Field>
        <div className="flex gap-3">
          <div className="flex-1"><Field label="Doses per week (target)"><input type="number" className={inputCls} value={total} onChange={(e)=>setTotal(e.target.value)} placeholder="7" /></Field></div>
          <div className="flex-1"><Field label="Next dose (optional)"><input className={inputCls} value={next} onChange={(e)=>setNext(e.target.value)} placeholder="e.g. Tonight 10 PM" /></Field></div>
        </div>
        <Field label="Color">
          <div className="flex gap-2">
            {["cyan","teal","blue"].map((c)=>(
              <button key={c} onClick={()=>setAccent(c)} aria-label={c} className={`h-10 flex-1 rounded-xl border-2 transition ${accent===c?"border-white":"border-transparent opacity-70"}`} style={{background:ACCENTS[c].raw}} />
            ))}
          </div>
        </Field>

        {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</p>}
        <button onClick={save} className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#3B82F6] py-3 font-bold text-[#04121a] transition active:scale-95">{isNew?"Add protocol":"Save changes"}</button>
        {!isNew && <button onClick={()=>onDelete(p.id)} className="mt-2 w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition active:scale-95">Delete protocol</button>}
      </div>
    </div>
  );
}

/* ---- insights ---- */
function InsightCard({ item }) {
  const a = ACCENTS[item.accent];
  return <Panel className="p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${a.soft} ${a.text}`}><Icon name={item.icon} size={16} /></span><span className="text-sm font-medium text-slate-300">{item.label}</span></div>
      {item.delta != null && <DeltaBadge delta={item.delta} />}
    </div>
    <div className="mt-3 flex items-end gap-1"><span className="text-3xl font-extrabold tabular-nums text-white">{item.value}</span>{item.unit && <span className="mb-1 text-sm font-medium text-slate-400">{item.unit}</span>}</div>
    {item.series ? <div className="mt-1"><Sparkline data={item.series} color={a.hex} /></div> : <div className="mt-1 h-[34px]" />}
    <p className="mt-1 text-xs text-slate-500">{item.caption}</p>
    {item.breakdown && (
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#0F172A] px-2 py-1 text-[11px] font-semibold text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />Deep {fmtDur(item.breakdown.deep)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#0F172A] px-2 py-1 text-[11px] font-semibold text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#00F2FE]" />REM {fmtDur(item.breakdown.rem)}</span>
      </div>
    )}
  </Panel>;
}

function BioSenseInsights({ items }) {
  return <section id="insights" className="px-5 pt-6">
    <SectionHeading title="Bio-Sense Insights" hint="Last 7 days" icon="line-chart" />
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(it=><InsightCard key={it.id} item={it} />)}</div>
  </section>;
}

function buildInsights(health, protocols) {
  const out = [];
  if (health && health.hrv && health.hrv.length) {
    const s = health.hrv.slice(-7).map((x) => Math.round(x.ms));
    const val = s[s.length-1], prev = s.length>1 ? s[0] : val;
    const delta = prev ? Math.round(((val-prev)/prev)*100) : null;
    out.push({ id:"hrv", label:"HRV", value:String(val), unit:"ms", delta, icon:"heart-pulse", accent:"cyan", series:s.length>1?s:null, caption:"From Apple Health" });
  } else out.push({ id:"hrv", label:"HRV", value:"—", unit:"", delta:null, icon:"heart-pulse", accent:"cyan", series:null, caption:"Import Apple Health to see HRV" });

  if (health && health.sleep && health.sleep.length) {
    const last = health.sleep.slice(-7);
    const s = last.map((x) => Math.round(x.hours*10)/10);
    const avg = Math.round((s.reduce((a,b)=>a+b,0)/s.length)*10)/10;
    const val = s[s.length-1], prev = s.length>1 ? s[0] : val;
    const delta = prev ? Math.round(((val-prev)/prev)*100) : null;
    const avgOf = (k) => { const v = last.map(x=>x[k]).filter(n=>n!=null); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
    const deep = avgOf("deep"), rem = avgOf("rem");
    const breakdown = (deep!=null || rem!=null) ? { deep, rem } : null;
    out.push({ id:"sleep", label:"Sleep", value:val.toFixed(1), unit:"hrs", delta, icon:"moon", accent:"teal", series:s.length>1?s:null, caption:`Avg ${avg}h · Apple Health`, breakdown });
  } else out.push({ id:"sleep", label:"Sleep", value:"—", unit:"", delta:null, icon:"moon", accent:"teal", series:null, caption:"Import Apple Health to see sleep" });

  if (protocols.length) {
    const done = protocols.reduce((a,p)=>a+p.done,0), tot = protocols.reduce((a,p)=>a+(p.total||0),0);
    const pct = tot ? Math.round((done/tot)*100) : 0;
    out.push({ id:"compliance", label:"Compliance", value:String(pct), unit:"%", delta:null, icon:"target", accent:"blue", series:null, caption:"This week's dose adherence" });
  } else out.push({ id:"compliance", label:"Compliance", value:"—", unit:"", delta:null, icon:"target", accent:"blue", series:null, caption:"Add protocols to track" });
  return out;
}

/* ---- calculator ---- */
function CalculatorCard() {
  const [vial,setVial]=useState(5),[water,setWater]=useState(2),[dose,setDose]=useState(250);
  const { units, conc, doses } = useMemo(()=>{
    const v=parseFloat(vial),w=parseFloat(water),d=parseFloat(dose);
    if(!v||!w||!d) return { units:"—", conc:"—", doses:"—" };
    const concMgMl=v/w, volMl=(d/1000)/concMgMl;
    return { units:(volMl*100).toFixed(1), conc:concMgMl.toFixed(2), doses:Math.floor(v/(d/1000)) };
  },[vial,water,dose]);
  const F = ({label,value,set,suffix,icon}) => (
    <label className="flex-1">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[#30363D] bg-[#0F172A] px-3 py-2 focus-within:border-[#00F2FE]/50">
        <Icon name={icon} size={14} className="text-slate-500" />
        <input type="number" value={value} onChange={e=>set(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-white outline-none" />
        <span className="text-xs text-slate-500">{suffix}</span>
      </div>
    </label>
  );
  return <section id="calculator" className="px-5 pt-6">
    <SectionHeading title="Reconstitution Calculator" hint="Quick math" icon="calculator" />
    <Panel accent="cyan" glow className="mt-3 overflow-hidden p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <F label="Vial size" value={vial} set={setVial} suffix="mg" icon="flask-conical" />
        <F label="BAC water" value={water} set={setWater} suffix="mL" icon="droplet" />
        <F label="Dose" value={dose} set={setDose} suffix="mcg" icon="syringe" />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#00F2FE]/25 bg-gradient-to-r from-[#00F2FE]/10 to-[#3B82F6]/5 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Draw to</p>
          <p className="text-3xl font-extrabold tabular-nums text-[#00F2FE]">{units}<span className="ml-1 text-base font-semibold text-slate-300">units</span></p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p><span className="text-slate-500">Conc:</span> <span className="font-semibold text-slate-200">{conc} mg/mL</span></p>
          <p className="mt-1"><span className="text-slate-500">Doses/vial:</span> <span className="font-semibold text-slate-200">{doses}</span></p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Insulin syringe scale: 100 units = 1 mL. Always double-check before drawing.</p>
    </Panel>
  </section>;
}

/* ---- Apple Health ---- */
function parseHealthFile(text) {
  text = (text || "").trim();
  let sleep = [], hrv = [];
  if (text[0] === "{" || text[0] === "[") {
    let j; try { j = JSON.parse(text); } catch (e) { return { error: "That file isn't valid JSON — try a CSV export instead." }; }
    const metrics = (j.data && j.data.metrics) || j.metrics || [];
    const find = (re) => metrics.find((m) => re.test(((m.name || m.identifier || "") + "").toLowerCase()));
    const sm = find(/sleep/);
    if (sm && Array.isArray(sm.data)) {
      sm.data.forEach((d) => {
        const date = ((d.date || d.startDate || d.dateComponents || "") + "").slice(0, 10);
        // Prefer the explicit total. Some exports set "asleep" to 0 while the real
        // nightly total lives in "totalSleep", so try that first, then sum stages.
        let hrs = num(d.totalSleep);
        if (hrs == null || hrs === 0) {
          const stages = ["deep","core","rem","asleep","light"].map((k)=>num(d[k])).filter((x)=>x!=null);
          if (stages.length) hrs = stages.reduce((a,b)=>a+b,0);
        }
        if (hrs == null || hrs === 0) hrs = num(d.value != null ? d.value : d.qty);
        hrs = hoursFrom(hrs);
        if (date && hrs != null && hrs > 0) {
          const rec = { date, hours: hrs };
          const dp = hoursFrom(num(d.deep)), rm = hoursFrom(num(d.rem)), cr = hoursFrom(num(d.core));
          if (dp != null) rec.deep = dp;
          if (rm != null) rec.rem = rm;
          if (cr != null) rec.core = cr;
          sleep.push(rec);
        }
      });
    }
    const hm = find(/heart_rate_variability|hrv|sdnn/);
    if (hm && Array.isArray(hm.data)) {
      hm.data.forEach((d) => {
        const date = ((d.date || d.startDate || "") + "").slice(0, 10);
        const v = num(d.qty != null ? d.qty : (d.value != null ? d.value : d.avg));
        if (date && v != null) hrv.push({ date, ms: v });
      });
    }
  } else {
    const lines = text.split(/\r?\n/).filter((l)=>l.trim());
    if (!lines.length) return { error: "That file looks empty." };
    const head = lines[0].split(",").map((h)=>h.trim().toLowerCase());
    const di = head.findIndex((h)=>/date|day|start/.test(h));
    const hi = head.findIndex((h)=>/asleep|sleep|hours|duration|total/.test(h));
    if (di < 0 || hi < 0) return { error: "Couldn't spot a date column and a sleep-hours column in that CSV." };
    for (let i=1;i<lines.length;i++){ const c=lines[i].split(","); const date=((c[di]||"")+"").slice(0,10); const h=hoursFrom(num(c[hi])); if(date&&h!=null) sleep.push({date,hours:h}); }
  }
  const byDate = (arr) => { const m={}; arr.forEach((x)=>(m[x.date]=x)); return Object.values(m).sort((a,b)=>a.date.localeCompare(b.date)); };
  sleep = byDate(sleep); hrv = byDate(hrv);
  if (!sleep.length && !hrv.length) return { error: "No sleep or HRV entries found in that file." };
  return { sleep, hrv, syncedAt: new Date().toISOString() };
}

/* ---- native one-touch Apple Health (via Natively HealthKit JS SDK) ---- */
// Present only when the app runs inside the Natively-wrapped native shell.
const nativeHealthAvailable = () => typeof window !== "undefined" && typeof window.NativelyHealth === "function";

function toDateStr(v){ return v ? String(v).slice(0,10) : ""; }

// NOTE: field names below follow Natively's documented calls; the exact response
// shape may need a 1-line tweak after the first real device sync.
function parseNativeSleep(raw){
  const arr = Array.isArray(raw) ? raw : (raw && (raw.data||raw.results||raw.samples||raw.value)) || [];
  const byDate = {};
  const get = (date) => (byDate[date] || (byDate[date] = { date, hours:0, deep:0, rem:0, _d:false, _r:false }));
  (Array.isArray(arr)?arr:[]).forEach((s)=>{
    const date = toDateStr(s.date || s.endDate || s.startDate || s.day);
    if(!date) return;
    const state = String(s.state || s.type || s.category || s.value_type || "asleep").toLowerCase();
    if(/awake|inbed|in_bed|in bed/.test(state)) return; // count time asleep only
    let hours = null;
    if(s.totalSleep!=null) hours = hoursFrom(num(s.totalSleep));
    else if(s.hours!=null) hours = num(s.hours);
    else if(s.minutes!=null) hours = num(s.minutes)/60;
    else if(s.duration!=null){ let d=num(s.duration); if(d!=null) hours = d>1000 ? d/3600 : (d>24 ? d/60 : d); }
    else hours = hoursFrom(num(s.asleep!=null?s.asleep:s.value));
    if(hours==null) return;
    const rec = get(date);
    rec.hours += hours;
    const dp = hoursFrom(num(s.deep)), rm = hoursFrom(num(s.rem));
    if(dp!=null){ rec.deep += dp; rec._d=true; }
    if(rm!=null){ rec.rem += rm; rec._r=true; }
    if(/deep/.test(state)){ rec.deep += hours; rec._d=true; }
    if(/rem/.test(state)){ rec.rem += hours; rec._r=true; }
  });
  return Object.values(byDate).map(x=>{ const o={date:x.date, hours:Math.round(x.hours*10)/10}; if(x._d) o.deep=x.deep; if(x._r) o.rem=x.rem; return o; }).sort((a,b)=>a.date.localeCompare(b.date));
}
function parseNativeHRV(raw){
  const arr = Array.isArray(raw) ? raw : (raw && (raw.data||raw.results||raw.values||raw.value)) || [];
  const byDate = {};
  (Array.isArray(arr)?arr:[]).forEach((h)=>{
    const date = toDateStr(h.date || h.startDate || h.endDate || h.day);
    const v = num(h.value!=null?h.value:(h.quantity!=null?h.quantity:(h.avg!=null?h.avg:h.average)));
    if(date && v!=null) byDate[date] = { date, ms:v };
  });
  return Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
}
function connectNativeHealth(onDone, onErr){
  let health; try { health = window.NativelyHealth(); } catch(e){ onErr("Couldn't start Apple Health."); return; }
  const end = new Date(); const start = new Date(); start.setDate(end.getDate()-14);
  const iso = (d)=>d.toISOString();
  const fetchData = () => {
    health.getSleepAnalysis(iso(start), iso(end), 1000, (sres)=>{
      health.getStatisticQuantity("HRV", "DAY", iso(start), iso(end), (hres)=>{
        onDone({ sleep: parseNativeSleep(sres), hrv: parseNativeHRV(hres), syncedAt: new Date().toISOString(), source:"native" });
      });
    });
  };
  const auth = () => health.requestAuthorization(["SLEEP_ANALYSIS","HRV","RHR"], [], (res)=>{
    if(res && (res.status===true || res.status==="true")) fetchData();
    else onErr("Apple Health permission wasn't granted.");
  });
  if(typeof health.available === "function") health.available((res)=>{ (res && res.status) ? auth() : onErr("Apple Health isn't available on this device."); });
  else auth();
}

function ConnectHealthCard({ health, onImport, onClear }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const native = nativeHealthAvailable();
  const connected = health && ((health.sleep && health.sleep.length) || (health.hrv && health.hrv.length));
  const handle = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const res = parseHealthFile(String(r.result)); if (res.error) setErr(res.error); else { setErr(""); onImport(res); } };
    r.readAsText(f); e.target.value = "";
  };
  const oneTouch = () => {
    setErr(""); setBusy(true);
    connectNativeHealth(
      (data)=>{ setBusy(false); if(!data.sleep.length && !data.hrv.length){ setErr("No sleep or HRV data came back from Apple Health yet."); } else onImport(data); },
      (msg)=>{ setBusy(false); setErr(msg); }
    );
  };
  const synced = connected && health.syncedAt ? new Date(health.syncedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  return (
    <section className="px-5 pt-6">
      <Panel accent="teal" glow={connected} className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14B8A6]/10 text-[#14B8A6] ring-1 ring-[#14B8A6]/30"><Icon name="activity" size={20} /></div>
            <div>
              <h3 className="font-bold text-white">Apple Health</h3>
              <p className="text-xs text-slate-400">{connected ? `Synced ${synced} · ${health.sleep ? health.sleep.length : 0} nights${health.hrv && health.hrv.length ? `, ${health.hrv.length} HRV` : ""}` : (native ? "Tap connect for one-touch sync" : "Not connected")}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${connected ? "bg-[#14B8A6]/15 text-[#14B8A6]" : "bg-slate-500/15 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#14B8A6] shadow-[0_0_8px_#14B8A6]" : "bg-slate-500"}`} />{connected ? "Synced" : "Not linked"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={handle} className="hidden" />
          {native ? (
            <button onClick={oneTouch} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14B8A6] to-[#3B82F6] px-3.5 py-2 text-sm font-bold text-[#04121a] transition hover:brightness-110 active:scale-95 ${busy?"opacity-70":""}`}>
              <Icon name={busy?"loader":"activity"} size={16} stroke={2.5} /> {busy ? "Connecting…" : (connected ? "Sync now" : "Connect Apple Health")}
            </button>
          ) : (
            <button onClick={() => fileRef.current.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14B8A6] to-[#3B82F6] px-3.5 py-2 text-sm font-bold text-[#04121a] transition hover:brightness-110 active:scale-95">
              <Icon name="upload" size={16} stroke={2.5} /> {connected ? "Update data" : "Import sleep file"}
            </button>
          )}
          {native && <button onClick={() => fileRef.current.click()} className="rounded-xl border border-[#30363D] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-white">Import file</button>}
          {connected && <button onClick={onClear} className="rounded-xl border border-[#30363D] px-3 py-2 text-sm font-semibold text-slate-400 transition hover:text-white">Clear</button>}
          <button onClick={() => setOpen((o) => !o)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-200">How it works <Icon name={open ? "chevron-up" : "chevron-down"} size={14} /></button>
        </div>
        {!native && <p className="mt-2 text-xs text-slate-500">One-touch Apple Health sync unlocks in the installed app. On the web, import a file instead.</p>}
        {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</p>}
        {open && (
          native ? (
            <ol className="mt-3 space-y-1.5 rounded-xl border border-[#30363D] bg-[#0F172A]/60 p-3 text-xs leading-relaxed text-slate-300">
              <li><b className="text-white">1.</b> Tap <b>Connect Apple Health</b> and choose <b>Allow</b> on Apple's permission screen.</li>
              <li><b className="text-white">2.</b> Your sleep and HRV pull in automatically and refresh whenever you tap <b>Sync now</b>.</li>
              <li className="pt-1 text-slate-500">Data is read on your device through Apple Health and never leaves it.</li>
            </ol>
          ) : (
            <ol className="mt-3 space-y-1.5 rounded-xl border border-[#30363D] bg-[#0F172A]/60 p-3 text-xs leading-relaxed text-slate-300">
              <li><b className="text-white">1.</b> Install <span className="font-semibold text-[#14B8A6]">Health Auto Export – JSON+CSV</span> from the App Store (or use Apple's <span className="font-semibold text-[#14B8A6]">Shortcuts</span> app).</li>
              <li><b className="text-white">2.</b> Choose <b>Sleep Analysis</b> (and HRV if you want) and export as a <b>JSON</b> or <b>CSV</b> file.</li>
              <li><b className="text-white">3.</b> Save it to Files or iCloud, then tap <b>Import file</b> above and pick it.</li>
              <li className="pt-1 text-slate-500">Your data is read right here on your device and never leaves it.</li>
            </ol>
          )
        )}
      </Panel>
    </section>
  );
}

/* ---- settings sheet ---- */
function SettingsTab({ onClearAll }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="px-5 pt-6">
      <SectionHeading title="Settings" icon="settings" />
      <div className="mt-3 space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-xl border border-[#30363D] bg-[#161B22]/80 px-4 py-3"><span className="text-slate-300">Version</span><span className="font-semibold text-slate-400">PeptiSense 1.0</span></div>
        <a href="./privacy.html" className="flex items-center justify-between rounded-xl border border-[#30363D] bg-[#161B22]/80 px-4 py-3 text-slate-300 transition hover:text-white"><span>Privacy policy</span><Icon name="chevron-right" size={16} /></a>
        <div className="rounded-xl border border-[#30363D] bg-[#161B22]/80 px-4 py-3">
          <p className="text-slate-300">All your data is stored only on this device.</p>
          {!confirm ? (
            <button onClick={()=>setConfirm(true)} className="mt-3 w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 transition active:scale-95">Clear all data</button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button onClick={()=>setConfirm(false)} className="flex-1 rounded-xl border border-[#30363D] py-2.5 text-sm font-semibold text-slate-300">Cancel</button>
              <button onClick={onClearAll} className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-bold text-white transition active:scale-95">Yes, erase</button>
            </div>
          )}
        </div>
        <p className="px-1 text-xs leading-relaxed text-slate-500">PeptiSense is an informational tool, not medical advice. Always confirm dosing and consult a qualified professional.</p>
      </div>
    </section>
  );
}

/* ---- bottom nav ---- */
const NAV = [
  { id:"home", label:"Home", icon:"home" },
  { id:"protocols", label:"Protocols", icon:"clipboard-list" },
  { id:"calculator", label:"Calculator", icon:"calculator" },
  { id:"insights", label:"Insights", icon:"line-chart" },
  { id:"settings", label:"Settings", icon:"settings" },
];
function BottomNav({ active, onNav }) {
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#30363D] bg-[#0F172A]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-2">
      {NAV.map(n=>{
        const on = active===n.id;
        return <button key={n.id} onClick={()=>onNav(n.id)} className={["relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition", on?"text-[#00F2FE]":"text-slate-500 hover:text-slate-300"].join(" ")}>
          {on && <span className="absolute -top-[9px] h-1 w-8 rounded-full bg-[#00F2FE] shadow-[0_0_10px_#00F2FE]" />}
          <Icon name={n.icon} size={21} stroke={on?2.4:2} />{n.label}
        </button>;
      })}
    </div>
  </nav>;
}

/* ---- video splash ---- */
const SPLASH_SRC = (typeof window !== "undefined" && window.__SPLASH__) || "";
function Splash({ onDone }) {
  const [hiding, setHiding] = useState(false);
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; setHiding(true); setTimeout(onDone, 450); };
  useEffect(() => { const t = setTimeout(finish, 12000); return () => clearTimeout(t); }, []);
  return (
    <div onClick={finish} className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A] transition-opacity duration-500 ${hiding ? "opacity-0" : "opacity-100"}`}>
      <video autoPlay muted playsInline preload="auto" onEnded={finish} onError={finish} className="h-full w-full object-cover" src={SPLASH_SRC} />
      <button onClick={(e)=>{ e.stopPropagation(); finish(); }} className="absolute right-4 rounded-full bg-black/40 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition active:scale-95" style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}>Skip ›</button>
    </div>
  );
}

/* ---- home / overview tab ---- */
/* ---- big metric card (used in the Home coverflow deck) ---- */
function MetricCard({ item, onOpen }) {
  const a = ACCENTS[item.accent] || ACCENTS.cyan;
  const big = String(item.value).length <= 5;
  return (
    <div onClick={onOpen}
      className="flex h-[300px] cursor-pointer flex-col rounded-3xl border p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition active:scale-[0.98]"
      style={{ borderColor: a.raw + "55", background: `linear-gradient(160deg, ${a.raw}26, #141b26 62%)` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: a.raw + "26", color: a.raw }}><Icon name={item.icon} size={20} /></span>
          <span className="text-base font-semibold text-white">{item.label}</span>
        </div>
        {item.delta != null && <DeltaBadge delta={item.delta} />}
      </div>
      <div className="mt-6 flex items-end gap-1.5">
        <span className={`font-extrabold tracking-tight text-white ${big ? "text-5xl" : "text-2xl leading-tight"}`}>{item.value}</span>
        {item.unit && <span className="mb-1.5 text-lg font-semibold text-slate-300">{item.unit}</span>}
      </div>
      {item.sub && <div className="mt-1.5 text-sm text-slate-400">{item.sub}</div>}
      <div className="mt-auto">
        {item.breakdown && (
          <div className="mb-3 flex gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#0F172A]/70 px-2 py-1 text-[11px] font-semibold text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />Deep {fmtDur(item.breakdown.deep)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#0F172A]/70 px-2 py-1 text-[11px] font-semibold text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#00F2FE]" />REM {fmtDur(item.breakdown.rem)}</span>
          </div>
        )}
        {item.series && <Sparkline data={item.series} color={a.hex} height={46} />}
        {item.bar != null && <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#0F172A]"><div className="h-full rounded-full" style={{ width: `${Math.max(item.bar, 2)}%`, background: `linear-gradient(90deg, ${ACCENTS.blue.raw}, ${ACCENTS.cyan.raw})` }} /></div>}
      </div>
    </div>
  );
}

function HomeTab({ protocols, insights, onNav }) {
  const sleep = insights.find(i=>i.id==="sleep") || {};
  const hrv = insights.find(i=>i.id==="hrv") || {};
  const comp = insights.find(i=>i.id==="compliance") || {};
  const nextP = protocols.find(p=>p.next && String(p.next).trim());
  const compPct = comp.value === "—" ? null : (parseInt(comp.value) || 0);
  const deck = [
    { ...sleep, tab:"insights", sub: sleep.value==="—" ? "Import Apple Health" : sleep.caption },
    { ...comp, tab:"insights", series:null, bar: compPct, sub: compPct==null ? "Add protocols to track" : "this week's dose adherence" },
    { ...hrv, tab:"insights", sub: hrv.value==="—" ? "Import Apple Health" : hrv.caption },
    { id:"next", tab:"protocols", accent:"cyan", icon:"clock", label:"Next dose", value: nextP ? nextP.next : "—", unit:"", delta:null, series:null, breakdown:null, bar:null, sub: nextP ? `${nextP.name} · ${nextP.dose}` : "nothing scheduled" },
  ];
  return (
    <div>
      <CalloutBanner />
      <div className="px-5 pt-6"><SectionHeading title="Today at a glance" /></div>
      <div className="mt-1">
        <Coverflow items={deck} keyOf={(d)=>d.id} renderCard={(d)=><MetricCard item={d} onOpen={()=>onNav(d.tab)} />} />
      </div>
      {protocols.length===0 && (
        <section className="px-5 pt-2">
          <Panel className="p-5 text-center">
            <p className="font-semibold text-white">Welcome to PeptiSense</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">Add a protocol and connect Apple Health to fill in your dashboard.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={()=>onNav("protocols")} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#3B82F6] px-4 py-2.5 text-sm font-bold text-[#04121a] transition active:scale-95"><Icon name="plus" size={16} stroke={2.6}/> Add protocol</button>
              <button onClick={()=>onNav("insights")} className="rounded-xl border border-[#30363D] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white">Connect Health</button>
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}

/* ---- root ---- */
function PeptiSenseDashboard() {
  const [protocols,setProtocols]=useState(()=>loadProtocols());
  const [active,setActive]=useState("home");
  const [health,setHealth]=useState(()=>loadHealth());
  const [sheet,setSheet]=useState(null); // 'new' | protocol obj | null
  const [splash,setSplash]=useState(()=>!!SPLASH_SRC);

  const persist = (arr) => { setProtocols(arr); saveProtocols(arr); };
  const logDose = (id) => persist(protocols.map(p=>(p.id===id && p.done<(p.total||0))?{...p,done:p.done+1}:p));
  const saveProtocol = (rec) => { const exists=protocols.some(p=>p.id===rec.id); persist(exists?protocols.map(p=>p.id===rec.id?rec:p):[...protocols,rec]); setSheet(null); };
  const deleteProtocol = (id) => { persist(protocols.filter(p=>p.id!==id)); setSheet(null); };
  const importHealth = (d) => { setHealth(d); saveHealth(d); };
  const clearHealth = () => { setHealth(null); try{ localStorage.removeItem(HKEY); }catch(e){} };
  const clearAll = () => { persist([]); clearHealth(); };

  const insights = buildInsights(health, protocols);
  const nav = (id) => { setActive(id); if (typeof window!=="undefined") window.scrollTo({ top:0, behavior:"smooth" }); };

  return <div className="min-h-screen bg-[#0F172A] text-white">
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-[#00F2FE]/10 blur-[120px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-[120px]" />
    </div>
    <div className="mx-auto max-w-3xl" style={{ paddingBottom: "calc(92px + env(safe-area-inset-bottom))" }}>
      <Header onProfile={()=>nav("settings")} />
      {active==="home" && <HomeTab protocols={protocols} insights={insights} onNav={nav} />}
      {active==="protocols" && <ActiveProtocols protocols={protocols} onLog={logDose} onEdit={(p)=>setSheet(p)} onAdd={()=>setSheet("new")} />}
      {active==="calculator" && <CalculatorCard />}
      {active==="insights" && <><ConnectHealthCard health={health} onImport={importHealth} onClear={clearHealth} /><BioSenseInsights items={insights} /></>}
      {active==="settings" && <SettingsTab onClearAll={clearAll} />}
    </div>
    <BottomNav active={active} onNav={nav} />
    {sheet && <ProtocolSheet editing={sheet} onClose={()=>setSheet(null)} onSave={saveProtocol} onDelete={deleteProtocol} />}
    {splash && <Splash onDone={()=>setSplash(false)} />}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<PeptiSenseDashboard />);
