import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TRACK} from './track.js';
import {CARS,LAPS} from './config.js';
const C=TRACK.pts.map(p=>({x:p[0],z:p[1]}));if(TRACK.reverse)C.reverse();
const K=C.length,HW=TRACK.half,Y=TRACK.y,loader=new GLTFLoader(),cache={};
let roadScene=null,R=null;
export const trackPoints=C;
export function preload(onProg){
  if(roadScene)return Promise.resolve();
  return new Promise(res=>loader.load(TRACK.file,g=>{roadScene=g.scene;res()},e=>e.total&&onProg&&onProg(e.loaded/e.total),()=>res()));
}
function placeholder(def){
  const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:def.color,metalness:.6,roughness:.3});
  const b=new THREE.Mesh(new THREE.BoxGeometry(1.9,.5,4.4),m);b.position.y=.55;g.add(b);
  const c=new THREE.Mesh(new THREE.BoxGeometry(1.5,.45,2),new THREE.MeshStandardMaterial({color:0x111418,metalness:.8,roughness:.1}));c.position.set(0,1,-.2);g.add(c);
  const wm=new THREE.MeshStandardMaterial({color:0x111});
  [[-1,1.4],[1,1.4],[-1,-1.4],[1,-1.4]].forEach(([x,z])=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.35,16),wm);w.rotation.z=Math.PI/2;w.position.set(x,.42,z);g.add(w)});
  return g;
}
function loadCar(def){
  return new Promise(res=>{
    const done=obj=>{
      const box=new THREE.Box3().setFromObject(obj),s=box.getSize(new THREE.Vector3()),ctr=box.getCenter(new THREE.Vector3());
      const k=4.6/Math.max(s.x,s.z);obj.scale.multiplyScalar(k);
      const wrap=new THREE.Group();obj.position.set(-ctr.x*k,-box.min.y*k,-ctr.z*k);wrap.add(obj);
      const out=new THREE.Group();out.add(wrap);if(def.flip)wrap.rotation.y=Math.PI;
      const sh=new THREE.Mesh(new THREE.CircleGeometry(2.6,24),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.35,depthWrite:false}));
      sh.rotation.x=-Math.PI/2;sh.position.y=.06;sh.scale.set(.75,1.15,1);out.add(sh);
      out.userData.body=wrap;res(out);
    };
    if(cache[def.file])return done(cache[def.file].clone(true));
    loader.load(def.file,g=>{cache[def.file]=g.scene;done(g.scene.clone(true))},undefined,()=>done(placeholder(def)));
  });
}
const KEYS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake',ShiftLeft:'nitro',ShiftRight:'nitro',Space:'nitro'};
const IN={left:0,right:0,gas:0,brake:0,nitro:0};
const kd=e=>{if(KEYS[e.code]){IN[KEYS[e.code]]=1;e.preventDefault()}},ku=e=>{if(KEYS[e.code])IN[KEYS[e.code]]=0};
const $=s=>document.querySelector(s),fmt=t=>{const m=Math.floor(t/60),s=(t%60).toFixed(2).padStart(5,'0');return m+':'+s};
const angd=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};

export async function startRace(o){
  stopRace();
  const W=1280,H=720,renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2,(devicePixelRatio||1)*(o.scale||1)));renderer.setSize(W,H);renderer.outputColorSpace=THREE.SRGBColorSpace;
  o.container.innerHTML='';o.container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0a868);scene.fog=new THREE.Fog(0xf0b27c,260,1500);
  scene.add(new THREE.HemisphereLight(0xfff1d6,0x7a4a2a,1.15));
  const sun=new THREE.DirectionalLight(0xffe2b0,2.2);sun.position.set(300,500,200);scene.add(sun);
  if(roadScene)scene.add(roadScene);else{const g=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshStandardMaterial({color:0x9a6a40}));g.rotation.x=-Math.PI/2;g.position.set(1100,Y-.2,0);scene.add(g)}
  const cam=new THREE.PerspectiveCamera(62,W/H,.5,6000);
  // racers
  const names=['Rohit','Aman','Kabir','Zoya','Veer'],racers=[];
  for(let i=0;i<6;i++){
    const isP=i===3,ci=isP?o.carIdx:(i+(i>3?-1:0)+1+o.carIdx)%CARS.length,def=CARS[ci];
    const mesh=await loadCar(def);scene.add(mesh);
    const row=Math.floor(i/2),side=i%2?1:-1,idx=(K-2-row+K)%K,n=(idx+1)%K;
    const a=Math.atan2(C[n].x-C[idx].x,C[n].z-C[idx].z),lat=side*4.5;
    racers.push({def,name:isP?o.name:names[(i>3?i-1:i)],isP,mesh,x:C[idx].x+Math.cos(a)*lat,z:C[idx].z-Math.sin(a)*lat,a,v:0,idx,prev:idx,lap:0,nitro:100,skill:.86+Math.random()*.12,fin:false,time:0,prog:0,lat});
  }
  const P=racers.find(r=>r.isP);
  R={renderer,raf:0,scene,off:()=>{removeEventListener('keydown',kd);removeEventListener('keyup',ku)},o};
  addEventListener('keydown',kd);addEventListener('keyup',ku);
  document.querySelectorAll('.tbtn').forEach(b=>{const k=b.dataset.k;const on=e=>{IN[k]=1;e.preventDefault()},off=()=>IN[k]=0;b.onpointerdown=on;b.onpointerup=off;b.onpointerleave=off;b.onpointercancel=off});
  // minimap
  const mm=$('#mini'),mx=mm.getContext('2d');let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;C.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z)});
  const ms=Math.min((mm.width-16)/(x1-x0),(mm.height-16)/(z1-z0)),mp=(x,z)=>[8+(x-x0)*ms,8+(z1-z)*ms];
  // state
  let t0=0,state='count',cd=3.99,raceT=0,last=performance.now(),finishedAt=0;
  const cdEl=$('#countdown');
  function nearest(r){let b=r.idx,bd=1e12;for(let j=-14;j<=14;j++){const i=(r.idx+j+K)%K,dx=r.x-C[i].x,dz=r.z-C[i].z,d=dx*dx+dz*dz;if(d<bd){bd=d;b=i}}return [b,Math.sqrt(bd)]}
  function step(r,dt,inp){
    const d=r.def,off=r.off;
    let top=d.top*(off?.55:1)*(r.isP?1:r.skill);
    if(inp.nitro&&r.nitro>0&&state==='race'){top*=1.32;r.v+=d.acc*1.5*dt;r.nitro-=28*dt;r.boost=1}else{r.nitro=Math.min(100,r.nitro+5*dt);r.boost=0}
    if(inp.gas)r.v+=d.acc*Math.max(0,1-r.v/top)*dt;else r.v-=6*dt;
    if(r.v>top)r.v-=18*dt;if(inp.brake)r.v-=48*dt;r.v=Math.max(0,r.v);
    const s=(inp.right-inp.left);r.steer=s;
    r.a-=s*dt*1.9*d.hand*(r.v/(r.v+14));r.v-=Math.abs(s)*r.v*.12*dt;
    r.x+=Math.sin(r.a)*r.v*dt;r.z+=Math.cos(r.a)*r.v*dt;
  }
  function track(r,dt){
    const [i,dist]=nearest(r);
    if(r.prev>K*.8&&i<K*.2){r.lap++;if(r.isP)lapFlash()}else if(r.prev<K*.2&&i>K*.8)r.lap--;
    r.prev=r.idx=i;r.off=dist>HW;
    if(dist>HW+6){const k=(dist-HW-6)/dist;r.x-=(r.x-C[i].x)*k;r.z-=(r.z-C[i].z)*k;r.v*=1-2.2*dt}
    const n=C[(i+1)%K],sx=n.x-C[i].x,sz=n.z-C[i].z,t=Math.max(0,Math.min(1,((r.x-C[i].x)*sx+(r.z-C[i].z)*sz)/(sx*sx+sz*sz)));
    r.prog=r.lap*K+i+t;
  }
  function ai(r,dt){
    const look=4+Math.floor(r.v/9),T=C[(r.idx+look)%K],want=Math.atan2(T.x-r.x,T.z-r.z),df=angd(r.a,want);
    const a1=C[(r.idx+2)%K],a2=C[(r.idx+12)%K],a0=C[r.idx],c1=Math.atan2(a1.x-a0.x,a1.z-a0.z),c2=Math.atan2(a2.x-a1.x,a2.z-a1.z),curv=Math.min(1,Math.abs(angd(c1,c2))*1.6);
    const tgt=r.def.top*r.skill*(1-curv*.42)*(P.prog>r.prog+25?1.07:1);
    const s=Math.max(-1,Math.min(1,-df*2.4));
    return {left:s<0?-s:0,right:s>0?s:0,gas:r.v<tgt?1:0,brake:r.v>tgt+10?1:0,nitro:curv<.1&&r.nitro>60?1:0};
  }
  function lapFlash(){const e=$('#lapFlash');if(P.lap>=1&&P.lap<=LAPS){e.textContent='LAP '+P.lap+' / '+LAPS;e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}}
  function loop(now){
    R.raf=requestAnimationFrame(loop);
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(state==='count'){cd-=dt;const n=Math.ceil(cd);cdEl.textContent=n>0?n:'GO!';cdEl.classList.toggle('go',n<=0);if(cd<=-.8){cdEl.textContent='';state='race'}if(cd<=0&&state==='count')state='race'}
    if(state==='race'||state==='done')raceT+=dt;
    racers.forEach(r=>{
      const inp=r.isP?{left:IN.left,right:IN.right,gas:IN.gas||(o.autoGas?1:0),brake:IN.brake,nitro:IN.nitro}:ai(r,dt);
      if(state==='count'){inp.gas=0;inp.nitro=0}
      if(r.fin){inp.gas=r.isP?0:1;if(r.isP){inp.brake=0}}
      step(r,dt,inp);track(r,dt);
      if(!r.fin&&r.lap>LAPS){r.fin=true;r.time=raceT;if(r.isP){state='done';finishedAt=raceT}}
      r.mesh.position.set(r.x,Y+.05,r.z);r.mesh.rotation.y=r.a;
      if(r.mesh.userData.body)r.mesh.userData.body.rotation.z=-(r.steer||0)*r.v*.0016;
    });
    // camera
    const sp=P.v,bx=-Math.sin(P.a)*(8.5+sp*.02),bz=-Math.cos(P.a)*(8.5+sp*.02);
    cam.position.lerp(new THREE.Vector3(P.x+bx,Y+3.6+sp*.01,P.z+bz),1-Math.pow(.0008,dt));
    cam.lookAt(P.x+Math.sin(P.a)*10,Y+1.4,P.z+Math.cos(P.a)*10);
    cam.fov+=((60+sp*.28+(P.boost?10:0))-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();
    // HUD
    const order=[...racers].sort((a,b)=>b.prog-a.prog),pos=order.indexOf(P)+1;
    $('#hSpeed').textContent=Math.round(P.v*3.6);$('#hPos').innerHTML=pos+'<small>/'+racers.length+'</small>';
    $('#hLap').textContent=Math.min(Math.max(P.lap,1),LAPS)+'/'+LAPS;$('#hTime').textContent=fmt(raceT);
    $('#hNitro').style.width=P.nitro+'%';$('#hNitro').classList.toggle('on',!!P.boost);
    $('#hBoostFx').style.opacity=P.boost?1:0;
    mx.clearRect(0,0,mm.width,mm.height);mx.lineWidth=7;mx.strokeStyle='rgba(255,255,255,.25)';mx.lineJoin='round';mx.beginPath();C.forEach((p,i)=>{const [a,b]=mp(p.x,p.z);i?mx.lineTo(a,b):mx.moveTo(a,b)});mx.closePath();mx.stroke();
    racers.forEach(r=>{const [a,b]=mp(r.x,r.z);mx.fillStyle=r.isP?'#ffc83d':'#27e1ff';mx.beginPath();mx.arc(a,b,r.isP?5:3.2,0,7);mx.fill()});
    if(state==='done'&&raceT-finishedAt>2.2){
      const res=[...racers].sort((a,b)=>(b.fin-a.fin)||(a.fin&&b.fin?a.time-b.time:b.prog-a.prog)).map((r,i)=>({pos:i+1,name:r.name,car:r.def.name,time:r.fin?fmt(r.time):'DNF',isP:r.isP}));
      stopRace();o.onFinish(res);return;
    }
    renderer.render(scene,cam);
  }
  R.raf=requestAnimationFrame(loop);
}
export function stopRace(){
  if(!R)return;cancelAnimationFrame(R.raf);R.off();Object.keys(IN).forEach(k=>IN[k]=0);
  R.scene.traverse(o=>{if(o.isMesh&&o.parent&&!roadScene?.getObjectById(o.id)){o.geometry?.dispose?.()}});
  if(roadScene)R.scene.remove(roadScene);R.renderer.dispose();R=null;
}
