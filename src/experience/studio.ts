import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import gsap from "gsap";
import { BG, DOWNLOAD, isTouch, type ViewHandle } from "./data";

type Pos = "top" | "bottom";
type Block =
  | { kind: "para"; pos: Pos; head: string; text: string }
  | { kind: "list"; pos: Pos; head: string; items: string[]; stats?: boolean }
  | { kind: "chapter"; pos: Pos; head: string; numeral: string; text: string }
  | { kind: "quote"; pos: Pos; text: string; by: string }
  | { kind: "links"; pos: Pos; head: string; links: { label: string; href?: string }[] };

const BLOCKS: Block[] = [
  {
    kind: "para",
    pos: "top",
    head: "Hors ligne",
    text: "Vos données restent sur votre ordinateur. Saisir, calculer et imprimer ne demande aucune connexion.",
  },
  {
    kind: "list",
    pos: "bottom",
    head: "Dans le dossier",
    items: [
      "Écritures et journaux",
      "Facturation et relances",
      "Paie et bulletins PDF",
      "Trésorerie multi-comptes",
      "Rapports et fiscalité",
    ],
  },
  {
    kind: "chapter",
    pos: "top",
    head: "Partie un  ·  Précision",
    numeral: "I",
    text: "Chaque pièce est contrôlée au débit et au crédit avant d'être enregistrée.",
  },
  {
    kind: "quote",
    pos: "bottom",
    text: "« Des comptes clairs, des décisions sereines. »",
    by: "Mon Comptable",
  },
  {
    kind: "list",
    pos: "top",
    head: "En chiffres",
    stats: true,
    items: ["12  modules", "6  moyens de paiement", "0  connexion requise", "122  Mo à installer"],
  },
  {
    kind: "para",
    pos: "bottom",
    head: "Assistant comptable",
    text: "Il lit le dossier, répond à vos questions et propose les écritures. Vous validez avant tout enregistrement.",
  },
  {
    kind: "chapter",
    pos: "top",
    head: "Partie deux  ·  Sérénité",
    numeral: "II",
    text: "Le registre inaltérable garde la trace de chaque opération, horodatée et vérifiable.",
  },
  {
    kind: "list",
    pos: "bottom",
    head: "Installer en trois étapes",
    items: [
      "1  Téléchargez l'installeur",
      "2  Windows avertit : « Informations complémentaires »",
      "3  Puis « Exécuter quand même »",
    ],
  },
  {
    kind: "quote",
    pos: "top",
    text: "« Pensé pour les PME, cabinets et ONG d'Afrique de l'Ouest. »",
    by: "Windows 10 et 11, 64 bits",
  },
  {
    kind: "links",
    pos: "bottom",
    head: "Télécharger et contact",
    links: [
      { label: "Télécharger pour Windows →", href: DOWNLOAD.url },
      { label: `WhatsApp ${DOWNLOAD.whatsapp} →`, href: DOWNLOAD.whatsappUrl },
      { label: `${DOWNLOAD.email} →`, href: `mailto:${DOWNLOAD.email}` },
      { label: `Version ${DOWNLOAD.version} · SHA-256 ${DOWNLOAD.sha.slice(0, 12)}…` },
    ],
  },
];

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function blockHtml(b: Block): string {
  const head = (t: string) => `<div class="s-line s-grey">${esc(t)}</div>`;
  switch (b.kind) {
    case "para":
      return head(b.head) + `<p class="s-para" data-split>${esc(b.text)}</p>`;
    case "list":
      return (
        head(b.head) +
        b.items
          .map((i) => `<div class="s-line ${b.stats ? "s-stat" : "s-item"}">${esc(i)}</div>`)
          .join("")
      );
    case "chapter":
      return (
        head(b.head) +
        `<div class="s-line s-numeral">${b.numeral}</div><p class="s-chapter" data-split>${esc(b.text)}</p>`
      );
    case "quote":
      return `<p class="s-quote" data-split>${esc(b.text)}</p>` + head(`— ${b.by}`);
    case "links":
      return (
        head(b.head) +
        b.links
          .map((l) =>
            l.href
              ? `<a class="s-line s-link" href="${esc(l.href)}"${l.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)}</a>`
              : `<div class="s-line s-link s-mute">${esc(l.label)}</div>`,
          )
          .join("")
      );
  }
}

/** Coupe un paragraphe en lignes réelles (selon la largeur rendue) : chaque ligne bouge seule. */
function splitLines(p: HTMLElement) {
  const text = p.dataset["text"] ?? p.textContent ?? "";
  p.dataset["text"] = text;
  p.innerHTML = text
    .split(" ")
    .map((w) => `<span>${esc(w)}</span>`)
    .join(" ");
  const lines: string[][] = [];
  let top = -1;
  for (const span of p.querySelectorAll("span")) {
    if (span.offsetTop !== top) {
      lines.push([]);
      top = span.offsetTop;
    }
    lines[lines.length - 1]!.push(span.textContent ?? "");
  }
  p.innerHTML = lines.map((l) => `<span class="s-line">${esc(l.join(" "))}</span>`).join("");
}

interface LineState {
  el: HTMLElement;
  left: number;
  width: number;
  top: number;
  bottom: number;
  shift: number;
}
interface BlockState {
  el: HTMLElement;
  pos: Pos | "center";
  base: number;
  lines: LineState[];
  w: number;
  h: number;
}

/** Vue 3 : mascotte chrome, titre centré et piste horizontale qui s'écarte autour d'elle. */
export function createStudio(root: HTMLElement, opts: { reduced: boolean }): ViewHandle {
  root.innerHTML = `
    <div class="s-canvas"></div>
    <div class="s-track">
      <div class="s-block s-headline" data-pos="center">
        <h1>
          <span class="s-line">Votre comptabilité,</span>
          <span class="s-line">claire, précise et rapide,</span>
          <span class="s-line">même sans internet.</span>
        </h1>
        <a class="s-line s-cta" href="${esc(DOWNLOAD.url)}">Télécharger pour Windows</a>
        <div class="s-line s-grey s-meta">Version ${esc(DOWNLOAD.version)} · ${esc(DOWNLOAD.size)} · Windows 10 et 11</div>
      </div>
      ${BLOCKS.map((b) => `<div class="s-block" data-pos="${b.pos}">${blockHtml(b)}</div>`).join("")}
    </div>
    <div class="s-ring"></div>
    <div class="s-hint">DÉFILER <span>→</span></div>`;
  const host = root.querySelector<HTMLDivElement>(".s-canvas")!;
  const ring = root.querySelector<HTMLDivElement>(".s-ring")!;
  const hint = root.querySelector<HTMLDivElement>(".s-hint")!;
  const blocks: BlockState[] = [...root.querySelectorAll<HTMLElement>(".s-block")].map((el) => ({
    el,
    pos: el.dataset["pos"] as BlockState["pos"],
    base: 0,
    lines: [],
    w: 0,
    h: 0,
  }));

  const touch = isTouch();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 13;

  // Environnement du chrome : pièce noire éclairée par des panneaux émissifs (≤ 1,1 pour éviter les blocs brûlés).
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x0a0a0b);
  const panel = (
    w: number,
    h: number,
    i: number,
    pos: [number, number, number],
    rot: [number, number, number],
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    room.add(m);
  };
  panel(14, 5, 1.1, [0, 6, 0], [Math.PI / 2, 0, 0]);
  panel(3.2, 10, 1.0, [-6, 0, 0], [0, Math.PI / 2, 0]);
  panel(2.4, 10, 0.85, [6, 0, 0], [0, -Math.PI / 2, 0]);
  panel(12, 2.2, 0.6, [0, -1.5, -6], [0, 0, 0]);
  panel(5, 4, 0.8, [3, 2.5, 6], [0, Math.PI, 0]);
  panel(14, 6, 0.22, [0, -6, 0], [-Math.PI / 2, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, 0.02).texture;

  // Mascotte : une icône d'appli en chrome, avec visière, yeux, antenne et halo.
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.07 });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x040405,
    metalness: 0.3,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
  const bot = new THREE.Group();
  const head = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.9, 1.8, 6, 0.55), chrome);
  const visor = new THREE.Mesh(new RoundedBoxGeometry(1.75, 1.15, 0.3, 4, 0.14), visorMat);
  visor.position.z = 0.8;
  const eyes = [-0.3, 0.3].map((x) => {
    const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 6, 12), eyeMat);
    e.position.set(x, 0.03, 0.96);
    e.scale.z = 0.45;
    return e;
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 12), chrome);
  stem.position.y = 1.15;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), chrome);
  ball.position.y = 1.38;
  const ears = [-1.15, 1.15].map((x) => {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.065, 16, 40), chrome);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 24), visorMat);
    cap.rotation.x = Math.PI / 2;
    g.add(torus, cap);
    g.position.x = x;
    g.rotation.y = Math.PI / 2;
    return g;
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 16, 80), chrome);
  halo.position.y = -1.28;
  halo.rotation.x = 0.92 * (Math.PI / 2);
  const headGroup = new THREE.Group();
  headGroup.add(head, visor, ...eyes, stem, ball, ...ears);
  bot.add(headGroup, halo);
  const box = new THREE.Box3().setFromObject(bot);
  const center = box.getCenter(new THREE.Vector3());
  bot.children.forEach((c) => c.position.sub(center));
  const botH = box.getSize(new THREE.Vector3()).y;
  const holder = new THREE.Group();
  holder.add(bot);
  holder.position.z = -1;
  scene.add(holder);

  let W = 1,
    H = 1,
    botPx = 200;
  function layout() {
    W = root.clientWidth || window.innerWidth;
    H = root.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    botPx = 200 * (W <= 1024 ? 0.85 : W <= 1440 ? 0.9 : 1);
    const visH = 2 * (13 + 1) * Math.tan(THREE.MathUtils.degToRad(22.5));
    holder.scale.setScalar(((botPx / H) * visH) / botH);

    const phone = W <= 640;
    root.style.setProperty("--s-block-w", phone ? `${Math.min(W - 56, 300)}px` : "320px");
    root.querySelectorAll<HTMLElement>("[data-split]").forEach(splitLines);

    let x = W / 2 + (phone ? 70 : 200);
    let end = 0;
    for (const b of blocks) {
      b.w = b.el.offsetWidth;
      b.h = b.el.offsetHeight;
      if (b.pos === "center") {
        b.base = -b.w / 2;
        end = b.w / 2;
        continue;
      }
      b.base = x;
      end = x + b.w;
      x += phone ? 210 : Math.max(0.62 * b.w, 200) + 90;
    }
    L = end + (phone ? 140 : 260) + W / 2;
    const gap = phone ? 64 : 78;
    for (const b of blocks) {
      const top = b.pos === "center" ? -b.h / 2 : b.pos === "top" ? -gap - b.h : gap;
      b.el.style.top = `${H / 2 + top}px`;
      // offset* ignore les décalages en cours ; .s-line est en width: fit-content (largeur du texte).
      b.lines = [...b.el.querySelectorAll<HTMLElement>(".s-line")].map((el) => {
        const t = top + el.offsetTop;
        return {
          el,
          left: el.offsetLeft,
          width: el.offsetWidth,
          top: t,
          bottom: t + el.offsetHeight,
          shift: 0,
        };
      });
    }
  }

  // ── Piste horizontale (molette, glisser), boucle infinie ──
  let L = 1;
  const track = { x: 0, target: 0, vel: 0 };
  let hintShown = true;
  const nudge = (d: number) => {
    track.target += d;
    if (hintShown && Math.abs(track.target) > 4) {
      hintShown = false;
      gsap.to(hint, { opacity: 0, duration: 0.4 });
    }
    wake();
  };
  root.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      nudge(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    },
    { passive: false },
  );
  let tp: { x: number; y: number } | null = null;
  root.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0]!;
      tp = { x: t.clientX, y: t.clientY };
      track.vel = 0;
    },
    { passive: true },
  );
  root.addEventListener(
    "touchmove",
    (e) => {
      if (!tp) return;
      const t = e.touches[0]!;
      const dx = tp.x - t.clientX,
        dy = tp.y - t.clientY;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      tp = { x: t.clientX, y: t.clientY };
      nudge(d);
      track.vel = d;
    },
    { passive: true },
  );
  root.addEventListener("touchend", () => {
    tp = null;
  });
  const wrap = (x: number) => ((((x + L / 2) % L) + L) % L) - L / 2;

  // ── Comportement de la mascotte ──
  const rot = { x: 0, y: 0, z: 0 };
  const target = { x: touch ? 0 : -0.22, y: touch ? 0 : 0.32, z: touch ? 0 : 0.06 };
  const float = { phase: 0, speed: 1, amp: 1, y: 0 };
  const shake = { y: 0 };
  const reveal = { v: opts.reduced ? 1 : 0 };
  let frozen = false,
    asleep = false,
    lastInput = performance.now(),
    hits = 0;
  let mouseSeen = false;
  window.addEventListener("mousemove", (e) => {
    mouseSeen = true;
    if (!frozen && !asleep) {
      const dx = (e.clientX - W / 2) / (W / 2),
        dy = (e.clientY - H / 2) / (H / 2);
      target.x = THREE.MathUtils.clamp(dy, -0.62, 0.62);
      target.y = THREE.MathUtils.clamp(dx, -0.59, 0.59);
      target.z = 0.2 * dx;
    }
    wake();
  });
  void mouseSeen;
  const squash = (v: number, d: number, ease = "power2.inOut") =>
    gsap.to(
      eyes.map((e) => e.scale),
      { y: v, duration: d, ease },
    );
  function blinkLoop() {
    gsap.delayedCall(3 + Math.random() * 2, () => {
      if (!asleep && !frozen) squash(0.1, 0.09).then(() => squash(1, 0.09));
      blinkLoop();
    });
  }
  function headShake() {
    gsap
      .timeline()
      .to(shake, { y: 0.22, duration: 0.09 })
      .to(shake, { y: -0.18, duration: 0.12 })
      .to(shake, { y: 0.1, duration: 0.11 })
      .to(shake, { y: 0, duration: 0.18 });
  }
  function wake() {
    lastInput = performance.now();
    if (!asleep) return;
    asleep = false;
    gsap.to(float, { speed: 1, amp: 1, duration: 0.8 });
    gsap.set(
      eyes.map((e) => e.scale),
      { y: 1 },
    );
    headShake();
  }
  function sleep() {
    asleep = true;
    squash(0.2, 1.1);
    gsap.to(target, { x: 0.42, y: 0, z: 0.12, duration: 1.4, ease: "power2.inOut" });
    gsap.to(float, { speed: 0.35, amp: 1.6, duration: 1.6 });
  }

  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("click", (e) => {
    wake();
    if (reveal.v < 0.8 || frozen) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(((e.clientX - r.left) / W) * 2 - 1, -((e.clientY - r.top) / H) * 2 + 1),
      camera,
    );
    if (!raycaster.intersectObject(bot, true).length) return;
    frozen = true;
    gsap.fromTo(
      ring,
      { scale: 0, opacity: 0.9 },
      { scale: 1, opacity: 0, duration: 1.6, ease: "expo.out" },
    );
    const tl = gsap.timeline({
      onComplete: () => {
        frozen = false;
        headShake();
      },
    });
    if (hits++ % 2 === 0) {
      squash(0.35, 0.16, "power3.out");
      tl.to(rot, { x: rot.x - 0.45, y: rot.y + 0.18, duration: 0.16, ease: "power3.out" })
        .to(rot, { x: target.x, y: target.y, duration: 0.9, ease: "elastic.out(1, .45)" })
        .add(() => {
          squash(1, 0.2);
        }, 0.2);
    } else {
      tl.to(rot, { y: rot.y + Math.PI * 2, duration: 1.1, ease: "power3.inOut" })
        .fromTo(
          rot,
          { z: rot.z + 0.25 },
          { z: target.z, duration: 0.9, ease: "elastic.out(1, .5)" },
          0.2,
        )
        .add(() => {
          rot.y -= Math.PI * 2;
        });
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(((e.clientX - r.left) / W) * 2 - 1, -((e.clientY - r.top) / H) * 2 + 1),
      camera,
    );
    canvas.style.cursor =
      reveal.v > 0.8 && raycaster.intersectObject(bot, true).length ? "pointer" : "default";
  });
  const onKey = () => wake();

  // ── Écartement magnétique des lignes ──
  function magnet() {
    const phone = W <= 640;
    const k = phone ? 0.7875 : 1;
    const Rx = 0.88 * botPx * k,
      Ry = 0.8 * botPx * k,
      pad = 0.09 * botPx;
    const cx = W / 2,
      cy = H / 2 - float.y * (H / (2 * 14 * Math.tan(THREE.MathUtils.degToRad(22.5))));
    // Une ligne ne pousse que ses voisines du même bloc : jamais deux lignes l'une sur l'autre.
    const run = (list: { l: LineState; need: number }[], sign: number) => {
      let inner = 0;
      list.forEach(({ l, need }, i) => {
        const goal = Math.max(need, inner);
        const f = Math.max(0.1, 0.14 - 0.012 * i);
        l.shift += (goal - l.shift) * f;
        if (Math.abs(l.shift) < 0.05 && goal === 0) l.shift = 0;
        inner = l.shift;
        l.el.style.transform = l.shift ? `translate3d(0,${sign * l.shift}px,0)` : "";
      });
    };
    for (const b of blocks) {
      const above: { l: LineState; need: number }[] = [];
      const below: { l: LineState; need: number }[] = [];
      const bx = cx + wrap(b.base - track.x);
      b.el.style.transform = `translate3d(${bx}px,0,0)`;
      for (const l of b.lines) {
        const left = bx + l.left,
          right = left + l.width;
        const d = cx < left ? left - cx : cx > right ? cx - right : 0;
        const mid = H / 2 + (l.top + l.bottom) / 2;
        let need = 0;
        if (d < Rx) {
          const h = Ry * Math.sqrt(1 - (d / Rx) ** 2) + pad;
          need =
            mid < cy
              ? Math.max(0, H / 2 + l.bottom - (cy - h))
              : Math.max(0, cy + h - (H / 2 + l.top));
        }
        (mid < cy ? above : below).push({ l, need });
      }
      above.sort((a, b) => b.l.bottom - a.l.bottom);
      below.sort((a, b) => a.l.top - b.l.top);
      run(above, -1);
      run(below, 1);
    }
  }

  // ── Boucle ──
  let raf = 0;
  let last = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (tp === null && Math.abs(track.vel) > 0.1) {
      track.target += track.vel;
      track.vel *= 0.95;
    }
    track.x += (track.target - track.x) * 0.12;

    if (!touch && !asleep && reveal.v >= 1 && now - lastInput > 30000) sleep();
    const ease = 1 - Math.pow(1 - 0.08, 60 * dt);
    if (!frozen) {
      rot.x += (target.x - rot.x) * ease;
      rot.y += (target.y - rot.y) * ease;
      rot.z += (target.z - rot.z) * ease;
    }
    if (!opts.reduced) float.phase += dt * 1.5 * float.speed;
    const fy = opts.reduced ? 0 : Math.sin(float.phase) * 0.2 * float.amp * reveal.v;
    float.y += (fy - float.y) * ease;
    bot.rotation.set(rot.x, rot.y + shake.y, rot.z);
    holder.position.y = float.y;
    halo.rotation.z += dt * 0.35;
    const s = reveal.v;
    bot.scale.setScalar(Math.max(0.001, s));
    magnet();
    renderer.render(scene, camera);
  }

  const onResize = () => layout();
  let visits = 0;
  return {
    start() {
      layout();
      window.addEventListener("resize", onResize);
      window.addEventListener("keydown", onKey);
      if (!opts.reduced) {
        reveal.v = 0;
        gsap.to(reveal, {
          v: 1,
          duration: 1.4,
          ease: "back.out(1.4)",
          delay: visits === 0 ? 0.6 : 0.3,
        });
        if (visits === 0) {
          blinkLoop();
          gsap.fromTo(
            hint,
            { x: -8, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.9, ease: "expo.out", delay: 1.6 },
          );
        }
      }
      visits++;
      lastInput = performance.now();
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    },
  };
}
