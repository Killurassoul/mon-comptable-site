import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { BRAND_HEX, lerp, smoothstep } from "@/lib/tour";

const W = 1280;
const H = 800;
const FOV = 32;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const deg = THREE.MathUtils.degToRad;

function rr(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createScene(stage: HTMLElement, windowEl: HTMLElement, getTarget: () => number, onFrame: (p: number) => void) {
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  gl.domElement.className = "mc-gl";
  stage.appendChild(gl.domElement);
  const css = new CSS3DRenderer();
  css.domElement.className = "mc-css";
  stage.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const cssScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 30000);

  const group = new THREE.Group();
  const cssGroup = new THREE.Group();
  scene.add(group);
  cssScene.add(cssGroup);
  cssGroup.add(new CSS3DObject(windowEl));

  const slabMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.sidebar, metalness: 0.6, roughness: 0.35, transparent: true });
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(W, H, 18), { depth: 14, bevelEnabled: false, curveSegments: 8 }), slabMat);
  slab.position.z = -15;
  group.add(slab);

  const ring = rr(W + 3, H + 3, 19.5);
  ring.holes.push(rr(W, H, 18));
  const rimMat = new THREE.MeshBasicMaterial({ color: BRAND_HEX.accent, transparent: true, opacity: 0.35 });
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 15, bevelEnabled: false, curveSegments: 8 }), rimMat);
  rim.position.z = -15;
  group.add(rim);

  const hit = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hit);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b1d33, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-900, 700, 1200);
  scene.add(key);

  const N = 80;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 3200;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 2000;
    pos[i * 3 + 2] = -600 + Math.random() * 3200;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.12 }));
  scene.add(dust);

  const pt = new THREE.Vector2(), ps = new THREE.Vector2();
  let pointerIn = false;
  const ray = new THREE.Raycaster();
  const onMove = (e: PointerEvent) => {
    pointerIn = true;
    pt.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  const onLeave = () => { pointerIn = false; pt.set(0, 0); windowEl.style.setProperty("--go", "0"); };
  window.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("pointerleave", onLeave);

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    gl.setSize(w, h); css.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let p = getTarget(), time = 0, raf = 0, readyFlag = false;
  const tmp = new THREE.Vector3();

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    p += (getTarget() - p) * (1 - Math.exp(-dt / 0.09));
    ps.lerp(pt, 1 - Math.exp(-dt / 0.3));

    const vw = stage.clientWidth, vh = stage.clientHeight;
    const D = vh / 2 / TAN;
    const s0 = (0.46 * vw) / W;
    const sCover = Math.max(vw / W, vh / H) * 1.04;
    const fly = smoothstep(0.12, 0.3, p);
    const out = smoothstep(0.9, 0.95, p);
    const dStart = D / s0, dFill = D / sCover;
    camera.position.set(0, 0, lerp(lerp(dStart, dFill, fly), dStart * 1.8, out));

    const free = 1 - 0.8 * fly;
    group.position.set(lerp((0.21 * vw) / s0, 0, fly), Math.sin((time / 6) * Math.PI * 2) * 6 * free, 0);
    group.rotation.set(
      deg(lerp(6, 0, fly) - ps.y * 3 * free),
      deg(lerp(-16, 0, fly) + Math.sin((time / 6) * Math.PI * 2 + 1) * 0.6 * free + ps.x * 4 * free),
      0,
    );
    cssGroup.position.copy(group.position);
    cssGroup.rotation.copy(group.rotation);

    windowEl.style.opacity = String(1 - out);
    windowEl.style.visibility = out > 0.99 ? "hidden" : "visible";
    slabMat.opacity = 1 - out;
    rimMat.opacity = 0.35 * (1 - out);
    dust.position.z = fly * 1400 - out * 800;
    dust.rotation.z = time * 0.01;

    if (pointerIn) {
      ray.setFromCamera(new THREE.Vector2(pt.x, -pt.y), camera);
      group.updateMatrixWorld();
      const h = ray.intersectObject(hit)[0];
      if (h) {
        group.worldToLocal(tmp.copy(h.point));
        windowEl.style.setProperty("--gx", `${tmp.x + W / 2}px`);
        windowEl.style.setProperty("--gy", `${H / 2 - tmp.y}px`);
        windowEl.style.setProperty("--go", "1");
      } else windowEl.style.setProperty("--go", "0");
    }

    gl.render(scene, camera);
    css.render(cssScene, camera);
    onFrame(p);
    if (!readyFlag) { readyFlag = true; stage.setAttribute("data-scene-ready", "true"); }
  };
  frame();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", resize);
    gl.dispose();
    gl.domElement.remove();
    css.domElement.remove();
  };
}
