import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Lenis from "lenis";
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
      <a className="mc-btn mc-btn--accent" href={CONFIG.DOWNLOAD_URL} download="MonComptable-Setup-v3.2.0.exe">Télécharger</a>
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
        <a className="mc-btn mc-btn--accent mc-btn--lg" href={CONFIG.DOWNLOAD_URL} download="MonComptable-Setup-v3.2.0.exe">Télécharger pour Windows</a>
        <button type="button" className="mc-link" onClick={onEnter}>Entrer dans l'application</button>
      </div>
    </>
  );
}

function Page() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const m = detectMode();
    setMode(m);
    const onResize = () => {
      const next = detectMode();
      setMode((cur) => (cur !== next ? next : cur));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!mode) return <div className="mc-page" />;
  return mode === "three" ? <ThreeTour /> : <StackTour staticMode={mode === "static"} />;
}

function ThreeTour() {
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const installWrapRef = useRef<HTMLDivElement>(null);
  const installBarRef = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const [host] = useState(() => {
    const d = document.createElement("div");
    d.className = "mc-window-host";
    return d;
  });
  const [chapter, setChapter] = useState(-1);
  const [installDone, setInstallDone] = useState(false);
  const [installVisible, setInstallVisible] = useState(false);
  const chapRef = useRef(-1);
  const doneRef = useRef(false);
  const instVisRef = useRef(false);

  // Lenis smooth scrolling for desktop
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.2,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current!;
    let target = scrollP();
    const onScroll = () => {
      target = scrollP();
    };
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
      if (c !== chapRef.current) {
        chapRef.current = c;
        setChapter(c);
      }

      const o = smoothstep(0.91, 0.95, p);
      const prog = smoothstep(0.93, 0.975, p);
      const done = p > 0.978;
      const isVis = o >= 0.05;

      const wrap = installWrapRef.current;
      if (wrap) {
        wrap.style.opacity = String(o);
        wrap.style.transform = `translate(-50%, -50%) scale(${0.85 + 0.15 * o})`;
        wrap.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      if (installBarRef.current) {
        installBarRef.current.style.transform = `scaleX(${prog})`;
      }
      if (isVis !== instVisRef.current) {
        instVisRef.current = isVis;
        setInstallVisible(isVis);
      }
      if (done !== doneRef.current) {
        doneRef.current = done;
        setInstallDone(done);
      }
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      dispose();
    };
  }, [host]);

  const go = (i: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const targetY = chapterTarget(i) * max;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetY, { duration: 1.4 });
    } else {
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }
  };

  const screen = Math.max(0, chapter);
  const cap = chapter >= 0 && !installVisible ? CHAPTERS[chapter] : null;

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
          <div
            ref={installWrapRef}
            className="mc-install-wrap"
            style={{ opacity: 0, transform: "translate(-50%, -50%) scale(0.85)", visibility: "hidden" }}
          >
            <InstallCard barRef={installBarRef} done={installDone} />
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
    const io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting), { threshold: 0.25 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function MobileNav({
  activeChapter,
  onSelect,
}: {
  activeChapter: number;
  onSelect: (index: number | "install") => void;
}) {
  return (
    <nav className="mc-mobile-nav" aria-label="Navigation des étapes du logiciel">
      <div className="mc-mobile-nav-track">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.label}
            type="button"
            className={`mc-mobile-pill ${activeChapter === i ? "is-active" : ""}`}
            onClick={() => onSelect(i)}
          >
            <span className="mc-mobile-pill-num">0{i + 1}</span>
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={`mc-mobile-pill ${activeChapter === 4 ? "is-active" : ""}`}
          onClick={() => onSelect("install")}
        >
          Télécharger
        </button>
      </div>
    </nav>
  );
}

function StackSection({
  i,
  staticMode,
  onNext,
}: {
  i: number;
  staticMode: boolean;
  onNext: (target: number | "install") => void;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  const c = CHAPTERS[i]!;
  const nextTarget = i + 1 < CHAPTERS.length ? i + 1 : "install";
  const nextLabel = i + 1 < CHAPTERS.length ? `Étape suivante : ${CHAPTERS[i + 1]!.label} ↓` : "Installer l'application ↓";

  return (
    <section ref={ref} id={`chapter-${i}`} className="mc-stack-sec">
      <div className="mc-caption mc-caption--static">
        <div className="mc-step-badge">
          <span className="mc-step-num">0{i + 1} / 04</span>
          <span>{c.label}</span>
        </div>
        <h3>{c.title}</h3>
        <p>{c.text}</p>
      </div>
      <div className="mc-device">
        <AppWindow fluid only={i} screen={seen ? i : -1} staticMode={staticMode} />
      </div>
      <div className="mc-next-step-wrap">
        <button type="button" className="mc-next-btn" onClick={() => onNext(nextTarget)}>
          {nextLabel}
        </button>
      </div>
    </section>
  );
}

function StackTour({ staticMode }: { staticMode: boolean }) {
  const [ref, seen] = useInView<HTMLElement>();
  const [prog, setProg] = useState(staticMode ? 1 : 0);
  const barRef = useRef<HTMLSpanElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);

  // Smooth scroll progress on mobile
  useEffect(() => {
    const onScroll = () => {
      const p = scrollP();
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;

      // Calculate which chapter is in viewport
      const installEl = document.getElementById("install-section");
      if (installEl && installEl.getBoundingClientRect().top < window.innerHeight * 0.6) {
        setActiveChapter(4);
        return;
      }
      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        const el = document.getElementById(`chapter-${i}`);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.5) {
          setActiveChapter(i);
          return;
        }
      }
      setActiveChapter(0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const scrollToTarget = (target: number | "install") => {
    const el = target === "install"
      ? document.getElementById("install-section")
      : document.getElementById(`chapter-${target}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 116;
      window.scrollTo({ top, behavior: staticMode ? "auto" : "smooth" });
    }
  };

  return (
    <div className="mc-page mc-stack">
      <TopBar barRef={barRef} />
      <MobileNav activeChapter={activeChapter} onSelect={scrollToTarget} />
      <section className="mc-stack-hero">
        <Hero onEnter={() => scrollToTarget(0)} />
      </section>
      <div id="tour">
        {CHAPTERS.map((_, i) => (
          <StackSection key={i} i={i} staticMode={staticMode} onNext={scrollToTarget} />
        ))}
      </div>
      <section ref={ref} id="install-section" className="mc-stack-sec mc-stack-install">
        <div className="mc-step-badge" style={{ marginBottom: "20px" }}>
          <span className="mc-step-num">05</span>
          <span>Téléchargement & Installation</span>
        </div>
        <InstallCard progress={prog} done={prog >= 1} />
      </section>
    </div>
  );
}
