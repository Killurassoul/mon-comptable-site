import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppWindow, InstallCard, Logo } from "@/components/mc/Screens";
import { createScene } from "@/components/mc/scene";
import { CHAPTERS, CONFIG, chapterAt, chapterTarget, smoothstep } from "@/lib/tour";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mon Comptable · Logiciel de comptabilité hors ligne" },
      { name: "description", content: "La comptabilité de votre entreprise, sans internet. Tableau de bord, écritures, paie et assistant pour PME, cabinets et ONG." },
      { property: "og:title", content: "Mon Comptable · Logiciel de comptabilité hors ligne" },
      { property: "og:description", content: "La comptabilité de votre entreprise, sans internet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Mode = "three" | "stack" | "static";

function detectMode(): Mode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  const c = document.createElement("canvas");
  const webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  if (!webgl) return "static";
  if (window.innerWidth < 820 || window.innerHeight > window.innerWidth) return "stack";
  return "three";
}

function scrollP() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function TopBar({ barRef }: { barRef?: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <header className="mc-top">
      <span className="mc-wordmark"><Logo size={28} /> Mon Comptable</span>
      <a className="mc-btn mc-btn--accent" href={CONFIG.DOWNLOAD_URL}>Télécharger</a>
      {barRef && <span ref={barRef} className="mc-top-progress" />}
    </header>
  );
}

function Hero({ onEnter }: { onEnter: () => void }) {
  return (
    <>
      <p className="mc-eyebrow">Logiciel de comptabilité hors ligne</p>
      <h1 className="mc-title">Mon Comptable</h1>
      <p className="mc-lead">La comptabilité de votre entreprise, sans internet.</p>
      <div className="mc-actions">
        <a className="mc-btn mc-btn--accent mc-btn--lg" href={CONFIG.DOWNLOAD_URL}>Télécharger pour Windows</a>
        <button type="button" className="mc-link" onClick={onEnter}>Entrer dans l'application</button>
      </div>
    </>
  );
}

function Page() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => setMode(detectMode()), []);
  if (!mode) return <div className="mc-page" />;
  return mode === "three" ? <ThreeTour /> : <StackTour staticMode={mode === "static"} />;
}

function ThreeTour() {
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [host] = useState(() => {
    const d = document.createElement("div");
    d.className = "mc-window-host";
    return d;
  });
  const [chapter, setChapter] = useState(-1);
  const [install, setInstall] = useState({ o: 0, prog: 0, done: false });
  const chapRef = useRef(-1);
  const instRef = useRef("");

  useEffect(() => {
    const stage = stageRef.current!;
    let target = scrollP();
    const onScroll = () => (target = scrollP());
    window.addEventListener("scroll", onScroll, { passive: true });
    const dispose = createScene(stage, host, () => target, (p) => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      const h = heroRef.current;
      if (h) {
        const o = 1 - smoothstep(0.1, 0.18, p);
        h.style.opacity = String(o);
        h.style.transform = `translateY(calc(-50% - ${(1 - o) * 40}px))`;
        h.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      const c = chapterAt(p);
      if (c !== chapRef.current) { chapRef.current = c; setChapter(c); }
      const o = smoothstep(0.91, 0.95, p);
      const prog = smoothstep(0.93, 0.975, p);
      const done = p > 0.978;
      const k = `${o.toFixed(2)}|${prog.toFixed(2)}|${done}`;
      if (k !== instRef.current) { instRef.current = k; setInstall({ o, prog, done }); }
    });
    return () => { window.removeEventListener("scroll", onScroll); dispose(); };
  }, [host]);

  const go = (i: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: chapterTarget(i) * max, behavior: "smooth" });
  };
  const screen = Math.max(0, chapter);
  const cap = chapter >= 0 && install.o < 0.05 ? CHAPTERS[chapter] : null;

  return (
    <div className="mc-page">
      <TopBar barRef={barRef} />
      <div className="mc-scroll">
        <div ref={stageRef} className="mc-stage">
          <div ref={heroRef} className="mc-hero">
            <Hero onEnter={() => go(0)} />
          </div>
          {CHAPTERS.map((c) => (
            <aside key={c.label} className="mc-caption" data-on={cap === c} aria-hidden={cap !== c}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </aside>
          ))}
          <div className="mc-install-wrap" style={{ opacity: install.o, transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * install.o})`, visibility: install.o < 0.01 ? "hidden" : "visible" }}>
            <InstallCard progress={install.prog} done={install.done} />
          </div>
        </div>
      </div>
      {createPortal(<AppWindow screen={screen} onNavigate={go} />, host)}
    </div>
  );
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting), { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function StackSection({ i, staticMode }: { i: number; staticMode: boolean }) {
  const [ref, seen] = useInView<HTMLElement>();
  const c = CHAPTERS[i]!;
  return (
    <section ref={ref} className="mc-stack-sec">
      <div className="mc-caption mc-caption--static"><h3>{c.title}</h3><p>{c.text}</p></div>
      <div className="mc-device"><AppWindow fluid only={i} screen={seen ? i : -1} staticMode={staticMode} /></div>
    </section>
  );
}

function StackTour({ staticMode }: { staticMode: boolean }) {
  const [ref, seen] = useInView<HTMLElement>();
  const [prog, setProg] = useState(staticMode ? 1 : 0);
  useEffect(() => {
    if (staticMode || !seen) return;
    let raf = 0;
    const s = performance.now();
    const loop = (n: number) => {
      const v = Math.min(1, (n - s) / 1800);
      setProg(v);
      if (v < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [seen, staticMode]);
  return (
    <div className="mc-page mc-stack">
      <TopBar />
      <section className="mc-stack-hero"><Hero onEnter={() => document.getElementById("tour")?.scrollIntoView({ behavior: staticMode ? "auto" : "smooth" })} /></section>
      <div id="tour">{CHAPTERS.map((_, i) => <StackSection key={i} i={i} staticMode={staticMode} />)}</div>
      <section ref={ref} className="mc-stack-sec mc-stack-install"><InstallCard progress={prog} done={prog >= 1} /></section>
    </div>
  );
}

