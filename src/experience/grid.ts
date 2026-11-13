import * as THREE from "three";
import gsap from "gsap";
import {
  BG,
  INK,
  MUTE,
  SANS,
  SERIF,
  SCREENS,
  SCREEN_ASPECT,
  DOWNLOAD,
  screenUrl,
  isTouch,
  textCanvas,
  type Screen,
  type ViewHandle,
} from "./data";

const PAD = 8,
  GAP = 8,
  ROW_GAP = 40,
  HEAD_Y = 200,
  GRID_TOP = 80;

const toLinear = (c: number) => Math.pow(c, 2.2);

const TILE_FRAG = /* glsl */ `
  uniform sampler2D uTex; uniform float uReveal, uTime, uHover, uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 uv = (vUv - 0.5) / (1.0 + 0.06 * uHover) + 0.5;
    vec3 media = texture2D(uTex, uv).rgb * (1.0 + 0.06 * uHover);
    float sweep = fract(uTime * 0.6);
    float band = smoothstep(0.18, 0.0, abs((vUv.x + vUv.y) / 2.0 - sweep)) * 0.035;
    vec3 skel = vec3(pow(0.085 + band, 2.2));
    gl_FragColor = vec4(mix(skel, media, uReveal), uOpacity);
  }`;

const CHIP_FRAG = /* glsl */ `
  uniform sampler2D uTex, uLabel; uniform vec4 uRect; uniform vec2 uRadius, uSize;
  uniform float uReveal, uOpacity, uHover;
  varying vec2 vUv;
  void main() {
    vec2 tuv = uRect.xy + vUv * uRect.zw;
    tuv = (tuv - 0.5) / (1.0 + 0.06 * uHover) + 0.5;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 32.0);
      float a = fi * 2.39996323;
      acc += texture2D(uTex, tuv + vec2(cos(a), sin(a)) * r * uRadius).rgb;
    }
    acc /= 32.0;
    vec3 bg = mix(acc, vec3(0.0040), 0.78);
    bg = mix(vec3(0.0075), bg, uReveal);
    vec4 lab = texture2D(uLabel, vUv);
    vec3 col = mix(bg, lab.rgb, lab.a);
    vec2 p = (vUv - 0.5) * uSize;
    vec2 q = abs(p) - (uSize * 0.5 - 4.0);
    float d = length(max(q, 0.0)) - 4.0;
    gl_FragColor = vec4(col, uOpacity * clamp(0.5 - d, 0.0, 1.0));
  }`;

const LENS_FRAG = /* glsl */ `
  uniform sampler2D tScene; uniform float uBand;
  varying vec2 vUv;
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    float y = vUv.y; float t = 0.0; float dir = 0.0;
    if (y > 1.0 - uBand) { t = (y - (1.0 - uBand)) / uBand; dir = -1.0; }
    else if (y < uBand) { t = (uBand - y) / uBand; dir = 1.0; }
    vec3 col;
    if (t <= 0.0) col = texture2D(tScene, vUv).rgb;
    else {
      float sag = 1.0 - sqrt(1.0 - t * t);
      vec2 base = vUv + vec2(0.0, dir * sag * uBand);
      vec3 acc = vec3(0.0); vec3 wsum = vec3(0.0);
      for (int i = 0; i < 16; i++) {
        float s = float(i) / 15.0;
        vec3 w = vec3(smoothstep(0.8, 0.2, s), smoothstep(0.0, 0.5, s) * smoothstep(1.0, 0.5, s), smoothstep(0.2, 0.8, s));
        vec2 o = vec2(0.0, (s - 0.5) * 0.01 * sag * 30.0);
        acc += texture2D(tScene, clamp(base + o, 0.0, 1.0)).rgb * w;
        wsum += w;
      }
      col = acc / wsum;
    }
    gl_FragColor = vec4(toSRGB(col), 1.0);
  }`;

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface Tile {
  screen: Screen;
  index: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  chip: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  chipW: number;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  x: number;
  y: number;
  w: number;
  h: number;
  enter: { o: number; dy: number };
  loading: boolean;
  hover: { v: number };
}

function textPlane(canvas: HTMLCanvasElement, w: number, h: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.scale.set(w, h, 1);
  return mesh;
}

/** Vue 2 : grille WebGL des captures, bords en lentille de verre, puces givrées. */
export function createGrid(root: HTMLElement, opts: { reduced: boolean }): ViewHandle {
  root.innerHTML = `
    <div class="p-canvas"></div>
    <div class="p-bubble">Voir</div>
    <div class="p-lightbox" role="dialog" aria-modal="true" aria-label="Capture en grand" hidden>
      <div class="p-lb-inner">
        <img alt="" />
        <div class="p-lb-meta">
          <div><b class="p-lb-title"></b> <span class="p-lb-cat"></span></div>
          <button type="button" class="pill p-lb-close">Fermer</button>
        </div>
        <p class="p-lb-desc"></p>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const host = $<HTMLDivElement>(".p-canvas");
  const bubble = $(".p-bubble");
  const lightbox = $(".p-lightbox");

  const touch = isTouch();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG);
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(toLinear(12 / 255), toLinear(12 / 255), toLinear(13 / 255));
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const post = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { tScene: { value: rt.texture }, uBand: { value: 0.08 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: LENS_FRAG,
      depthTest: false,
    }),
  );
  const postScene = new THREE.Scene();
  postScene.add(post);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const loader = new THREE.TextureLoader();
  const blank = new THREE.Texture();
  const tiles: Tile[] = SCREENS.map((screen, index) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: blank },
        uReveal: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: TILE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const chipText = `${String(index + 1).padStart(2, "0")}  ${screen.category}`;
    const meas = document.createElement("canvas").getContext("2d")!;
    meas.font = `500 12px ${SANS}`;
    const chipW = Math.ceil(meas.measureText(chipText).width) + 16;
    const chipLabel = textCanvas(
      (c) => {
        c.font = `500 12px ${SANS}`;
        c.fillStyle = INK;
        c.textBaseline = "alphabetic";
        c.fillText(chipText, 8, 15);
      },
      chipW,
      22,
    );
    const labelTex = new THREE.CanvasTexture(chipLabel);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    labelTex.minFilter = THREE.LinearFilter;
    labelTex.generateMipmaps = false;
    const chip = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: blank },
          uLabel: { value: labelTex },
          uRect: { value: new THREE.Vector4() },
          uRadius: { value: new THREE.Vector2() },
          uSize: { value: new THREE.Vector2(chipW, 22) },
          uReveal: { value: 0 },
          uOpacity: { value: 0 },
          uHover: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: CHIP_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    );
    chip.renderOrder = 2;
    const label = textPlane(
      textCanvas(
        (c) => {
          c.font = `500 12px ${SANS}`;
          c.fillStyle = INK;
          c.fillText(screen.title, 0, 13);
          c.font = `400 13px ${SERIF}`;
          c.fillStyle = MUTE;
          c.fillText(screen.category, 0, 33);
        },
        320,
        40,
      ),
      320,
      40,
    );
    scene.add(mesh, chip, label);
    return {
      screen,
      index,
      mesh,
      chip,
      chipW,
      label,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      enter: { o: opts.reduced ? 1 : 0, dy: opts.reduced ? 0 : 60 },
      loading: false,
      hover: { v: 0 },
    };
  });

  // Titre (lettres qui se résolvent depuis des signes) et pied de page.
  let headMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  let footMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  const HEAD_A = "Une sélection d'écrans de ";
  const HEAD_B = "Mon Comptable, en conditions réelles";
  const scramble = { p: opts.reduced ? 1 : 0 };
  const rand = [...(HEAD_A + HEAD_B)].map(() => Math.random());
  const GLYPHS = ".:·,;_";
  function headText(s: string, offset: number) {
    return [...s]
      .map((ch, i) => {
        if (ch === " ") return ch;
        const k = (offset + i) / (HEAD_A.length + HEAD_B.length);
        return scramble.p >= 0.7 * k + 0.3 * rand[offset + i]!
          ? ch
          : GLYPHS[(i + Math.floor(scramble.p * 40)) % GLYPHS.length]!;
      })
      .join("");
  }
  function drawHead() {
    const phone = W <= 640;
    const width = Math.min(W - 32, 900),
      height = phone ? 50 : 30;
    const canvas2 = textCanvas(
      (c) => {
        c.textBaseline = "middle";
        const a = headText(HEAD_A, 0),
          b = headText(HEAD_B, HEAD_A.length);
        const sans = `500 16px ${SANS}`,
          serif = `400 17px ${SERIF}`;
        const lines: [string, string][] = phone
          ? [
              [a, ""],
              ["", b],
            ]
          : [[a, b]];
        lines.forEach(([la, lb], li) => {
          c.font = sans;
          const wa = c.measureText(la).width;
          c.font = serif;
          const wb = c.measureText(lb).width;
          let x = (width - wa - wb) / 2;
          const y = height / 2 + (phone ? (li - 0.5) * 20 : 0);
          c.font = sans;
          c.fillStyle = INK;
          c.fillText(la, x, y);
          x += wa;
          c.font = serif;
          c.fillText(lb, x, y);
        });
      },
      width,
      height,
    );
    if (headMesh) {
      headMesh.material.map!.dispose();
      scene.remove(headMesh);
    }
    headMesh = textPlane(canvas2, width, height);
    headMesh.position.set(W / 2, -HEAD_Y, 0);
    headMesh.material.opacity = Math.min(1, scramble.p * 3);
    scene.add(headMesh);
  }
  function drawFoot(y: number) {
    const phone = W <= 640;
    const width = W - 16;
    const c2 = textCanvas(
      (c) => {
        c.font = `400 13px ${SERIF}`;
        c.fillStyle = MUTE;
        c.textBaseline = "middle";
        if (phone) {
          c.fillText("Mon Comptable", 0, 10);
          const t = `Version ${DOWNLOAD.version}`;
          c.fillText(t, width - c.measureText(t).width, 10);
        } else {
          const t = `Mon Comptable — Version ${DOWNLOAD.version} pour Windows`;
          c.fillText(t, (width - c.measureText(t).width) / 2, 10);
        }
      },
      width,
      20,
    );
    if (footMesh) {
      footMesh.material.map!.dispose();
      scene.remove(footMesh);
    }
    footMesh = textPlane(c2, width, 20);
    footMesh.position.set(W / 2, -y, 0);
    scene.add(footMesh);
  }

  let W = 1,
    H = 1,
    pageH = 1;
  function layout() {
    W = root.clientWidth || window.innerWidth;
    H = root.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    rt.setSize(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const cols = W > 1024 ? 3 : W > 640 ? 2 : 1;
    const tw = (W - PAD * 2 - GAP * (cols - 1)) / cols;
    const th = tw / SCREEN_ASPECT;
    const top = HEAD_Y + GRID_TOP;
    tiles.forEach((t, i) => {
      const col = i % cols,
        row = Math.floor(i / cols);
      t.w = tw;
      t.h = th;
      t.x = PAD + col * (tw + GAP);
      t.y = top + row * (th + ROW_GAP + 40);
      (t as Tile & { col: number; row: number }).col = col;
      (t as Tile & { col: number; row: number }).row = row;
      t.mesh.scale.set(tw, th, 1);
      t.chip.scale.set(t.chipW, 22, 1);
      const u = t.chip.material.uniforms;
      u["uRect"]!.value.set(8 / tw, 1 - (8 + 22) / th, t.chipW / tw, 22 / th);
      u["uRadius"]!.value.set(40 / tw, 40 / th);
    });
    const rows = Math.ceil(tiles.length / cols);
    const lastBottom = top + rows * (th + ROW_GAP + 40);
    drawHead();
    drawFoot(lastBottom + 240);
    pageH = lastBottom + 300;
    scroll.target = Math.min(scroll.target, Math.max(0, pageH - H));
  }

  function place(t: Tile) {
    const dy = t.enter.dy;
    t.mesh.position.set(t.x + t.w / 2, -(t.y + t.h / 2) - dy, 0);
    t.chip.position.set(t.x + 8 + t.chipW / 2, -(t.y + 8 + 11) - dy, 0.1);
    t.label.position.set(t.x + 160, -(t.y + t.h + 12 + 20) - dy, 0);
    t.mesh.material.uniforms["uOpacity"]!.value = t.enter.o;
    t.chip.material.uniforms["uOpacity"]!.value = t.enter.o;
    t.label.material.opacity = t.enter.o;
    t.mesh.material.uniforms["uHover"]!.value = t.hover.v;
    t.chip.material.uniforms["uHover"]!.value = t.hover.v;
  }

  function maybeLoad(t: Tile) {
    if (t.loading) return;
    const top = t.y - scroll.y,
      bottom = top + t.h;
    if (top > H * 2.6 || bottom < -H * 0.6) return;
    t.loading = true;
    loader.load(screenUrl(t.screen), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      t.mesh.material.uniforms["uTex"]!.value = tex;
      t.chip.material.uniforms["uTex"]!.value = tex;
      const r = { v: 0 };
      gsap.to(r, {
        v: 1,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: () => {
          t.mesh.material.uniforms["uReveal"]!.value = r.v;
          t.chip.material.uniforms["uReveal"]!.value = r.v;
        },
      });
    });
  }

  // ── Défilement ──
  const scroll = { y: 0, target: 0, vel: 0 };
  let touchY: number | null = null;
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      scroll.target += e.deltaY;
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0]!.clientY;
      scroll.vel = 0;
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null) return;
      const y = e.touches[0]!.clientY;
      const d = touchY - y;
      touchY = y;
      scroll.target += d;
      scroll.vel = d;
    },
    { passive: true },
  );
  canvas.addEventListener("touchend", () => {
    touchY = null;
  });

  // ── Survol, bulle « Voir », clic ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = { x: -1, y: -1 };
  const bx = gsap.quickTo(bubble, "x", { duration: 0.5, ease: "power3.out" });
  const by = gsap.quickTo(bubble, "y", { duration: 0.5, ease: "power3.out" });
  let hovered: Tile | null = null;
  const desktopHover = () => !touch && W > 1024;
  function setHovered(t: Tile | null) {
    if (t === hovered) return;
    if (hovered) gsap.to(hovered.hover, { v: 0, duration: 0.45, ease: "power2.out" });
    hovered = t;
    if (t) gsap.to(t.hover, { v: 1, duration: 0.45, ease: "power2.out" });
    if (desktopHover()) {
      gsap.to(bubble, {
        scale: t ? 1 : 0.6,
        opacity: t ? 1 : 0,
        duration: t ? 0.75 : 0.6,
        ease: "power4.out",
      });
      canvas.style.cursor = t ? "pointer" : "default";
    }
  }
  const pick = (): Tile | null => {
    ndc.set((pointer.x / W) * 2 - 1, -(pointer.y / H) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(
      tiles.map((t) => t.mesh),
      false,
    )[0];
    return hit ? (tiles.find((t) => t.mesh === hit.object) ?? null) : null;
  };
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    bx(e.clientX - 32);
    by(e.clientY - 32);
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.x = -1;
    if (desktopHover()) setHovered(null);
  });
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
      down = null;
      return;
    }
    down = null;
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    const t = pick();
    if (t) openLightbox(t.screen);
  });

  // ── Visionneuse ──
  const lbImg = lightbox.querySelector("img")!;
  function openLightbox(s: Screen) {
    lbImg.src = screenUrl(s);
    lbImg.alt = `${s.title}, capture de Mon Comptable`;
    $(".p-lb-title").textContent = s.title;
    $(".p-lb-cat").textContent = s.category;
    $(".p-lb-desc").textContent = s.description;
    lightbox.hidden = false;
    gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: 0.45 });
    gsap.fromTo(
      ".p-lb-inner",
      { scale: 0.94, y: 20 },
      { scale: 1, y: 0, duration: 0.9, ease: "expo.out" },
    );
    $<HTMLButtonElement>(".p-lb-close").focus();
  }
  function closeLightbox() {
    if (lightbox.hidden) return;
    gsap.to(lightbox, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        lightbox.hidden = true;
        lbImg.removeAttribute("src");
      },
    });
  }
  $(".p-lb-close").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeLightbox();
  };

  // ── Boucle ──
  let raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    const time = clock.getElapsedTime();
    if (touchY === null && Math.abs(scroll.vel) > 0.1) {
      scroll.target += scroll.vel;
      scroll.vel *= 0.95;
    }
    scroll.target = Math.max(0, Math.min(scroll.target, Math.max(0, pageH - H)));
    scroll.y += (scroll.target - scroll.y) * 0.12;
    camera.position.set(W / 2, -H / 2 - scroll.y, H / 2 / Math.tan(THREE.MathUtils.degToRad(17.5)));
    camera.lookAt(W / 2, -H / 2 - scroll.y, 0);

    if (scramble.p < 1 && headMesh) drawHead();
    for (const t of tiles) {
      maybeLoad(t);
      t.mesh.material.uniforms["uTime"]!.value = time;
      place(t);
    }
    if (desktopHover()) {
      if (pointer.x >= 0) setHovered(pick());
    } else {
      // Tactile ou écran étroit : la capture la plus proche du centre s'anime.
      let best: Tile | null = null,
        bd = Infinity;
      for (const t of tiles) {
        const d = Math.abs(t.y + t.h / 2 - scroll.y - H / 2);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      setHovered(best);
    }
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  function entrance() {
    if (opts.reduced) return;
    gsap.to(scramble, { p: 1, duration: 1.1, ease: "power2.out" });
    tiles.forEach((t) => {
      const { col, row } = t as Tile & { col: number; row: number };
      const delay = 0.35 + 0.08 * col + 0.06 * row;
      gsap.to(t.enter, { o: 1, duration: 0.9, ease: "power2.out", delay });
      gsap.to(t.enter, { dy: 0, duration: 1.2, ease: "expo.out", delay });
    });
  }

  const onResize = () => layout();
  let entered = false;
  return {
    start() {
      layout();
      window.addEventListener("resize", onResize);
      window.addEventListener("keydown", onKey);
      if (!entered) {
        entered = true;
        entrance();
      }
      clock.start();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      closeLightbox();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    },
  };
}
