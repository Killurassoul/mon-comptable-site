import * as THREE from "three";
import gsap from "gsap";
import { SCREENS, SCREEN_ASPECT, screenUrl, isTouch, type Screen, type ViewHandle } from "./data";

const COUNT = 20;
const EXPAND_VH = 0.7;
const EXPAND_PUSH = 1.8;
const EXPAND_FADE = 0.1;
const BAND_PX = 290;

interface Plane {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  screen: Screen;
  sphere: THREE.Vector3; // position sur la sphère (unités monde, repère du groupe)
  pos: THREE.Vector3; // position courante hors zoom
  sizePx: number; // côté long courant, en px
  opacity: number;
  loaded: boolean;
}

/**
 * Vue 1 : sphère de captures. Glisser pour tourner (inertie), clic pour zoomer,
 * second clic pour la fiche. Les captures gardent leur format 16:10.
 */
export function createGallery(
  root: HTMLElement,
  opts: { reduced: boolean; onIntroDone: () => void },
): ViewHandle {
  root.innerHTML = `
    <div class="g-canvas"></div>
    <div class="g-wordmark">Mon Comptable</div>
    <div class="g-side g-side--l"><span>Mon Comptable</span></div>
    <div class="g-side g-side--r"><span>Comptabilité hors ligne</span></div>
    <div class="g-counter"><span>001</span></div>
    <div class="g-caption"><div class="g-caption-in"></div></div>
    <div class="g-hint">GLISSER POUR EXPLORER</div>
    <div class="g-cursor">Ouvrir</div>
    <div class="g-overview" role="dialog" aria-modal="false" aria-label="Fiche de l'écran">
      <div class="g-ov-head"><div><b class="g-ov-title"></b> <span class="g-ov-cat"></span></div>
      <button type="button" class="pill g-ov-close">Fermer</button></div>
      <p class="g-ov-desc"></p>
      <div class="g-ov-tags"><span>Capture réelle</span><span>Données fictives</span><span>Hors ligne</span></div>
    </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const host = $<HTMLDivElement>(".g-canvas");
  const wordmark = $(".g-wordmark");
  const sides = [...root.querySelectorAll<HTMLElement>(".g-side span")];
  const counterBox = $(".g-counter");
  const counterEl = $(".g-counter span");
  const captionIn = $(".g-caption-in");
  const hint = $(".g-hint");
  const cursorLabel = $(".g-cursor");
  const overview = $(".g-overview");

  const touch = isTouch();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !touch });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 12;
  const group = new THREE.Group();
  scene.add(group);

  let W = 1,
    H = 1;
  const worldPerPx = () => (2 * 12 * Math.tan(THREE.MathUtils.degToRad(30))) / H;
  const px = (v: number) => v * worldPerPx();
  let planeSize = 104,
    radius = 250,
    centerScale = 104 * (120 / 82);
  const phone = () => W <= 640;

  // Textures : une par capture, partagées entre les plans.
  const loader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const planes: Plane[] = [];
  for (let i = 0; i < COUNT; i++) {
    const screen = SCREENS[i % SCREENS.length]!;
    const material = new THREE.MeshBasicMaterial({
      color: 0x1b1b1d,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    planes.push({
      mesh,
      screen,
      sphere: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      sizePx: 0.01,
      opacity: 0,
      loaded: false,
    });
  }
  const loadAll = () => {
    for (const s of SCREENS) {
      if (textures.has(s.file)) continue;
      const tex = loader.load(screenUrl(s), (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        for (const p of planes) {
          if (p.screen !== s) continue;
          p.mesh.material.map = t;
          p.mesh.material.color.set(0xffffff);
          p.mesh.material.needsUpdate = true;
          p.loaded = true;
        }
        updateCounter();
      });
      textures.set(s.file, tex);
    }
  };

  function layout() {
    W = root.clientWidth || window.innerWidth;
    H = root.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const mid = W > 1024 && W <= 1440 ? 0.8 : 1;
    planeSize = phone() ? 72 : 104 * mid;
    radius = phone() ? W / 2 - 24 - planeSize / 2 : 250 * mid;
    centerScale = planeSize * (120 / 82);
    planes.forEach((p, i) => {
      const y = i * (2 / COUNT) - 1 + 1 / COUNT;
      const r = Math.sqrt(1 - y * y);
      const a = Math.PI * (3 - Math.sqrt(5)) * i;
      p.sphere.set(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(px(radius));
      if (phase === "sphere") {
        p.pos.copy(p.sphere);
        p.sizePx = planeSize;
      }
    });
  }

  // ── Rotation : glisser, inertie, auto-rotation jusqu'au premier geste ──
  let phase: "intro" | "sphere" = "intro";
  const vel = { x: 0, y: 0 };
  const acc = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  let autoSpin = !opts.reduced;
  const autoAxis = new THREE.Vector3(
    Math.sin(THREE.MathUtils.degToRad(23)),
    Math.cos(THREE.MathUtils.degToRad(23)),
    0,
  ).normalize();
  const qTmp = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0),
    AY = new THREE.Vector3(0, 1, 0);
  const stopAuto = () => {
    autoSpin = false;
  };

  // ── Zoom et fiche ──
  const zoom = { e: 0, band: 0 };
  let zoomed: Plane | null = null;
  let overviewOpen = false;
  const zoomTarget = new THREE.Vector3();

  function expand(p: Plane) {
    zoomed = p;
    p.mesh.renderOrder = 10;
    p.mesh.material.depthTest = false;
    gsap.to(zoom, { e: 1, duration: 0.8, ease: "power4.out" });
    showCursor(true);
  }
  function collapse() {
    if (!zoomed) return;
    closeOverview();
    const p = zoomed;
    gsap.to(zoom, {
      e: 0,
      duration: 0.8,
      ease: "power4.out",
      onComplete: () => {
        p.mesh.renderOrder = 0;
        p.mesh.material.depthTest = true;
        if (zoomed === p) zoomed = null;
      },
    });
    zoomed = null;
    lastZoomed = p;
    showCursor(false);
  }
  let lastZoomed: Plane | null = null;
  function openOverview(p: Plane) {
    overviewOpen = true;
    $(".g-ov-title").textContent = p.screen.title;
    $(".g-ov-cat").textContent = p.screen.category;
    $(".g-ov-desc").textContent = p.screen.description;
    gsap.to(zoom, { band: 1, duration: 0.8, ease: "power4.out" });
    overview.style.pointerEvents = "auto";
    gsap.fromTo(
      overview,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", delay: 0.12 },
    );
    cursorLabel.textContent = "Fermer";
  }
  function closeOverview() {
    if (!overviewOpen) return;
    overviewOpen = false;
    gsap.to(zoom, { band: 0, duration: 0.8, ease: "power4.out" });
    gsap.to(overview, { opacity: 0, y: 16, duration: 0.35, ease: "power2.in" });
    overview.style.pointerEvents = "none";
    cursorLabel.textContent = "Ouvrir";
  }
  $(".g-ov-close").addEventListener("click", collapse);

  // ── Curseur « Ouvrir / Fermer » ──
  const cx = gsap.quickTo(cursorLabel, "x", { duration: 0.5, ease: "power3.out" });
  const cy = gsap.quickTo(cursorLabel, "y", { duration: 0.5, ease: "power3.out" });
  let cursorShown = false;
  function showCursor(on: boolean) {
    if (touch || on === cursorShown) return;
    cursorShown = on;
    gsap.to(cursorLabel, {
      scale: on ? 1 : 0.6,
      opacity: on ? 1 : 0,
      duration: 0.6,
      ease: "power4.out",
    });
  }

  // ── Légende au survol ──
  let captionFor: Screen | null = null;
  function setCaption(s: Screen | null) {
    if (s === captionFor) return;
    captionFor = s;
    gsap.to(captionIn, {
      yPercent: -110,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        captionIn.innerHTML = s ? `<b>${s.title}</b><span>${s.category}</span>` : "";
        gsap.fromTo(
          captionIn,
          { yPercent: 110, opacity: 1 },
          { yPercent: 0, duration: 0.6, ease: "expo.out" },
        );
      },
    });
  }

  // ── Pointeur ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointer = { x: -1, y: -1, moved: false };
  let drag: { x: number; y: number; sx: number; sy: number; path: number } | null = null;
  const hitPlane = (): Plane | null => {
    ndc.set((pointer.x / W) * 2 - 1, -(pointer.y / H) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const visible = planes.filter((p) => p.opacity > 0.3 || p === zoomed).map((p) => p.mesh);
    const hit = raycaster.intersectObjects(visible, false)[0];
    if (!hit) return null;
    if (zoomed)
      return hit.object === zoomed.mesh
        ? zoomed
        : (planes.find((p) => p.mesh === hit.object) ?? null);
    return planes.find((p) => p.mesh === hit.object) ?? null;
  };
  const rect = () => canvas.getBoundingClientRect();
  canvas.addEventListener("pointerdown", (e) => {
    const r = rect();
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, path: 0 };
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top, moved: true };
    canvas.setPointerCapture(e.pointerId);
    if (phase === "sphere") stopAuto();
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = rect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top, moved: true };
    cx(e.clientX + 14);
    cy(e.clientY + 14);
    if (drag) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.path += Math.hypot(dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (phase === "sphere" && !zoomed) {
        vel.x += dx * 0.001;
        vel.y += dy * 0.001;
      }
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    const isClick = moved < 6 && drag.path < 10;
    drag = null;
    if (!isClick || phase !== "sphere") return;
    const hit = hitPlane();
    if (zoomed) {
      if (hit !== zoomed) collapse();
      else if (overviewOpen) closeOverview();
      else openOverview(zoomed);
    } else if (hit) expand(hit);
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.x = -1;
    setCaption(null);
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (phase !== "sphere" || zoomed) return;
      e.preventDefault();
      stopAuto();
      vel.x += e.deltaY * 0.0002;
    },
    { passive: false },
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") collapse();
  };

  // ── Compteur et intro ──
  let shown = 1;
  const counter = { v: 1 };
  const firstTen = () => planes.slice(0, 10).filter((p) => p.loaded).length;
  function updateCounter() {
    if (phase !== "intro") return;
    const target = Math.min(99, Math.round((firstTen() / 10) * 99));
    gsap.to(counter, { v: target, duration: 0.5, ease: "power1.out", onUpdate: renderCounter });
  }
  function renderCounter() {
    const v = Math.round(counter.v);
    if (v !== shown) {
      shown = v;
      counterEl.textContent = String(v).padStart(3, "0");
    }
  }

  const circle = { angle: 0, speed: 1 };
  const circleOn = { v: false };
  function runIntro() {
    gsap.set(
      planes.map((p) => p.mesh.material),
      { opacity: 0 },
    );
    gsap.fromTo(wordmark, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.2 });
    gsap.fromTo(
      sides,
      { yPercent: 100 },
      { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.07, delay: 0.5 },
    );
    gsap.fromTo(
      counterEl,
      { yPercent: 110 },
      { yPercent: 0, duration: 0.75, ease: "power4.out", delay: 0.5 },
    );
    setTimeout(loadAll, 200);
    const started = performance.now();
    const waitReady = () => {
      const elapsed = performance.now() - started;
      if ((elapsed > 2000 && firstTen() >= 10) || elapsed > 30000) startCircle();
      else setTimeout(waitReady, 120);
    };
    waitReady();
  }
  function startCircle() {
    gsap.to(counter, {
      v: 100,
      duration: 0.4,
      onUpdate: renderCounter,
      onComplete: () => {
        gsap.to(counterEl, {
          yPercent: -110,
          duration: 0.6,
          ease: "power4.in",
          onComplete: () => {
            counterBox.style.display = "none";
          },
        });
      },
    });
    const ten = planes.slice(0, 10);
    const R = 240 * (phone() ? 0.75 : 1);
    circleOn.v = true;
    ten.forEach((p, i) => {
      (p as Plane & { ci: number }).ci = i;
      p.pos.set(
        Math.cos(THREE.MathUtils.degToRad(-90 + i * 36)) * px(R),
        Math.sin(THREE.MathUtils.degToRad(-90 + i * 36)) * px(R),
        0,
      );
      gsap.to(p, { opacity: 1, duration: 1, ease: "power3.out", delay: i * 0.1 });
      gsap.fromTo(
        p,
        { sizePx: 0.01 },
        { sizePx: 70, duration: 1, ease: "back.out(1.7)", delay: i * 0.1 },
      );
    });
    gsap.to(circle, { speed: 7.3, duration: 1, ease: "power2.in", delay: 1.3 });
    gsap.delayedCall(2.3, () => {
      gsap.to(wordmark, { opacity: 0, duration: 0.75, ease: "power2.inOut" });
      gsap.to(sides, { yPercent: -100, duration: 0.6, ease: "power2.in" });
      const collapseT = { t: 0 };
      const from = ten.map((p) => p.pos.clone());
      const fromSize = ten.map((p) => p.sizePx);
      ten.forEach((p, i) => {
        const o = { t: 0 };
        gsap.to(o, {
          t: 1,
          duration: 1.25,
          ease: "power2.inOut",
          delay: i * 0.05,
          onUpdate: () => {
            circleOn.v = false;
            p.pos.lerpVectors(from[i]!, new THREE.Vector3(0, 0, px(i * 1.5)), o.t);
            p.sizePx = fromSize[i]! + (centerScale - fromSize[i]!) * o.t;
          },
        });
      });
      gsap.to(collapseT, {
        t: 1,
        duration: 1.25 + 0.45,
        onComplete: () => {
          gsap.delayedCall(0.2, explode);
        },
      });
    });
  }
  function explode() {
    const from = planes.map((p) => p.pos.clone());
    const fromSize = planes.map((p) => p.sizePx);
    const o = { t: 0 };
    gsap.to(o, {
      t: 1,
      duration: 1,
      ease: "power3.out",
      onUpdate: () => {
        const k = 1 + 0.1 * Math.sin(Math.PI * o.t);
        planes.forEach((p, i) => {
          p.pos.lerpVectors(from[i]!, p.sphere.clone().multiplyScalar(k), o.t);
          p.sizePx = fromSize[i]! + (planeSize - fromSize[i]!) * o.t;
          p.opacity = Math.max(p.opacity, o.t);
        });
      },
      onComplete: () => {
        phase = "sphere";
      },
    });
    gsap.to(sides, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.07 });
    gsap.to(hint, { opacity: 1, duration: 0.8, delay: 0.6 });
    opts.onIntroDone();
  }
  function skipIntro() {
    loadAll();
    phase = "sphere";
    wordmark.style.opacity = "0";
    counterBox.style.display = "none";
    planes.forEach((p) => {
      p.pos.copy(p.sphere);
      p.sizePx = planeSize;
      p.opacity = 1;
    });
    gsap.set(sides, { yPercent: 0 });
    hint.style.opacity = "1";
    opts.onIntroDone();
  }

  // ── Boucle ──
  const invQ = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  let raf = 0;
  let hovered: Plane | null = null;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (circleOn.v) {
      circle.angle += THREE.MathUtils.degToRad(0.5) * circle.speed;
      planes.slice(0, 10).forEach((p, i) => {
        const a = THREE.MathUtils.degToRad(-90 + i * 36) + circle.angle;
        const R = px(240 * (phone() ? 0.75 : 1));
        p.pos.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      });
    } else if (phase === "intro") {
      circle.angle += THREE.MathUtils.degToRad(0.5) * circle.speed;
    }

    if (phase === "sphere" && !zoomed && zoom.e === 0) {
      vel.x *= 0.94;
      vel.y *= 0.94;
      acc.x += vel.x;
      acc.y += vel.y;
      const px0 = smooth.x,
        py0 = smooth.y;
      smooth.x += (acc.x - smooth.x) * 0.11;
      smooth.y += (acc.y - smooth.y) * 0.11;
      group.quaternion.premultiply(qTmp.setFromAxisAngle(AY, smooth.x - px0));
      group.quaternion.premultiply(qTmp.setFromAxisAngle(AX, smooth.y - py0));
      if (autoSpin) group.quaternion.premultiply(qTmp.setFromAxisAngle(autoAxis, 0.001));
    }
    if (phase === "intro") group.quaternion.identity();

    invQ.copy(group.quaternion).invert();
    // Cible du zoom : centre de l'écran, remonté de la moitié de la bande de la fiche.
    const bandPx = BAND_PX * zoom.band;
    group.worldToLocal(zoomTarget.set(0, px(bandPx / 2), 0));
    const availH = H - bandPx;
    let zoomH = EXPAND_VH * availH;
    let zoomW = zoomH * SCREEN_ASPECT;
    if (phone() && zoomW > W - 16) {
      zoomW = W - 16;
      zoomH = zoomW / SCREEN_ASPECT;
    }

    const focus = zoomed ?? lastZoomed;
    for (const p of planes) {
      const m = p.mesh;
      m.quaternion.copy(invQ);
      const e = zoom.e;
      if (p === focus && e > 0) {
        m.position.lerpVectors(p.pos, zoomTarget, e);
        const w = p.sizePx + (zoomW - p.sizePx) * e;
        m.scale.set(px(w), px(w / SCREEN_ASPECT), 1);
        m.material.opacity = 1;
      } else {
        tmp.copy(p.pos).multiplyScalar(1 + (EXPAND_PUSH - 1) * e);
        m.position.copy(tmp);
        m.scale.set(px(p.sizePx), px(p.sizePx / SCREEN_ASPECT), 1);
        m.material.opacity = p.opacity * (1 - (1 - EXPAND_FADE) * e);
      }
    }
    if (zoom.e === 0) lastZoomed = null;

    // Survol (une fois par image).
    if (pointer.moved && phase === "sphere") {
      pointer.moved = false;
      const hit = pointer.x >= 0 ? hitPlane() : null;
      hovered = hit;
      if (!zoomed) setCaption(hit?.screen ?? null);
      const d = Math.hypot(pointer.x - W / 2, pointer.y - H / 2);
      canvas.style.cursor =
        drag && drag.path > 10 ? "grabbing" : hit ? "pointer" : d < 250 ? "grab" : "default";
      if (zoomed) showCursor(hit === zoomed);
    }
    renderer.render(scene, camera);
  }
  void hovered;

  const onResize = () => layout();
  let started = false;
  return {
    start() {
      layout();
      window.addEventListener("resize", onResize);
      window.addEventListener("keydown", onKey);
      if (!started) {
        started = true;
        if (opts.reduced) skipIntro();
        else runIntro();
      }
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
