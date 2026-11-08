import { useEffect, useState } from "react";
import { BookOpen, Check, FileText, LayoutDashboard, Send, Sparkles, Users } from "lucide-react";
import { CONFIG, RELEASE_DATE_FR, fcfa } from "@/lib/tour";

/** Milliseconds since `active` became true (capped at max). Static mode jumps to the end. */
function useTicker(active: boolean, staticMode: boolean, max: number) {
  const [t, setT] = useState(staticMode ? max : 0);
  useEffect(() => {
    if (staticMode) return setT(max);
    if (!active) return setT(0);
    let raf = 0;
    let last = -100;
    const s = performance.now();
    const loop = (n: number) => {
      const e = n - s;
      if (e - last > 30 || e >= max) {
        last = e;
        setT(Math.min(e, max));
      }
      if (e < max) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, staticMode, max]);
  return t;
}
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg className="mc-logo" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Logo Mon Comptable">
      <circle cx="20" cy="20" r="19" className="mc-logo-bg" />
      <path d="M10 27V13l6 8 6-8v14" className="mc-logo-stroke" />
      <path d="M31 15.5a6 6 0 1 0 0 9" className="mc-logo-stroke mc-logo-accent" />
    </svg>
  );
}

export const NAV = [
  { label: "Tableau de bord", Icon: LayoutDashboard },
  { label: "Écritures", Icon: BookOpen },
  { label: "Paie", Icon: Users },
  { label: "Assistant", Icon: Sparkles },
];

type ScreenProps = { active: boolean; staticMode: boolean };

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mc-head">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

/* ---------- Tableau de bord ---------- */
const KPIS = [
  { label: "Trésorerie", value: 4374000, tone: "accent" },
  { label: "Recettes du mois", value: 4000000, tone: "success" },
  { label: "Dépenses du mois", value: 876000, tone: "danger" },
  { label: "Créances clients", value: 2150000, tone: "warning" },
];
const REC = [2.1, 2.6, 2.3, 3.1, 2.9, 3.4, 3.0, 3.6, 3.3, 3.9, 3.7, 4.0];
const DEP = [1.6, 1.4, 1.9, 1.7, 2.2, 1.8, 2.4, 2.0, 1.7, 1.5, 1.1, 0.9];
const MONTHS = ["Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov"];
const path = (d: number[]) =>
  d.map((v, i) => `${i ? "L" : "M"}${20 + i * 50} ${200 - v * 42}`).join(" ");
const INVOICES = [
  { n: "F-0142", c: "Sow Distribution", a: 1180000, s: "Payée" },
  { n: "F-0141", c: "Boutique Ndiaye", a: 354000, s: "En attente" },
  { n: "F-0140", c: "Groupe Faye", a: 2150000, s: "En retard" },
  { n: "F-0139", c: "Kane Services", a: 472000, s: "Payée" },
  { n: "F-0138", c: "Diallo Import", a: 826000, s: "Payée" },
];
const chip = (s: string) => (s === "Payée" ? "success" : s === "En retard" ? "danger" : "warning");

function Dashboard({ active, staticMode }: ScreenProps) {
  const t = useTicker(active, staticMode, 1700);
  const k = ease(t / 1200);
  const draw = 1 - ease(t / 1600);
  return (
    <section className="mc-screen">
      <Head title="Tableau de bord" sub="Vue synthétique de Ets Diop & Fils · TVA 18 %" />
      <div className="mc-kpis">
        {KPIS.map((x) => (
          <div key={x.label} className="mc-card mc-kpi" data-tone={x.tone}>
            <span className="mc-kpi-dot" />
            <small>{x.label}</small>
            <strong>{fcfa(x.value * k)} FCFA</strong>
          </div>
        ))}
      </div>
      <div className="mc-dash-grid">
        <div className="mc-card">
          <div className="mc-card-title">
            Recettes et dépenses, 12 mois
            <span className="mc-legend"><i data-tone="accent" />Recettes <i data-tone="danger" />Dépenses</span>
          </div>
          <svg viewBox="0 0 600 230" className="mc-chart" aria-label="Courbe des recettes et dépenses">
            {[50, 100, 150, 200].map((y) => <line key={y} x1="10" x2="590" y1={y} y2={y} className="mc-grid" />)}
            <path d={path(REC)} pathLength={1} className="mc-line" data-tone="accent" style={{ strokeDashoffset: draw }} />
            <path d={path(DEP)} pathLength={1} className="mc-line" data-tone="danger" style={{ strokeDashoffset: draw }} />
            {MONTHS.map((m, i) => <text key={m} x={20 + i * 50} y="224" className="mc-axis">{m}</text>)}
          </svg>
        </div>
        <div className="mc-card">
          <div className="mc-card-title">Dernières factures</div>
          <ul className="mc-inv">
            {INVOICES.map((f) => (
              <li key={f.n}>
                <div><b>{f.c}</b><small>{f.n}</small></div>
                <span className="mc-amount">{fcfa(f.a)}</span>
                <span className="mc-chip" data-tone={chip(f.s)}>{f.s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Écritures ---------- */
const ROWS = [
  { d: "03/11/2026", j: "VE", l: "Facture F-0142 Sow Distribution", de: 1180000, cr: 0 },
  { d: "03/11/2026", j: "VE", l: "Ventes de marchandises", de: 0, cr: 1000000 },
  { d: "03/11/2026", j: "VE", l: "TVA collectée 18 %", de: 0, cr: 180000 },
  { d: "03/11/2026", j: "AC", l: "Achat fournitures de bureau", de: 15000, cr: 0 },
  { d: "03/11/2026", j: "BQ", l: "Règlement fournisseur par Wave", de: 0, cr: 15000 },
];
const CH = 32;
const PAUSE = 300;
const STARTS = ROWS.reduce<number[]>((a, r, i) => [...a, i ? a[i - 1]! + ROWS[i - 1]!.l.length * CH + PAUSE : 300], []);
const ROWS_END = STARTS[ROWS.length - 1]! + ROWS[ROWS.length - 1]!.l.length * CH + 200;

function Journal({ active, staticMode }: ScreenProps) {
  const t = useTicker(active, staticMode, ROWS_END);
  let de = 0;
  let cr = 0;
  const shown = ROWS.map((r, i) => {
    const chars = Math.floor((t - STARTS[i]!) / CH);
    const done = chars >= r.l.length;
    if (done) { de += r.de; cr += r.cr; }
    return { ...r, vis: t >= STARTS[i]!, txt: r.l.slice(0, Math.max(0, chars)), done };
  });
  const ok = de === cr && de > 0;
  return (
    <section className="mc-screen">
      <Head title="Écritures" sub="Journal des opérations · novembre 2026" />
      <div className="mc-card mc-table-card">
        <table className="mc-table">
          <thead><tr><th>Date</th><th>Journal</th><th>Libellé</th><th className="r">Débit</th><th className="r">Crédit</th></tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className={r.vis ? "is-in" : "is-out"}>
                <td>{r.d}</td>
                <td><span className="mc-chip" data-tone="accent">{r.j}</span></td>
                <td>{r.txt}{r.vis && !r.done && <span className="mc-caret" />}</td>
                <td className="r">{r.done && r.de ? fcfa(r.de) : ""}</td>
                <td className="r">{r.done && r.cr ? fcfa(r.cr) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>Totaux</td><td className="r">{fcfa(de)}</td><td className="r">{fcfa(cr)}</td></tr></tfoot>
        </table>
        <div className="mc-balance" data-ok={ok}>
          {ok ? <><Check size={18} /> Équilibré</> : <>Écart : {fcfa(Math.abs(de - cr))} FCFA</>}
        </div>
      </div>
    </section>
  );
}

/* ---------- Paie ---------- */
const STAFF = [
  { n: "Awa Ndiaye", r: "Comptable" },
  { n: "Moussa Fall", r: "Commercial" },
  { n: "Fatou Ba", r: "Magasinière" },
  { n: "Ibrahima Sarr", r: "Chauffeur" },
];
const SLIP = [
  { l: "Salaire de base", v: 350000 },
  { l: "Prime de transport", v: 25000 },
  { l: "Salaire brut", v: 375000, b: true },
  { l: "Retraite IPRES", v: -21000 },
  { l: "Impôt sur le revenu", v: -18500 },
  { l: "Net à payer", v: 335500, b: true },
];
function Payroll({ active, staticMode }: ScreenProps) {
  const t = useTicker(active, staticMode, 3200);
  const lines = Math.floor((t - 300) / 280) + 1;
  const pressed = t > 2300 && t < 2560;
  const pdf = t > 2600;
  return (
    <section className="mc-screen">
      <Head title="Paie" sub="Bulletins de salaire · novembre 2026" />
      <div className="mc-pay">
        <div className="mc-card mc-staff">
          {STAFF.map((s, i) => (
            <div key={s.n} className={`mc-staff-row ${i === 0 ? "is-sel" : ""}`}>
              <span className="mc-avatar">{s.n[0]}</span>
              <div><b>{s.n}</b><small>{s.r}</small></div>
            </div>
          ))}
        </div>
        <div className="mc-card mc-slip">
          <div className="mc-slip-head">
            <div><b>Bulletin de paie</b><small>Awa Ndiaye · Comptable · novembre 2026</small></div>
            <Logo size={28} />
          </div>
          <ul>
            {SLIP.map((s, i) => (
              <li key={s.l} className={`${i < lines ? "is-in" : "is-out"} ${s.b ? "is-b" : ""}`}>
                <span>{s.l}</span><span>{fcfa(s.v)} FCFA</span>
              </li>
            ))}
          </ul>
          <div className="mc-slip-foot">
            <button type="button" tabIndex={-1} className={`mc-btn mc-btn--accent ${pressed ? "is-pressed" : ""}`}>
              <FileText size={16} /> Exporter en PDF
            </button>
            <span className={`mc-file ${pdf ? "is-in" : "is-out"}`}>
              <FileText size={16} /> Bulletin_Awa_Ndiaye_Nov2026.pdf
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Assistant ---------- */
const Q = "Quel est mon solde de trésorerie ce mois-ci ?";
const A = "Votre solde de trésorerie au 3 novembre est de 4 374 000 FCFA. Il progresse de 12 % depuis octobre grâce aux règlements clients reçus.";
const QS = 200, QC = 38, AW = 700, AC = 16;
const QEND = QS + Q.length * QC;
const AEND = QEND + AW + A.length * AC;
function Assistant({ active, staticMode }: ScreenProps) {
  const t = useTicker(active, staticMode, AEND + 100);
  const q = Q.slice(0, Math.max(0, Math.floor((t - QS) / QC)));
  const sent = t >= QEND + 200;
  const a = A.slice(0, Math.max(0, Math.floor((t - QEND - AW) / AC)));
  return (
    <section className="mc-screen">
      <Head title="Assistant" sub="Questions sur vos comptes, réponses tirées de vos écritures" />
      <div className="mc-card mc-chat">
        <div className="mc-chat-log">
          {sent && <div className="mc-msg mc-msg--me">{Q}</div>}
          {sent && (
            <div className="mc-msg mc-msg--bot">
              <span className="mc-bot-name"><Sparkles size={14} /> Assistant</span>
              {a ? (
                <>
                  {a.length > 52 && <strong className="mc-figure">4 374 000 FCFA</strong>}
                  <p>{a}{a.length < A.length && <span className="mc-caret" />}</p>
                </>
              ) : (
                <span className="mc-typing"><i /><i /><i /></span>
              )}
            </div>
          )}
        </div>
        <div className="mc-chat-input">
          <span>{sent ? "" : q}{!sent && <span className="mc-caret" />}{sent && <em>Posez une question sur vos comptes</em>}</span>
          <span className="mc-send"><Send size={16} /></span>
        </div>
      </div>
    </section>
  );
}

export const SCREENS = [Dashboard, Journal, Payroll, Assistant];

export function AppWindow({
  screen, onNavigate, staticMode = false, fluid = false, only,
}: { screen: number; onNavigate?: (i: number) => void; staticMode?: boolean; fluid?: boolean; only?: number; active?: boolean }) {
  return (
    <div className={`mc-win ${fluid ? "mc-win--fluid" : ""}`}>
      <div className="mc-titlebar">
        <span className="mc-dots"><i /><i /><i /></span>
        <Logo size={18} />
        <span>Mon Comptable</span>
      </div>
      <div className="mc-body">
        <aside className="mc-side">
          <div className="mc-brand"><Logo size={36} /><div><b>Mon Comptable</b><small>Ets Diop & Fils</small></div></div>
          <div className="mc-country"><b>Sénégal</b><small>FCFA · TVA 18 %</small></div>
          <nav>
            {NAV.map(({ label, Icon }, i) => (
              <button key={label} type="button" className={`mc-nav ${i === (only ?? screen) ? "is-active" : ""}`} onClick={() => onNavigate?.(i)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="mc-content">
          {only === undefined ? (
            <div className="mc-track" style={{ transform: `translateX(${-screen * 100}%)` }}>
              {SCREENS.map((S, i) => <div className="mc-slot" key={i}><S active={screen === i} staticMode={staticMode} /></div>)}
            </div>
          ) : (
            (() => { const S = SCREENS[only]!; return <S active={screen === only} staticMode={staticMode} />; })()
          )}
        </main>
      </div>
      <div className="mc-glow" aria-hidden="true" />
    </div>
  );
}

export function InstallCard({ progress, done, barRef }: { progress?: number; done: boolean; barRef?: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="mc-install" data-done={done}>
      <div className="mc-titlebar"><span className="mc-dots"><i /><i /><i /></span><span>Installation de Mon Comptable</span></div>
      <div className="mc-install-body">
        <Logo size={56} />
        {!done ? (
          <>
            <b>Installation de Mon Comptable</b>
            <small>Copie des fichiers sur votre ordinateur</small>
            <div className="mc-bar"><span ref={barRef} style={{ transform: `scaleX(${progress ?? 0})` }} /></div>
          </>
        ) : (
          <>
            <b>Mon Comptable pour Windows</b>
            <small>Version {CONFIG.VERSION} · {RELEASE_DATE_FR} · {CONFIG.FILE_SIZE} · fonctionne sans internet</small>
            <a className="mc-btn mc-btn--accent mc-btn--lg" href={CONFIG.DOWNLOAD_URL} rel="noopener">Télécharger pour Windows</a>
            <p className="mc-help">
              Windows affiche un avertissement ? Cliquez sur « Informations complémentaires », puis « Exécuter quand même ».
            </p>
            <div className="mc-contact">
              <a href={`https://wa.me/${CONFIG.WHATSAPP.replace(/\D/g, "")}`}>WhatsApp {CONFIG.WHATSAPP}</a>
              <a href={`mailto:${CONFIG.EMAIL}`}>{CONFIG.EMAIL}</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
