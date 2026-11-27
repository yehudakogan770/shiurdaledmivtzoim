"use client";

import { useEffect, useState } from "react";
import type * as T from "three";
import { parseDesign } from "@/lib/dreidel";
import { t } from "@/lib/i18n";
import { cx } from "../ui";

/**
 * A small picture of a player's dreidel, for player lists: the real 3D dreidel, rendered once per
 * design into a little image (one shared renderer, one at a time) and remembered.
 */
const cache = new Map<string, string>();
const waiting = new Map<string, Promise<string>>();
let stage: Promise<{ render(design: string): Promise<string> }> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getStage() {
  stage ??= (async () => {
    const THREE = await import("three");
    const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
    const { buildDreidel } = await import("./model");
    const SIZE = 160;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment() as unknown as T.Scene, 0.04).texture;
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(-3, 5, 4);
    scene.add(key, new THREE.AmbientLight(0xffffff, 0.2));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.3, 4.05);
    camera.lookAt(0, 0.99, 0);
    return {
      async render(design: string) {
        const model = await buildDreidel(THREE, design);
        model.spinner.rotation.y = -0.55;
        scene.add(model.root);
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL("image/png");
        scene.remove(model.root);
        model.dispose();
        return url;
      },
    };
  })();
  return stage;
}

function thumb(design: string): Promise<string> {
  const id = parseDesign(design).id;
  const have = cache.get(id);
  if (have) return Promise.resolve(have);
  const w = waiting.get(id);
  if (w) return w;
  const job = (queue = queue.then(async () => {
    const url = await (await getStage()).render(id);
    cache.set(id, url);
    waiting.delete(id);
    return url;
  }));
  waiting.set(id, job as Promise<string>);
  return job as Promise<string>;
}

export function DreidelThumb({ design, size = 40, className }: { design: string; size?: number; className?: string }) {
  const [url, setUrl] = useState(() => cache.get(parseDesign(design).id) ?? null);
  useEffect(() => {
    let alive = true;
    thumb(design).then((u) => alive && setUrl(u), () => {});
    return () => {
      alive = false;
    };
  }, [design]);
  const { base, color } = parseDesign(design);
  const label = color ? `${t(base.name)} · ${t(color.name)}` : t(base.name);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={label} title={label} width={size} height={size} className={cx("shrink-0", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-label={label} className={cx("inline-block shrink-0 animate-pulse rounded-xl bg-white/10", className)} style={{ width: size, height: size }} />
  );
}
