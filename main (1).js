import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CARS, CAR_LENGTH, SLOT_X } from './config.js';

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({canvas:document.getElementById('gl'),antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(32,16/9,.1,100);
const CAM = { lobby:{p:new THREE.Vector3(0,3.2,13),t:new THREE.Vector3(0,.9,0)},
              garage:{p:new THREE.Vector3(-1,1.9,8.2),t:new THREE.Vector3(0,.8,0)} };
const camPos = CAM.lobby.p.clone(), camTar = CAM.lobby.t.clone();

scene.add(new THREE.HemisphereLight(0xbcd4ff,0x141821,1.1));
const key = new THREE.DirectionalLight(0xffffff,2.2); key.position.set(4,8,6); scene.add(key);
const rim = new THREE.DirectionalLight(0xe8b04a,1.6); rim.position.set(-6,3,-5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(30,64),new THREE.MeshStandardMaterial({color:0x10141c,roughness:.85}));
floor.rotation.x=-Math.PI/2; scene.add(floor);

const slots = SLOT_X.map(x=>{
  const g=new THREE.Group(); scene.add(g);
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2,.12,48),new THREE.MeshStandardMaterial({color:0x1b212d,metalness:.7,roughness:.35}));
  disc.position.y=.06; g.add(disc);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.9,.035,8,64),new THREE.MeshBasicMaterial({color:0x2c3442}));
  ring.rotation.x=Math.PI/2; ring.position.y=.13; g.add(ring);
  const car=new THREE.Group(); car.position.y=.12; g.add(car);
  return {g,car,ring,baseX:x,x,s:1,vis:true,carIdx:0};
});

function placeholder(color){
  const g=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.28});
  const body=new THREE.Mesh(new THREE.BoxGeometry(3.2,.5,1.5),paint); body.position.y=.5; g.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.5,.45,1.2),new THREE.MeshStandardMaterial({color:0x0c1017,metalness:.8,roughness:.1}));
  cab.position.set(-.2,.97,0); g.add(cab);
  const wg=new THREE.CylinderGeometry(.33,.33,.3,20), wm=new THREE.MeshStandardMaterial({color:0x08090b});
  [[-1,.35,.8],[-1,.35,-.8],[1,.35,.8],[1,.35,-.8]].forEach(p=>{const w=new THREE.Mesh(wg,wm);w.rotation.x=Math.PI/2;w.position.set(...p);g.add(w);});
  return g;
}
function fit(model){
  const box=new THREE.Box3().setFromObject(model), size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  const s=CAR_LENGTH/Math.max(size.x,size.z);
  model.scale.multiplyScalar(s); model.position.set(-c.x*s,-box.min.y*s,-c.z*s);
  const w=new THREE.Group(); w.add(model); return w;
}
const lib = CARS.map(c=>({obj:placeholder(c.color)}));
const loader = new GLTFLoader();
const loaded = CARS.map(()=>false);
CARS.forEach((c,i)=>loader.load(c.file,gl=>{lib[i].obj=fit(gl.scene);loaded[i]=true;refresh();},undefined,()=>{}));
let frameHook=()=>{};
export function setFrameHook(f){frameHook=f;}
export function carForRace(i){return {obj:lib[i].obj.clone(true),loaded:loaded[i]};}

let players=[], mode='lobby', garageIdx=0;
function refresh(){
  floor.visible = mode!=='race';
  if(mode==='race'){scene.background=new THREE.Color(0x0a0c11);scene.fog=new THREE.Fog(0x0a0c11,80,380);}else{scene.background=null;scene.fog=null;}
  slots.forEach((s,i)=>{
    const idx = mode==='garage' ? garageIdx : (players[i]?players[i].car:0);
    s.car.clear(); s.car.add(lib[idx].obj.clone(true));
    s.carIdx=idx;
    s.ring.material.color.set(players[i]&&players[i].ready?0x7fe3ff:0x2c3442);
    s.vis = mode==='lobby' ? !!players[i] : (mode==='garage' && i===0);
    s.x = mode==='garage' && i===0 ? 2.6 : s.baseX;
    s.s = mode==='garage' && i===0 ? 1.45 : 1;
  });
  const cam = mode==='garage'?CAM.garage:CAM.lobby; camTarget=cam;
}
let camTarget=CAM.lobby;

export function setPlayers(p){players=p;refresh();}
export function setMode(m){mode=m;refresh();}
export function setGarageCar(i){garageIdx=i;refresh();}
export function slotScreen(i){const v=new THREE.Vector3(SLOT_X[i],-.1,1.6).project(camera);return {x:(v.x+1)/2*100,y:(1-v.y)/2*100};}

export let onResize=()=>{};
export function setOnResize(f){onResize=f;}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();onResize();}
addEventListener('resize',resize); resize();

const clock=new THREE.Clock(); let last=0;
renderer.setAnimationLoop(()=>{
  const t=clock.getElapsedTime(), dt=Math.min(t-last,.05); last=t;
  if(mode==='race'){frameHook(dt,t);renderer.render(scene,camera);return;}
  camPos.lerp(camTarget.p,.06); camTar.lerp(camTarget.t,.06);
  camera.position.copy(camPos); camera.lookAt(camTar);
  slots.forEach((s,i)=>{
    s.g.visible=s.vis;
    s.g.position.x+=(s.x-s.g.position.x)*.08;
    const sc=s.g.scale.x+(s.s-s.g.scale.x)*.08; s.g.scale.setScalar(sc);
    s.car.rotation.y = mode==='garage' ? t*.5 : -.5+Math.sin(t*.6+i)*.25;
  });
  renderer.render(scene,camera);
});
