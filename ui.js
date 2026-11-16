import { CARS } from './config.js';
import * as race from './race.js';
import { setPlayers, setMode, setGarageCar, slotScreen, setOnResize } from './main.js';

const $ = id => document.getElementById(id);
const store = { get:k=>{try{return localStorage.getItem(k)}catch{return null}}, set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}} };

/* ---------- demo data (replaced by server in steps 3-4) ---------- */
const me = { name:'Driver', uid:'000000', car:0, ready:false, host:true };
const players = [me, {name:'Rohan',car:1,ready:true}, {name:'Aman',car:2,ready:true}];
const friends = [{name:'Rohan',uid:'204118',on:true},{name:'Aman',uid:'733402',on:true},{name:'Neha',uid:'918265',on:false}];
const room = new URLSearchParams(location.search).get('join') || Math.random().toString(36).slice(2,6).toUpperCase();

/* ---------- navigation ---------- */
let current = 'login';
function show(name){
  current = name;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  const lobbyLike = ['lobby','friends','invite'];
  if (lobbyLike.includes(name)) $('s-lobby').classList.add('on');
  $('s-'+name).classList.add('on');
  setMode(name==='garage' ? 'garage' : name==='hud' ? 'race' : lobbyLike.includes(name) ? 'lobby' : 'hidden');
  renderLobby();
}
document.addEventListener('click', e=>{
  const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go);
  const t = e.target.closest('[data-toast]'); if (t) toast(t.dataset.toast);
});
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),1800);}

/* ---------- login ---------- */
if (new URLSearchParams(location.search).get('join')) $('loginHint').textContent = `Joining room ${room}. Just pick a name.`;
$('btnCreate').onclick = () => {
  const n = $('nameInput').value.trim(); if (!n) return toast('Enter a name first');
  store.set('name',n); if (!store.get('uid')) store.set('uid',String(Math.floor(100000+Math.random()*900000)));
  enter();
};
$('nameInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('btnCreate').click();});
function enter(){
  me.name = store.get('name'); me.uid = store.get('uid'); me.car = +(store.get('car')||0);
  $('meName').textContent=me.name; $('meUid').textContent='UID '+me.uid; $('avatar').textContent=me.name[0].toUpperCase();
  $('roomCode').textContent=room; $('codeBig').textContent=room;
  setPlayers(players); show('lobby'); buildQR();
}

/* ---------- lobby ---------- */
function renderLobby(){
  const plates = $('plates'); plates.innerHTML='';
  for (let i=0;i<4;i++){
    const p = players[i], pos = slotScreen(i), el = document.createElement('div');
    el.className = 'plate'+(p?(p.ready?' ready':''):' empty');
    el.style.left=pos.x+'%'; el.style.top=pos.y+'%';
    el.innerHTML = p ? `<b>${p.name}${p.host?'<i class="crown"></i>':''}</b><span>${CARS[p.car].name} · ${p.ready?'Ready':'Waiting'}</span>` : '<span>Open slot</span>';
    plates.appendChild(el);
  }
  $('btnReady').textContent = me.ready ? 'Cancel ready' : 'Ready';
  $('btnReady').classList.toggle('on', me.ready);
  $('btnStart').disabled = !players.every(p=>p.ready);
  setPlayers(players);
}
setOnResize(()=>current!=='login' && renderLobby());
$('btnReady').onclick = ()=>{me.ready=!me.ready;renderLobby();};
$('btnLeave').onclick = ()=>toast('Leaving works once the online lobby is built');
$('btnStart').onclick = startRace;

/* ---------- friends ---------- */
$('tab-list').innerHTML = friends.map(f=>`<div class="row"><div class="avatar sm">${f.name[0]}</div>
  <div class="grow"><b>${f.name}</b><span>UID ${f.uid}</span></div><i class="dot ${f.on?'ice':'off'}"></i>
  <button class="chip gold" data-toast="Invite sent to ${f.name}">Invite</button></div>`).join('');
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('hide',t.id!=='tab-'+b.dataset.tab));
});
$('btnSendReq').onclick=()=>{const v=$('uidInput').value.trim();toast(v.length===6?`Request sent to ${v}`:'UID must be 6 digits');};

/* ---------- invite / QR ---------- */
const link = () => `${location.origin}${location.pathname}?join=${room}`;
function buildQR(){
  if (!window.qrcode) return;
  const q = qrcode(0,'M'); q.addData(link()); q.make(); $('qr').innerHTML = q.createSvgTag({cellSize:6,margin:2,scalable:true});
}
$('btnCopy').onclick=()=>{navigator.clipboard?.writeText(link()).then(()=>toast('Link copied'),()=>toast(link()));};

/* ---------- garage ---------- */
let pick = 0;
function renderGarage(){
  $('carList').innerHTML = CARS.map((c,i)=>`<button class="carbtn ${i===pick?'on':''}" data-i="${i}"><b>${c.name}</b><span>Class ${'SAAB'[i]}</span></button>`).join('');
  const s = CARS[pick].stats;
  $('stats').innerHTML = Object.entries(s).map(([k,v])=>`<div class="stat"><span>${k}</span><div><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('');
  setGarageCar(pick);
}
$('carList').onclick = e=>{const b=e.target.closest('.carbtn');if(b){pick=+b.dataset.i;renderGarage();}};
document.querySelector('[data-go="garage"]').addEventListener('click',()=>{pick=me.car;renderGarage();});
$('btnPick').onclick=()=>{me.car=pick;store.set('car',pick);toast(CARS[pick].name+' selected');show('lobby');};

/* ---------- countdown, HUD, results ---------- */
let timers=[];
async function startRace(){
  show('hud'); const c=$('count'); c.classList.add('on','small'); c.textContent='Loading track…';
  await race.prepare(players, me, {onHud, onFinish:endRace});
  c.classList.remove('small'); let n=3; c.textContent=n;
  const tick=setInterval(()=>{ n--; if(n>0){c.textContent=n;} else {c.textContent='GO';race.go();clearInterval(tick);timers.push(setTimeout(()=>c.classList.remove('on'),700));} },900);
  timers.push(tick);
}
function onHud(h){
  $('hSpeed').textContent=h.speed; $('hPos').textContent=h.pos; $('hNitro').style.width=h.nitro+'%';
  $('hDist').textContent=h.dist; $('hTotal').textContent=h.total;
  const prog=$('prog'); if(prog.children.length!==h.dots.length) prog.innerHTML=h.dots.map(()=>'<i></i>').join('');
  h.dots.forEach(([f,human],i)=>{const d=prog.children[i];d.style.left=(f*100)+'%';d.className=human?'me':'';});
}
const fmt=t=>`${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;
function endRace(res){
  res = res || race.snapshot();
  race.stop(); timers.forEach(t=>{clearInterval(t);clearTimeout(t);}); timers=[];
  $('count').classList.remove('on');
  $('resList').innerHTML = res.map((r,i)=>`<div class="row"><b class="rank">${i+1}</b><div class="grow"><b>${r.p.name}</b><span>${CARS[r.p.car].name}</span></div><span>${r.done?'':'~'}${fmt(r.time)}</span></div>`).join('');
  show('results');
}
$('btnQuit').onclick=()=>endRace();
$('btnBack').onclick=()=>{players.forEach(p=>{if(p!==me)p.ready=true;});me.ready=false;show('lobby');};

/* ---------- boot ---------- */
if (store.get('name')) { $('nameInput').value=store.get('name'); enter(); } else show('login');
