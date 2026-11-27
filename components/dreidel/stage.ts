import type * as T from "three";

type Three = typeof import("three");

/**
 * The 3D "studio" the dreidels sit in, shared by the spinning dreidel and the globe: a renderer, a
 * soft night backdrop (so glass has something to show through; the canvas edges fade into the
 * page), reflections, and a key light, a fill light and a rim light.
 */
export function createStage(THREE: Three, RoomEnvironment: new () => T.Scene, el: HTMLElement, opts: { fade?: boolean } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  if (opts.fade !== false) {
    const fade = "radial-gradient(closest-side, #000 72%, transparent 100%)";
    canvas.style.setProperty("mask-image", fade);
    canvas.style.setProperty("-webkit-mask-image", fade);
  }
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const bg = document.createElement("canvas");
  bg.width = bg.height = 256;
  const bctx = bg.getContext("2d")!;
  const bgr = bctx.createRadialGradient(128, 110, 10, 128, 128, 180);
  bgr.addColorStop(0, "#2a1d52");
  bgr.addColorStop(0.5, "#17123a");
  bgr.addColorStop(1, "#0d0a1f");
  bctx.fillStyle = bgr;
  bctx.fillRect(0, 0, 256, 256);
  // A few warm and cool lights in the backdrop, for the glass to bend.
  for (const [x, y, r, c] of [
    [70, 80, 40, "rgba(255,170,80,0.35)"],
    [190, 70, 34, "rgba(120,140,255,0.35)"],
    [150, 190, 46, "rgba(255,120,90,0.18)"],
  ] as const) {
    const g2 = bctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, c);
    g2.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = g2;
    bctx.fillRect(0, 0, 256, 256);
  }
  const bgTex = new THREE.CanvasTexture(bg);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfcfff, 0.6);
  fill.position.set(4, 1, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(1, 4, -5);
  scene.add(rim);

  return {
    renderer,
    scene,
    canvas,
    dispose() {
      bgTex.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
