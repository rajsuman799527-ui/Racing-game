import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CARS} from './config.js';
const W=1280,H=720,loader=new GLTFLoader(),cache={};
// Nightclub stage ka platform (Dance_stage) is center pe hai; scale badha/ghata ke size set karo.
export const STAGE={file:'assets/stage/nightclub_stage.glb',scale:.07,center:[191,-58.4,-17],carY:.05};
// Lobby camera presets [camX,camY,camZ, lookX,lookY,lookZ]. Agar stage ulta dikhe to keys 1-4 dabake dekho.
const CAMS=[[0,6.5,23,0,1.6,0],[0,6.5,-23,0,1.6,0],[23,6.5,0,0,1.6,0],[-23,6.5,0,0,1.6,0]];
const SLOTS=[[0,4],[-7,4],[7,4],[0,-4],[-7,-4],[7,-4]];
const home=new THREE.Group(),lobby=new THREE.Group(),lights=[],racers=new Map(),v3=new THREE.Vector3();
let renderer,scene,cam,mode='off',raf=0,last=0,tagsEl,camI=0,spin=0,dragX=null,showTok=0,turn,stageP=null,progCb=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function placeholder(def){
  const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:def.color,metalness:.6,roughness:.3});
  const b=new THREE.Mesh(new THREE.BoxGeometry(1.9,.5,4.4),m);b.position.y=.55;g.add(b);
  const c=new THREE.Mesh(new THREE.BoxGeometry(1.5,.45,2),new THREE.MeshStandardMaterial({color:0x111418,metalness:.8,roughness:.1}));c.position.set(0,1,-.2);g.add(c);
  const wm=new THREE.MeshStandardMaterial({color:0x111});
  [[-1,1.4],[1,1.4],[-1,-1.4],[1,-1.4]].forEach(([x,z])=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.35,16),wm);w.rotation.z=Math.PI/2;w.position.set(x,.42,z);g.add(w)});
  return g;
}
function fit(obj,def){
  const box=new THREE.Box3().setFromObject(obj),s=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3()),k=4.6/Math.max(s.x,s.z);
  obj.scale.multiplyScalar(k);obj.position.set(-c.x*k,-box.min.y*k,-c.z*k);
  const wrap=new THREE.Group();wrap.add(obj);if(def.flip)wrap.rotation.y=Math.PI;
  const out=new THREE.Group();out.add(wrap);
  const sh=new THREE.Mesh(new THREE.CircleGeometry(2.6,24),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.4,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.y=.04;sh.scale.set(.75,1.15,1);out.add(sh);return out;
}
function carObj(def){return new Promise(res=>{
  const done=o=>res(fit(o,def));
  if(cache[def.file])return done(cache[def.file].clone(true));
  loader.load(def.file,g=>{cache[def.file]=g.scene;done(g.scene.clone(true))},undefined,()=>done(placeholder(def)));
})}

function buildHome(){
  home.add(new THREE.HemisphereLight(0x8fa8ff,0x0a0a12,.7));
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(6,9,7);home.add(key);
  const r1=new THREE.PointLight(0x27e1ff,260,0,2);r1.position.set(-8,3,-6);home.add(r1);
  const r2=new THREE.PointLight(0xffc83d,220,0,2);r2.position.set(8,2.5,-5);home.add(r2);
  const plat=new THREE.Mesh(new THREE.CylinderGeometry(5.2,5.6,.5,64),new THREE.MeshStandardMaterial({color:0x14161f,metalness:.9,roughness:.25}));plat.position.y=-.25;home.add(plat);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(5.3,.07,12,96),new THREE.MeshBasicMaterial({color:0xffc83d}));ring.rotation.x=Math.PI/2;home.add(ring);
  const fl=new THREE.Mesh(new THREE.CircleGeometry(60,48),new THREE.MeshStandardMaterial({color:0x090a10,metalness:.8,roughness:.5}));fl.rotation.x=-Math.PI/2;fl.position.y=-.55;home.add(fl);
  turn=new THREE.Group();home.add(turn);
}
function buildLobby(){
  if(stageP)return stageP;
  lobby.add(new THREE.HemisphereLight(0x7a6bff,0x120818,.9));
  const d=new THREE.DirectionalLight(0xffffff,1.1);d.position.set(5,14,16);lobby.add(d);
  [0xff2d8a,0x27e1ff,0xffc83d,0xa55bff].forEach(c=>{const l=new THREE.PointLight(c,500,0,2);lobby.add(l);lights.push(l)});
  return stageP=new Promise(res=>loader.load(STAGE.file,g=>{
    const s=g.scene,k=STAGE.scale,[cx,cy,cz]=STAGE.center;s.scale.setScalar(k);s.position.set(-cx*k,-cy*k,-cz*k);lobby.add(s);res();
  },e=>e.total&&progCb&&progCb(e.loaded/e.total),()=>res()));
}
export function init(canvas,tags){
  tagsEl=tags;renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.setSize(W,H,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x07080d);cam=new THREE.PerspectiveCamera(40,W/H,.1,500);
  scene.add(home,lobby);buildHome();
  canvas.addEventListener('pointerdown',e=>dragX=e.clientX);
  addEventListener('pointermove',e=>{if(dragX!=null&&mode==='home'){spin+=(e.clientX-dragX)*.012;dragX=e.clientX}});
  addEventListener('pointerup',()=>dragX=null);
  addEventListener('keydown',e=>{if(mode==='lobby'&&/^[1-4]$/.test(e.key))camI=+e.key-1});
}
export function preload(cb){progCb=cb;return Promise.all([buildLobby(),showCar(0)])}
export function setMode(m){
  mode=m;home.visible=m==='home';lobby.visible=m==='lobby';tagsEl.style.display=m==='lobby'?'block':'none';
  if(m==='off'){cancelAnimationFrame(raf);raf=0}else if(!raf){last=performance.now();raf=requestAnimationFrame(tick)}
  if(m==='lobby')buildLobby();
}
export async function showCar(i){const tok=++showTok,o=await carObj(CARS[i]);if(tok!==showTok)return;turn.clear();turn.add(o)}
export function setLobby(players){
  const ids=new Set(players.map(p=>p.uid));
  for(const [u,r] of racers)if(!ids.has(u)){lobby.remove(r.g);r.tag.remove();racers.delete(u)}
  players.forEach((p,i)=>{
    let r=racers.get(p.uid);
    if(!r){r={g:new THREE.Group(),car:-1,tag:document.createElement('div')};tagsEl.appendChild(r.tag);lobby.add(r.g);racers.set(p.uid,r)}
    const [x,z]=SLOTS[i%SLOTS.length];r.g.position.set(x,STAGE.carY,z);r.g.rotation.y=-x*.03;
    r.tag.className='tag'+(p.ready||p.host?' ok':'');r.tag.innerHTML=`<b>${esc(p.name)}</b><i>${p.host?'HOST':p.ready?'READY':'WAITING'}</i>`;
    if(r.car!==p.car){r.car=p.car;const want=p.car;carObj(CARS[want]||CARS[0]).then(o=>{if(r.car===want&&racers.get(p.uid)===r){r.g.clear();r.g.add(o)}})}
  });
}
export function clearLobby(){for(const [,r] of racers){lobby.remove(r.g);r.tag.remove()}racers.clear()}
function tick(now){
  raf=requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;const t=now/1000;
  if(mode==='home'){
    if(dragX==null)spin+=dt*.45;turn.rotation.y=spin;const a=Math.sin(t*.3)*.25;
    cam.position.set(Math.sin(a)*9.5,2.9,Math.cos(a)*9.5);cam.lookAt(0,1,0);
  }else{
    const c=CAMS[camI];cam.position.lerp(v3.set(c[0]+Math.sin(t*.25)*1.5,c[1],c[2]),.05);cam.lookAt(c[3],c[4],c[5]);
    lights.forEach((l,i)=>l.position.set(Math.cos(t*.7+i*1.6)*12,7+Math.sin(t+i)*1.5,Math.sin(t*.7+i*1.6)*9+2));
    racers.forEach(r=>{v3.set(r.g.position.x,r.g.position.y+2.8,r.g.position.z).project(cam);r.tag.style.transform=`translate(${(v3.x*.5+.5)*W}px,${(-v3.y*.5+.5)*H}px) translate(-50%,-100%)`});
  }
  renderer.render(scene,cam);
}
