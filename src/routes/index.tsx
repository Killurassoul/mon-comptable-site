import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { DOWNLOAD, SCREENS, screenUrl, reducedMotion, type ViewHandle } from "@/experience/data";
import "@/experience/experience.css";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mon Comptable · Logiciel de comptabilité hors ligne" },
      {
        name: "description",
        content:
          "Comptabilité, facturation, paie et trésorerie hors ligne pour les PME, cabinets et ONG d'Afrique de l'Ouest. Windows 10 et 11.",
      },
      { property: "og:title", content: "Mon Comptable · Logiciel de comptabilité hors ligne" },
      {
        property: "og:description",
        content: "La comptabilité de votre entreprise, sans internet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type View = "galerie" | "ecrans" | "telecharger";
const VIEWS: { id: View; label: string; n: number }[] = [
  { id: "galerie", label: "Galerie", n: 1 },
  { id: "ecrans", label: "Écrans", n: 2 },
  { id: "telecharger", label: "Installer", n: 3 },
];
const fromHash = (): View => {
  const h = window.location.hash.replace("#", "");
  return VIEWS.some((v) => v.id === h) ? (h as View) : "galerie";
};
const hasWebGL = () => {
  const c = document.createElement("canvas");
  return !!(c.getContext("webgl2") || c.getContext("webgl"));
};

function Page() {
  const [webgl] = useState(hasWebGL);
  return webgl ? <Experience /> : <Fallback />;
}

function Experience() {
  const [view, setView] = useState<View>(fromHash);
  const [menu, setMenu] = useState(false);
  const roots = useRef<Partial<Record<View, HTMLElement | null>>>({});
  const handles = useRef<Partial<Record<View, ViewHandle>>>({});
  const current = useRef<View | null>(null);
  const dock = useRef<HTMLElement>(null);
  const dockShown = useRef(false);

  const showDock = () => {
    if (dockShown.current || !dock.current) return;
    dockShown.current = true;
    gsap.fromTo(
      dock.current,
      { y: 16, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        ease: "expo.out",
        onStart: () => {
          dock.current!.style.pointerEvents = "auto";
        },
      },
    );
  };

  useEffect(() => {
    const onHash = () => setView(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const reduced = reducedMotion();
    const build = async (v: View): Promise<ViewHandle> => {
      if (handles.current[v]) return handles.current[v]!;
      await document.fonts.ready;
      const root = roots.current[v]!;
      let h: ViewHandle;
      if (v === "galerie")
        h = (await import("@/experience/gallery")).createGallery(root, {
          reduced,
          onIntroDone: showDock,
        });
      else if (v === "ecrans")
        h = (await import("@/experience/grid")).createGrid(root, { reduced });
      else h = (await import("@/experience/studio")).createStudio(root, { reduced });
      handles.current[v] = h;
      return h;
    };
    (async () => {
      const prev = current.current;
      if (prev === view) return;
      // Marqué tout de suite : le double appel de l'effet en développement ne relance rien.
      current.current = view;
      if (prev) {
        const el = roots.current[prev]!;
        await gsap.to(el, { opacity: 0, duration: 0.35, ease: "power2.in" });
        handles.current[prev]?.stop();
        el.style.visibility = "hidden";
      }
      if (current.current !== view) return;
      const el = roots.current[view]!;
      el.style.visibility = "visible";
      const h = await build(view);
      if (current.current !== view) return;
      h.start();
      gsap.to(el, { opacity: 1, duration: 0.5, ease: "power2.out" });
      if (view !== "galerie") showDock();
    })();
  }, [view]);

  const go = (v: View) => {
    setMenu(false);
    window.location.hash = v;
  };

  return (
    <main className="xp">
      {VIEWS.map((v) => (
        <section
          key={v.id}
          className="xp-view"
          ref={(el) => {
            roots.current[v.id] = el;
          }}
          aria-label={v.label}
        />
      ))}
      <nav className="dock" ref={dock} aria-label="Navigation">
        <button type="button" className="dock-mark" onClick={() => go("galerie")}>
          Mon Comptable
        </button>
        <span className="dock-div" />
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`dock-tab${view === v.id ? " is-active" : ""}`}
            onClick={() => go(v.id)}
            aria-current={view === v.id ? "page" : undefined}
          >
            <span className="dock-label">{v.label}</span>
            <span className="dock-num">{v.n}</span>
          </button>
        ))}
        <span className="dock-div" />
        <button
          type="button"
          className={`dock-dot${menu ? " is-open" : ""}`}
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-label="Menu"
        >
          <i />
        </button>
        <a className="dock-cta" href={DOWNLOAD.url}>
          Télécharger
        </a>
      </nav>
      <div className={`dock-menu${menu ? " is-open" : ""}`} aria-hidden={!menu}>
        <p>Version {DOWNLOAD.version} pour Windows 10 et 11, sans internet.</p>
        {[...VIEWS].reverse().map((v) => (
          <button key={v.id} type="button" onClick={() => go(v.id)} tabIndex={menu ? 0 : -1}>
            {v.label} <span>0{v.n}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

/** Sans WebGL : la même information, en simple page. */
function Fallback() {
  return (
    <main className="fb">
      <h1>Mon Comptable</h1>
      <p>La comptabilité de votre entreprise, claire, précise et rapide, même sans internet.</p>
      <a className="fb-cta" href={DOWNLOAD.url}>
        Télécharger pour Windows
      </a>
      <p className="fb-meta">
        Version {DOWNLOAD.version} · {DOWNLOAD.size} · SHA-256 {DOWNLOAD.sha}
      </p>
      <div className="fb-grid">
        {SCREENS.map((s) => (
          <figure key={s.file}>
            <img src={screenUrl(s)} alt={`${s.title}, capture de Mon Comptable`} loading="lazy" />
            <figcaption>
              <b>{s.title}</b> {s.description}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="fb-meta">
        WhatsApp {DOWNLOAD.whatsapp} · {DOWNLOAD.email}
      </p>
    </main>
  );
}
