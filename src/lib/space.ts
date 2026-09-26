/**
 * ホームの hero の背景。技術のロゴが宇宙を漂い、こちらへ流れてくる場面を three.js で描く。
 * ブラウザ専用。SpaceBackground.astro が hero になってから動的に読み込む。
 *
 * - 色はすべてデザイントークン（global.css）から読む。ここで色を決めない。
 *   配色を切り替えたら読み直す。背景はフォグで --bg に溶かすので、ページの地と継ぎ目が出ない。
 * - 描くのは hero のあいだだけ。質問して results になったら止める（答えを読む邪魔をしない）。
 * - 動きを減らす設定（prefers-reduced-motion）なら、流さず・視点も動かさず、その場でゆっくり回すだけにする。
 *   奥から迫ってくる動き（拡大）と視差は、この設定で抑えるべき動きそのものなので。
 * - WebGL が使えなければ何もしない。背景が無いだけで、ページは今までどおり動く。
 */
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Curve,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { LOGOS, type Tone } from './space-logos';

/** 物体が現れる奥行き。フォグもここで消えきる */
const DEPTH = 70;
/** こちらへ流れてくる速さ（単位/秒）。奥から手前まで40秒ほど */
const SPEED = 1.7;
/**
 * 視線の真ん中に空けておく筒の半径。
 * 近いものほど大きく外へ流れるので、ここが狭いと、画面の端に来るころには
 * 手前すぎて大きくなりすぎる。真ん中を通すと、検索窓の真後ろで大きくなって文字に被る。
 */
const CLEAR_RADIUS = 8;
/** 現れる範囲の広さ。奥の面で見えている範囲に対する割合 */
const SPREAD = 0.45;
/** ロゴ1つの大きさ（横幅） */
const LOGO_SIZE = 1.8;
/** 同じロゴを何個ずつ浮かべるか。React は主役なので多め、大きめ */
const COPIES = { react: 7, other: 3 };
/** space-logos.ts の中から、訪問のたびに何種類を選んで出すか（React は別に毎回出る） */
const KINDS_PER_VISIT = 8;
const STAR_COUNT = 1400;

type Drifter = {
  object: Object3D;
  spin: Vector3;
};

/** React のロゴの軌道。楕円の線を管にする */
class Orbit extends Curve<Vector3> {
  readonly rx: number;
  readonly ry: number;

  constructor(rx: number, ry: number) {
    super();
    this.rx = rx;
    this.ry = ry;
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const angle = t * Math.PI * 2;
    return target.set(Math.cos(angle) * this.rx, Math.sin(angle) * this.ry, 0);
  }
}

/** 公式のロゴの比率（軌道 11 × 4.2、線幅 1、核 2.05）を横幅 1 に縮めたもの */
function reactAtom(material: MeshLambertMaterial): Group {
  const orbit = new TubeGeometry(new Orbit(0.5, 0.19), 96, 0.024, 8, true);
  const nucleus = new SphereGeometry(0.095, 24, 16);
  const atom = new Group();
  for (const angle of [0, 60, 120]) {
    const ring = new Mesh(orbit, material);
    ring.rotation.z = (angle * Math.PI) / 180;
    atom.add(ring);
  }
  atom.add(new Mesh(nucleus, material));
  atom.scale.setScalar(LOGO_SIZE * 1.3);
  return atom;
}

/** Simple Icons の 24×24 の path に厚みを付け、中心を原点に、横幅を LOGO_SIZE に揃える */
function logoGeometry(d: string): BufferGeometry {
  // SVG は y が下向きなので、読むときに上下を返しておく
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path transform="scale(1,-1)" d="${d}"/></svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((path) => path.toShapes());
  const geometry = new ExtrudeGeometry(shapes, {
    depth: 2.4,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.06,
    bevelSegments: 1,
  });
  geometry.center();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const width = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
  geometry.scale(LOGO_SIZE / width, LOGO_SIZE / width, LOGO_SIZE / width);
  return geometry;
}

/** 星の点を丸くぼかす。色は付けず、濃さだけを持たせる（色は material が持つ） */
function dotTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

function token(name: string): Color {
  return new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** items からランダムに count 個を選ぶ（Fisher–Yates の途中まで。元の配列は変えない） */
function pick<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

export function mountSpace(canvas: HTMLCanvasElement): void {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch {
    return;
  }

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const scene = new Scene();
  scene.fog = new Fog(0, DEPTH * 0.25, DEPTH);
  const camera = new PerspectiveCamera(60, 1, 0.1, DEPTH + 10);

  scene.add(new AmbientLight(0xffffff, 1.6));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 6, 8);
  scene.add(sun);

  // ロゴ。同じトークンのものは material を共有し、配色の切り替えで一度に塗り直す
  const materials = new Map<Tone, MeshLambertMaterial>();
  const materialFor = (tone: Tone) => {
    let material = materials.get(tone);
    if (!material) {
      material = new MeshLambertMaterial();
      materials.set(tone, material);
    }
    return material;
  };

  const drifters: Drifter[] = [];
  const addDrifter = (object: Object3D) => {
    const spin = new Vector3(random(-1, 1), random(-1, 1), random(-1, 1))
      .normalize()
      .multiplyScalar(random(0.15, 0.45));
    object.rotation.set(random(0, Math.PI * 2), random(0, Math.PI * 2), random(0, Math.PI * 2));
    scene.add(object);
    drifters.push({ object, spin });
  };

  for (let i = 0; i < COPIES.react; i++) addDrifter(reactAtom(materialFor('--accent')));
  // 形を作るのは選んだものだけ
  for (const logo of pick(LOGOS, KINDS_PER_VISIT)) {
    const geometry = logoGeometry(logo.path);
    for (let i = 0; i < COPIES.other; i++) addDrifter(new Mesh(geometry, materialFor(logo.tone)));
  }

  // 星。奥行きいっぱいに散らし、ロゴと同じ速さで流す
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPositions[i * 3] = random(-60, 60);
    starPositions[i * 3 + 1] = random(-40, 40);
    starPositions[i * 3 + 2] = random(-DEPTH, 0);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
  const starMaterial = new PointsMaterial({
    size: 0.14,
    map: dotTexture(),
    transparent: true,
    depthWrite: false,
  });
  scene.add(new Points(starGeometry, starMaterial));

  /** 奥（z）に置き直す。x・y は画面に収まる範囲で、真ん中の筒だけ避ける */
  const place = (object: Object3D, z: number) => {
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * DEPTH * SPREAD;
    const halfWidth = halfHeight * camera.aspect;
    let x = 0;
    let y = 0;
    // 縦長の画面でも抜けられるよう、試す回数に上限を付けておく
    for (let tries = 0; tries < 20; tries++) {
      x = random(-halfWidth, halfWidth);
      y = random(-halfHeight, halfHeight);
      if (Math.hypot(x, y) >= CLEAR_RADIUS) break;
    }
    object.position.set(x, y, z);
  };

  const paint = () => {
    const bg = token('--bg');
    renderer.setClearColor(bg);
    (scene.fog as Fog).color.copy(bg);
    for (const [tone, material] of materials) material.color.copy(token(tone));
    starMaterial.color.copy(token('--fg-dim'));
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  // ポインタの位置に合わせて、視点を少しだけずらす（奥行きが分かるように）
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  });

  /**
   * 動きを減らす設定のときの置き方。流れてこないので、最初に置いた場所がずっと見える。
   * 奥行きごとに、その深さで画面に収まる範囲へ置く（真ん中は空ける）。
   */
  const placeInView = (object: Object3D) => {
    const z = random(-DEPTH * 0.7, -12);
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * -z * 0.9;
    const halfWidth = halfHeight * camera.aspect;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 20; tries++) {
      x = random(-1, 1);
      y = random(-1, 1);
      if (Math.hypot(x, y) >= 0.55) break;
    }
    object.position.set(x * halfWidth, y * halfHeight, z);
  };

  const step = (dt: number) => {
    const flowing = !reducedMotion.matches;

    for (const { object, spin } of drifters) {
      object.rotation.x += spin.x * dt;
      object.rotation.y += spin.y * dt;
      object.rotation.z += spin.z * dt;
      if (!flowing) continue;
      object.position.z += SPEED * dt;
      if (object.position.z > -2) place(object, -DEPTH);
    }

    if (flowing) {
      for (let i = 2; i < starPositions.length; i += 3) {
        starPositions[i] += SPEED * dt;
        if (starPositions[i] > -2) starPositions[i] -= DEPTH;
      }
      starGeometry.attributes.position.needsUpdate = true;
    }

    const ease = Math.min(1, dt * 2);
    const target = flowing ? pointer : { x: 0, y: 0 };
    camera.position.x += (target.x * 1.5 - camera.position.x) * ease;
    camera.position.y += (-target.y * 1 - camera.position.y) * ease;
    camera.lookAt(0, 0, -DEPTH / 2);
  };

  const render = () => renderer.render(scene, camera);

  let frame = 0;
  let last = 0;
  const loop = (now: number) => {
    // タブを離れていたあいだの時間は飛ばす
    const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    step(dt);
    render();
    frame = requestAnimationFrame(loop);
  };

  const sync = () => {
    const active = root.dataset.mode === 'hero';
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (active) frame = requestAnimationFrame(loop);
  };

  resize();
  paint();
  for (const { object } of drifters) {
    if (reducedMotion.matches) placeInView(object);
    else place(object, random(-DEPTH, -4));
  }

  new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === 'data-theme')) paint();
    if (records.some((record) => record.attributeName === 'data-mode')) sync();
  }).observe(root, { attributes: true, attributeFilter: ['data-mode', 'data-theme'] });

  window.addEventListener('resize', resize);

  sync();
  canvas.dataset.ready = '';
}
