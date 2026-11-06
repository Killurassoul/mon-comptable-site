import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { FEATURES, type Feature } from "@/lib/features";

/* Ruban de cartes piloté au scroll : les cartes glissent sur un rail fixe,
   s'approchent en arc, disparaissent dans le fond, puis se posent en grille. */

const LAND_COUNT = 6;
const CARD_W = 2.1;
const CARD_H = 1.32;
const GAP = 0.03;
const STEP = CARD_W + GAP;
const NX = 28;
const NY = 3;
const GZ = 8;
const FOV = 35;
const SAMPLES = 1200;
const PH0 = -1.5;
const PH1 = Math.PI * 2 + 1.35;
const RIB_A = 0.14;
const RIB_B = 0.63;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paintCard(ctx: CanvasRenderingContext2D, feature: Feature, index: number, total: number) {
  const W = 1024;
  const H = 640;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1b1c2d");
  bg.addColorStop(1, "#0f1018");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.86, -H * 0.08, 0, W * 0.86, -H * 0.08, W * 0.78);
  glow.addColorStop(0, "rgba(139,92,246,.34)");
  glow.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(244,241,234,.13)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(2, 2, W - 4, H - 4, 26);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a78bfa";
  ctx.font = '600 25px "Lexend", system-ui, sans-serif';
  ctx.fillText(`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 60, 80);

  ctx.fillStyle = "#f5f6fc";
  ctx.font = '600 60px "Lexend", system-ui, sans-serif';
  const titleLines = wrapLines(ctx, feature.title, W - 120).slice(0, 2);
  let y = 182;
  for (const line of titleLines) {
    ctx.fillText(line, 60, y);
    y += 66;
  }

  ctx.fillStyle = "#9aa0bb";
  ctx.font = '400 30px "Lexend", system-ui, sans-serif';
  let by = y + 24;
  for (const line of wrapLines(ctx, feature.text, W - 130).slice(0, 3)) {
    ctx.fillText(line, 60, by);
    by += 45;
  }

  ctx.fillStyle = "rgba(167,139,250,.9)";
  ctx.fillRect(60, H - 84, 44, 3);
  ctx.fillStyle = "#7f85a2";
  ctx.font = '500 21px "Lexend", system-ui, sans-serif';
  ctx.fillText("MON COMPTABLE", 122, H - 75);
}

const VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const FRAG = `uniform sampler2D map;
uniform vec2 cover;
uniform float aspect;
uniform float ready;
uniform float radius;
varying vec2 vUv;
void main(){
  vec2 q = (abs(vUv - .5) - .5) * vec2(aspect, 1.) + radius;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
  float px = fwidth(d);
  float a = 1. - smoothstep(-px, px, d);
  if (a < .01) discard;
  vec2 uv = vUv;
  if (!gl_FrontFacing) uv.x = 1. - uv.x;
  vec3 c = mix(vec3(.058, .062, .086), texture2D(map, (uv - .5) * cover + .5).rgb, ready);
  float edge = smoothstep(-.012 - px, -.012, d);
  gl_FragColor = vec4(mix(c, vec3(1.), edge * .1), a);
}`;

type Card = {
  i: number;
  feature: Feature;
  ctx: CanvasRenderingContext2D | null;
  texture: THREE.CanvasTexture | null;
  geo: THREE.PlaneGeometry;
  mesh: THREE.Mesh;
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
    vw: number;
    vh: number;
    c: number;
    r: number;
  } | null;
};

export function FeaturesRibbon() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const line1Ref = useRef<HTMLSpanElement | null>(null);
  const line2Ref = useRef<HTMLSpanElement | null>(null);
  const captionRef = useRef<HTMLParagraphElement | null>(null);
  const ruleRef = useRef<HTMLSpanElement | null>(null);
  const hintRef = useRef<HTMLSpanElement | null>(null);
  const nameRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () =>
      setEnabled(
        !mq.matches && window.innerWidth > 820 && typeof WebGLRenderingContext !== "undefined",
      );
    decide();
    window.addEventListener("resize", decide);
    mq.addEventListener("change", decide);
    return () => {
      window.removeEventListener("resize", decide);
      mq.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!canvas || !stage || !track) return;

    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

    /* ---- rail ---- */
    const pathPoints: THREE.Vector3[] = [];
    const pathTangents: THREE.Vector3[] = [];
    let pathLength = 1;
    let curve: THREE.CatmullRomCurve3 | null = null;

    const buildPath = () => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160;
        const ph = mix(PH0, PH1, t);
        const cs = Math.cos(ph);
        const u = 2 * t - 1;
        const depth = cs > 0 ? 7.6 + 16.4 * Math.pow(cs, 0.9) : 7.6 + 2.2 * cs;
        const edge = 0.84 + 0.5 * span(0.14 - t, 0, 0.14) + 0.8 * span(t, 0.84, 1);
        pts.push(
          new THREE.Vector3(
            edge * Math.sin(ph) * depth * 0.561,
            0.5 * Math.sign(u) * Math.pow(Math.abs(u), 1.4) * depth * 0.63,
            -depth,
          ),
        );
      }
      curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      curve.arcLengthDivisions = 1500;
      pathLength = curve.getLength();
      pathPoints.length = 0;
      pathTangents.length = 0;
      for (let i = 0; i <= SAMPLES; i++) {
        const u = i / SAMPLES;
        pathPoints.push(curve.getPointAt(u));
        pathTangents.push(curve.getTangentAt(u));
      }
    };
    buildPath();

    const op = new THREE.Vector3();
    const ot = new THREE.Vector3();
    const at = (s: number, outPos: THREE.Vector3, outTan: THREE.Vector3) => {
      const f = clamp(s / pathLength) * SAMPLES;
      const i = Math.min(SAMPLES - 1, Math.floor(f));
      const k = f - i;
      const a = pathPoints[i] as THREE.Vector3;
      const b = pathPoints[i + 1] as THREE.Vector3;
      outPos.lerpVectors(a, b, k);
      outTan
        .lerpVectors(pathTangents[i] as THREE.Vector3, pathTangents[i + 1] as THREE.Vector3, k)
        .normalize();
    };

    /* ---- cards ---- */
    const textureSize = 1024;
    const cards: Card[] = FEATURES.map((feature, i) => {
      const cv = document.createElement("canvas");
      cv.width = textureSize;
      cv.height = 640;
      const ctx = cv.getContext("2d");
      if (ctx) paintCard(ctx, feature, i, FEATURES.length);
      const texture = new THREE.CanvasTexture(cv);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 4;

      const geo = new THREE.PlaneGeometry(1, 1, NX, NY);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          map: { value: texture },
          cover: { value: new THREE.Vector2(1, 1) },
          aspect: { value: CARD_W / CARD_H },
          ready: { value: 1 },
          radius: { value: 0.018 },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      return { i, feature, ctx, texture, geo, mesh, rect: null };
    });

    // Les polices du site arrivent après le premier rendu : on redessine ensuite.
    document.fonts?.ready
      .then(() => {
        if (disposed) return;
        for (const card of cards) {
          if (!card.ctx || !card.texture) continue;
          paintCard(card.ctx, card.feature, card.i, FEATURES.length);
          card.texture.needsUpdate = true;
        }
      })
      .catch(() => {});

    /* ---- layout ---- */
    let W = 1;
    let H = 1;
    let aspect = 1;
    let cols = 3;
    let rows = 2;
    let tanHalf = 0.3153;

    const resize = () => {
      W = stage.clientWidth || window.innerWidth;
      H = stage.clientHeight || window.innerHeight;
      aspect = W / H;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H, false);
      camera.aspect = aspect;
      camera.fov = aspect < 16 / 9 ? (Math.atan(0.561 / aspect) * 360) / Math.PI : FOV;
      camera.updateProjectionMatrix();
      tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      cols = aspect < 0.9 ? 2 : 3;
      rows = aspect < 0.9 ? 3 : 2;
    };
    resize();

    const gridSlot = (i: number) => {
      const vh = 2 * GZ * tanHalf;
      const vw = vh * aspect;
      const gw = vw * (cols === 3 ? 0.74 : 0.88);
      const gap = gw * 0.017;
      const cw = (gw - gap * (cols - 1)) / cols;
      const ch = cw / (CARD_W / CARD_H);
      const gh = ch * rows + gap * 1.6 * (rows - 1);
      const c = i % cols;
      const r = Math.floor(i / cols);
      return {
        x: -gw / 2 + cw / 2 + c * (cw + gap),
        y: gh / 2 - ch / 2 - r * (ch + gap * 1.6),
        w: cw,
        h: ch,
        vw,
        vh,
        c,
        r,
      };
    };

    /* ---- pose ---- */
    const up = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    const vp = new THREE.Vector3();

    const poseRibbon = (card: Card, head: number) => {
      const pos = card.geo.attributes["position"] as THREE.BufferAttribute;
      const centre = head - card.i * STEP;
      for (let iy = 0; iy <= NY; iy++) {
        for (let ix = 0; ix <= NX; ix++) {
          const k = iy * (NX + 1) + ix;
          const lu = ix / NX - 0.5;
          const lv = 0.5 - iy / NY;
          at(centre + lu * CARD_W, op, ot);
          up.copy(Y).addScaledVector(ot, -Y.dot(ot)).normalize();
          vp.copy(op).addScaledVector(up, lv * CARD_H);
          pos.setXYZ(k, vp.x, vp.y, vp.z);
        }
      }
      pos.needsUpdate = true;
      card.rect = null;
    };

    const poseGrid = (card: Card, q: number) => {
      const g = gridSlot(card.i);
      const pos = card.geo.attributes["position"] as THREE.BufferAttribute;
      const dx = (g.c - (cols - 1) / 2) * 1.2;
      const dy = g.r < rows / 2 ? 1 : -1;
      const ox = dx * g.vw * 0.62 * (1 - q);
      const oy = dy * g.vh * (g.c === 1 ? 0.95 : 0.34) * (1 - q);
      const tilt = (1 - q) * 0.22 * (g.c - 1 || 0.5) * dy;
      const cs = Math.cos(tilt);
      const sn = Math.sin(tilt);
      for (let iy = 0; iy <= NY; iy++) {
        for (let ix = 0; ix <= NX; ix++) {
          const k = iy * (NX + 1) + ix;
          const x = (ix / NX - 0.5) * g.w;
          const y = (0.5 - iy / NY) * g.h;
          pos.setXYZ(
            k,
            g.x + ox + x * cs - y * sn,
            g.y + oy + x * sn + y * cs,
            -GZ - (1 - q) * 0.6 * Math.sin((ix / NX) * Math.PI),
          );
        }
      }
      pos.needsUpdate = true;
      card.rect = g;
    };

    /* ---- scroll ---- */
    let target = 0;
    let progress = 0;
    let running = true;

    const readScroll = () => {
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = clamp(total > 0 ? -rect.top / total : 0);
    };

    /* ---- render ---- */
    const render = () => {
      const p = progress;

      const rise = 1 - outCubic(span(p, 0, 0.12));
      const run = mix(-50, 76, span(p, 0, 0.58));
      if (line1Ref.current)
        line1Ref.current.style.transform = `translate3d(${run}vw,${rise * 34}vh,0)`;
      if (line2Ref.current)
        line2Ref.current.style.transform = `translate3d(${-run}vw,${rise * 34}vh,0)`;

      if (captionRef.current) {
        captionRef.current.style.opacity = String(1 - span(p, 0.52, 0.57));
        captionRef.current.style.transform = `translate(-50%,calc(-50% + ${rise * 34}vh))`;
      }

      const intro = 1 - span(p, 0, 0.05);
      if (hintRef.current) hintRef.current.style.opacity = String(intro);

      if (ruleRef.current) ruleRef.current.style.transform = `scaleX(${ease(span(p, 0.72, 0.86))})`;

      const pr = span(p, RIB_A, RIB_B);
      const head = mix(0, pathLength + cards.length * STEP, pr);

      for (const card of cards) {
        const s = head - card.i * STEP;
        const end = pathLength - CARD_W;
        if (s < end) {
          card.mesh.visible = s > CARD_W;
          card.rect = null;
          if (card.mesh.visible) poseRibbon(card, head);
        } else if (card.i < LAND_COUNT) {
          const st = mix(RIB_A, RIB_B, (end + card.i * STEP) / (pathLength + cards.length * STEP));
          const q = outCubic(span(p, st, st + 0.13));
          card.mesh.visible = q > 0.001;
          if (q > 0.001) poseGrid(card, q);
          else card.rect = null;
        } else {
          card.mesh.visible = false;
          card.rect = null;
        }
      }

      renderer.render(scene, camera);
    };

    /* ---- hover ---- */
    const nameEl = nameRef.current;
    const onPointerMove = (event: PointerEvent) => {
      if (!nameEl) return;
      let hit: Card | null = null;
      if (progress > 0.86) {
        const rect = stage.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - 0.5;
        const ny = 0.5 - (event.clientY - rect.top) / rect.height;
        for (const card of cards) {
          const g = card.rect;
          if (!g) continue;
          if (Math.abs(nx * g.vw - g.x) < g.w / 2 && Math.abs(ny * g.vh - g.y) < g.h / 2)
            hit = card;
        }
      }
      nameEl.style.opacity = hit ? "1" : "0";
      if (hit) {
        nameEl.textContent = hit.feature.title;
        nameEl.style.transform = `translate(${event.clientX + 14}px,${event.clientY + 16}px)`;
      }
    };
    stage.addEventListener("pointermove", onPointerMove);

    /* ---- loop ---- */
    const loop = () => {
      if (disposed) return;
      if (running) {
        // La position est relue à chaque image : le scroll lissé (Lenis) ne
        // déclenche pas toujours un évènement natif.
        readScroll();
        progress += (target - progress) * 0.09;
        if (Math.abs(target - progress) < 0.00005) progress = target;
        render();
      }
      frame = requestAnimationFrame(loop);
    };
    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        running = entries.some((entry) => entry.isIntersecting);
      },
      { rootMargin: "200px" },
    );
    observer.observe(track);

    readScroll();
    render();
    frame = requestAnimationFrame(loop);

    const onResize = () => {
      resize();
      readScroll();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", readScroll, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", readScroll);
      stage.removeEventListener("pointermove", onPointerMove);
      for (const card of cards) {
        card.geo.dispose();
        (card.mesh.material as THREE.ShaderMaterial).dispose();
        card.texture?.dispose();
      }
      scene.clear();
      renderer.dispose();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="mc-fr-track" ref={trackRef}>
      <div className="mc-fr-stage" ref={stageRef}>
        <h2 className="mc-fr-headline">
          <span className="mc-fr-line mc-fr-line--1" ref={line1Ref} aria-hidden="true">
            <span>TOUS LES</span>
          </span>
          <span className="mc-fr-line mc-fr-line--2" ref={line2Ref} aria-hidden="true">
            <span>MODULES</span>
          </span>
        </h2>
        <p className="mc-fr-cap" ref={captionRef}>
          Douze modules pour tenir un dossier, de la saisie au rapport de clôture.
        </p>
        <span className="mc-fr-rule" ref={ruleRef} aria-hidden="true" />
        <canvas className="mc-fr-canvas" ref={canvasRef} aria-hidden="true" />
        <span className="mc-fr-hint" ref={hintRef}>
          12 MODULES · UN DOSSIER
        </span>
        <div className="mc-fr-name" ref={nameRef} aria-hidden="true" />
      </div>
    </div>
  );
}
