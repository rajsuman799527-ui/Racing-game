import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera, carForRace, setFrameHook } from './main.js';
import { CARS, TRACKS, CAR_MODEL_YAW } from './config.js';

const T = TRACKS[0];
const S = T.scale, TILE = T.tileLength * S;
const FINISH = T.tiles * TILE - TILE * 0.5;
const HALF = T.halfWidth * S - 1.0;            // drivable half-width (keeps car body on asphalt)
const KMH = 5;                                  // display factor: units/s -> km/h

let cache = null, root = null, tiles = [], racers = [], state = 'idle', elapsed = 0, endTimer = 0, finCount = 0, cb = {};
const keys = { l:0, r:0, b:0, n:0 };

function loadTrack(){
  cache ||= new Promise(res => new GLTFLoader().load(T.file, g => res(g.scene), undefined, () => res(null)));
  return cache;
}
function fallbackTile(){                        // plain road, used when the glb is missing
  const g = new THREE.Group(), cx = T.startX + T.tileLength / 2;
  const road = new THREE.Mesh(new THREE.BoxGeometry(T.tileLength, .1, T.halfWidth * 2), new THREE.MeshStandardMaterial({ color:0x20242c }));
  road.position.set(cx, 0, 0); g.add(road);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(T.tileLength * .4, .12, .08), new THREE.MeshBasicMaterial({ color:0xe8b04a }));
  dash.position.set(cx, .02, 0); g.add(dash);
  return g;
}
function finishGate(){
  const g = new THREE.Group(), w = T.halfWidth * 2 * S;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, .06, w), new THREE.MeshBasicMaterial({ color:0xffffff }));
  bar.position.y = .1; g.add(bar);
  const post = new THREE.BoxGeometry(.5, 9, .5), pm = new THREE.MeshBasicMaterial({ color:0xe8b04a });
  [-1, 1].forEach(s => { const p = new THREE.Mesh(post, pm); p.position.set(0, 4.5, s * w / 2); g.add(p); });
  const top = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.2, w), pm); top.position.y = 9; g.add(top);
  g.position.x = FINISH; return g;
}

export async function prepare(players, me, callbacks){
  stop(); cb = callbacks;
  const model = (await loadTrack()) || fallbackTile();
  root = new THREE.Group(); tiles = [];
  for (let i = 0; i < T.tiles; i++){
    const tile = new THREE.Group(); tile.add(model.clone(true));
    tile.scale.setScalar(S); tile.position.x = (i * T.tileLength - T.startX) * S;
    root.add(tile); tiles.push(tile);
  }
  root.add(finishGate()); scene.add(root);

  racers = players.map((p, i) => {
    const { obj, loaded } = carForRace(p.car);
    const inner = new THREE.Group(); inner.add(obj); if (loaded) inner.rotation.y = CAR_MODEL_YAW;
    const wrap = new THREE.Group(); wrap.add(inner); scene.add(wrap);
    const st = CARS[p.car].stats, z = i % 2 ? 1.6 : -1.6;
    return { p, wrap, human:p === me, x:14 - Math.floor(i / 2) * 6, z, v:0, h:0, nitro:100, fin:null, rank:0,
      max:30 + st.speed * .28, acc:14 + st.accel * .2, steer:.8 + st.handling * .012,
      laneT:z, aiT:0, cruise:.9, bt:0 };
  });
  elapsed = 0; endTimer = 0; finCount = 0; state = 'ready';
  camera.fov = 55; camera.updateProjectionMatrix();
  const h = racers.find(r => r.human); camera.position.set(h.x - 9, 4.2, h.z * .6);
  setFrameHook(update);
}
export function go(){ if (state === 'ready') state = 'go'; }

export function stop(){
  state = 'idle'; setFrameHook(() => {});
  if (root) { scene.remove(root); root = null; }
  racers.forEach(r => scene.remove(r.wrap)); racers = []; tiles = [];
  camera.fov = 32; camera.updateProjectionMatrix();
}

export function snapshot(){
  return racers.map(r => ({ p:r.p, done:r.fin !== null,
    time: r.fin ?? elapsed + (FINISH - r.x) / Math.max(r.v, 12) }))
    .sort((a, b) => a.time - b.time);
}

function update(dt){
  const running = state === 'go';
  if (running) elapsed += dt;
  racers.forEach(r => {
    let steerIn = 0, brake = 0, boost = false;
    if (running && r.fin === null){
      if (r.human){ steerIn = keys.r - keys.l; brake = keys.b; boost = !!keys.n && r.nitro > 0; }
      else {
        r.aiT -= dt;
        if (r.aiT <= 0){ r.aiT = 1.5 + Math.random() * 2.5; r.laneT = (Math.random() * 2 - 1) * (HALF - .8); r.cruise = .86 + Math.random() * .12; }
        steerIn = THREE.MathUtils.clamp((r.laneT - r.z) * .5, -1, 1);
        r.bt -= dt; if (r.bt <= 0 && r.nitro > 40 && Math.random() < dt * .15) r.bt = 1.2;
        boost = r.bt > 0 && r.nitro > 0;
      }
    }
    const canDrive = running && r.fin === null;
    const maxV = r.max * (r.human ? 1 : r.cruise) * (boost ? 1.3 : 1);
    const target = canDrive && !brake ? maxV : 0;
    const rate = brake ? 40 : target > r.v ? r.acc * (boost ? 2 : 1) : (canDrive ? 10 : 8);
    r.v += THREE.MathUtils.clamp(target - r.v, -rate * dt, rate * dt);
    r.nitro = boost ? Math.max(0, r.nitro - 35 * dt) : Math.min(100, r.nitro + 8 * dt);

    const grip = 1 - Math.min(r.v / (r.max * 1.4), .5);
    r.h += (steerIn * .45 * grip - r.h) * Math.min(1, dt * r.steer * 3);
    r.x += Math.cos(r.h) * r.v * dt; r.z += Math.sin(r.h) * r.v * dt;
    if (Math.abs(r.z) > HALF){ const s = Math.sign(r.z); r.z = s * HALF; if (Math.sign(r.h) === s) r.h *= .3; r.v *= 1 - dt * 1.5; }

    if (r.fin === null && r.x >= FINISH){ r.fin = elapsed; r.rank = ++finCount; if (r.human) endTimer = 2.5; }
    r.wrap.position.set(r.x, 0, r.z); r.wrap.rotation.y = -r.h;
  });
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++){
    const a = racers[i], b = racers[j], dx = a.x - b.x, dz = a.z - b.z;
    if (Math.abs(dx) < 3.2 && Math.abs(dz) < 1.5){
      const push = (1.5 - Math.abs(dz)) * .5 * (dz >= 0 ? 1 : -1);
      a.z += push; b.z -= push; (dx > 0 ? b : a).v *= .995;
    }
  }
  const me = racers.find(r => r.human); if (!me) return;
  const k = me.v / me.max;
  camera.position.lerp(new THREE.Vector3(me.x - 9 - k * 3, 4 + k * 1.2, me.z * .6), Math.min(1, dt * 5));
  camera.lookAt(me.x + 12, 1.2, me.z);
  camera.fov += ((55 + k * 14 + (keys.n && me.nitro > 0 ? 6 : 0)) - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  tiles.forEach(t => { t.visible = Math.abs(t.position.x + TILE / 2 - me.x) < 520; });

  const order = [...racers].sort((a, b) => (a.fin !== null && b.fin !== null) ? a.fin - b.fin : (a.fin !== null ? -1 : b.fin !== null ? 1 : b.x - a.x));
  cb.onHud?.({ speed:Math.round(me.v * KMH), pos:order.indexOf(me) + 1, nitro:me.nitro,
    dist:Math.max(0, Math.min(FINISH, me.x)) | 0, total:FINISH | 0, dots:racers.map(r => [Math.min(1, r.x / FINISH), r.human]) });
  if (endTimer > 0 && (endTimer -= dt) <= 0){ endTimer = 0; cb.onFinish?.(snapshot()); }
}

/* ---------- controls: keyboard + touch buttons ---------- */
const keyMap = { ArrowLeft:'l', a:'l', ArrowRight:'r', d:'r', ArrowDown:'b', s:'b', ' ':'n', Shift:'n' };
addEventListener('keydown', e => { const k = keyMap[e.key]; if (k){ keys[k] = 1; e.preventDefault(); } });
addEventListener('keyup',   e => { const k = keyMap[e.key]; if (k) keys[k] = 0; });
document.querySelectorAll('#s-hud [data-k]').forEach(b => {
  const on = v => e => { keys[b.dataset.k] = v; b.classList.toggle('down', !!v); e.preventDefault(); };
  b.addEventListener('pointerdown', on(1)); ['pointerup','pointerleave','pointercancel'].forEach(t => b.addEventListener(t, on(0)));
  b.addEventListener('contextmenu', e => e.preventDefault());
});
