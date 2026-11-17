import {CARS,STAT_NAMES} from './config.js';
import * as stage from './stage.js';
import * as api from './api.js';
import {preload,startRace} from './race.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],LS=localStorage;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const QR_LIB='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',JSQR='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const MODE={login:'home',home:'home',garage:'home',result:'home',lobby:'lobby'};
let carIdx=Math.min(CARS.length-1,+LS.rc_car||0),gi=carIdx,lobby=null,lobbyState=null,cur='boot',garageBack='home',lastMe=null,raceKind='solo',pollT=0,shownInv=new Set(),invCode=null;
let joinCode=parseCode(new URLSearchParams(location.search).get('join')||'');

function parseCode(s){try{s=new URL(s).searchParams.get('join')||s}catch{}s=String(s).toUpperCase().replace(/[^A-Z0-9]/g,'');return s.length===6?s:null}
const fitScreen=()=>{$('#game').style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1280,innerHeight/720)})`};
function go(id){cur=id;$$('.screen').forEach(s=>s.classList.toggle('on',s.id==='s-'+id));stage.setMode(MODE[id]||'off');if(id==='home')homeInfo()}
let tt=0;function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),2600)}
const bar=(p,t)=>{$('#bootBar').style.width=Math.max(5,p*100)+'%';if(t)$('#bootTxt').textContent=t};
const loadScript=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
function stats(el,i){el.innerHTML=STAT_NAMES.map((n,k)=>`<div class="st"><span>${n}</span><i style="--v:${CARS[i].stats[k]}%"></i></div>`).join('')}

// ---------- boot / login ----------
async function boot(){
  fitScreen();addEventListener('resize',fitScreen);stage.init($('#stage3d'),$('#tags'));
  bar(.1);await Promise.all([stage.preload(p=>bar(.1+p*.8,'LOADING STAGE')),new Promise(r=>setTimeout(r,800))]);bar(1,'READY');
  if(joinCode){$('#joinBanner').classList.remove('hide');$('#joinCode').textContent=joinCode}
  if(api.S.token){try{await refreshMe();await afterLogin();return}catch{api.logout()}}
  go('login');stage.showCar(carIdx);
}
async function afterLogin(){
  await refreshMe();clearInterval(pollT);pollT=setInterval(()=>refreshMe().catch(()=>{}),4000);
  if(joinCode){const c=joinCode;joinCode=null;history.replaceState(null,'',location.pathname);joinLobby(c)}else go('home');
}
async function login(){
  const name=$('#nameIn').value.trim();if(name.length<2)return toast('Naam kam se kam 2 letter ka rakho');
  $('#goBtn').disabled=true;
  try{await api.register(name);await afterLogin()}catch(e){toast(e.message)}finally{$('#goBtn').disabled=false}
}
function homeInfo(){
  $('#pName').textContent=api.S.name;$('#pUid').textContent=api.S.uid;$('#av').textContent=(api.S.name[0]||'R').toUpperCase();
  $('#hCarName').textContent=CARS[carIdx].name;stats($('#hStats'),carIdx);stage.showCar(carIdx);
}

// ---------- friends / invites ----------
async function refreshMe(){
  lastMe=await api.me();const n=lastMe.requests.length,b=$('#frBadge');b.textContent=n;b.classList.toggle('hide',!n);
  if($('#mFriends').classList.contains('on'))renderFriends();
  const inv=lastMe.invites.find(i=>!shownInv.has(i.code+i.ts));
  if(inv&&!lobby&&cur!=='race'){shownInv.add(inv.code+inv.ts);invCode=inv.code;$('#invTxt').textContent=inv.fromName+' ne lobby me bulaya';$('#invBox').classList.remove('hide')}
}
function renderFriends(){
  const m=lastMe;
  $('#frReq').innerHTML=m.requests.map(r=>`<div class="fr"><b>${esc(r.name)}</b><u>${r.uid}</u><button class="btn gold sm" data-acc="${r.uid}"><span>ACCEPT</span></button><button class="btn sm" data-dec="${r.uid}"><span>✕</span></button></div>`).join('');
  $('#frList').innerHTML=m.friends.length?m.friends.map(f=>`<li class="fr"><b>${esc(f.name)}</b><u>${f.uid}</u>${lobby?`<button class="btn gold sm" data-inv="${f.uid}"><span>INVITE</span></button>`:''}</li>`).join(''):'<p class="empty">Abhi koi friend nahi. UID se add karo.</p>';
}
async function friendsClick(e){
  const b=e.target.closest('button');if(!b)return;
  try{
    if(b.dataset.close!==undefined)return $('#mFriends').classList.remove('on');
    if(b.dataset.acc){await api.friendAccept(b.dataset.acc);toast('Dost ban gaye!')}
    else if(b.dataset.dec)await api.friendDecline(b.dataset.dec);
    else if(b.dataset.inv){await api.invite(b.dataset.inv,lobby.code);toast('Invite bhej diya');return}
    else return;
    await refreshMe();renderFriends();
  }catch(er){toast(er.message)}
}
function openFriends(){$('#mFriends').classList.add('on');refreshMe().then(renderFriends).catch(()=>{})}

// ---------- garage ----------
function gShow(i){gi=(i+CARS.length)%CARS.length;$('#gName').textContent=CARS[gi].name;$('#gIdx').textContent=(gi+1)+' / '+CARS.length;stats($('#gStats'),gi);stage.showCar(gi);$('#gSelect').firstChild.textContent=gi===carIdx?'SELECTED ✓':'SELECT'}
function openGarage(from){garageBack=from;go('garage');gShow(carIdx)}
function selectCar(){carIdx=gi;LS.rc_car=gi;lobby&&lobby.send({t:'car',car:gi});gShow(gi);toast(CARS[gi].name+' select ho gayi')}

// ---------- lobby ----------
async function createLobby(){try{const {code}=await api.createLobby();enterLobby(code,true)}catch(e){toast(e.message)}}
const joinLobby=code=>enterLobby(code,false);
function enterLobby(code,create){
  leaveLobby(true);$('#lCode').textContent=code;lobbyState=null;go('lobby');drawQR(code);setBtns();
  lobby=api.openLobby(code,create,{open:()=>lobby&&lobby.send({t:'car',car:carIdx}),msg:onLobby,close:()=>{if(lobby&&lobby.code===code){lobby=null;stage.clearLobby();toast('Lobby disconnect ho gaya');go('home')}}});
}
function leaveLobby(quiet){if(lobby){lobby.close();lobby=null}stage.clearLobby();lobbyState=null;if(!quiet)go('home')}
function onLobby(m){
  if(m.t==='err'){toast(m.m);if(/nahi mili|full|shuru/i.test(m.m))leaveLobby();return}
  if(m.t==='lobby'){
    lobbyState=m;stage.setLobby(m.players);
    $('#lCount').textContent=m.players.length+'/6';
    $('#lList').innerHTML=m.players.map(p=>`<li><span class="d"></span>${esc(p.name)}<i class="${p.ready||p.uid===m.host?'ok':''}">${p.uid===m.host?'HOST':p.ready?'READY':'WAITING'}</i></li>`).join('');
    setBtns();if(m.phase==='wait'&&(cur==='result'))go('lobby');
  }
  if(m.t==='go')netRace(m);
}
function setBtns(){
  const m=lobbyState,host=m&&m.host===api.S.uid,me=m&&m.players.find(p=>p.uid===api.S.uid);
  $('#lStart').classList.toggle('hide',!host);$('#lReady').classList.toggle('hide',!!host||!m);
  if(me)$('#lReady').firstChild.textContent=me.ready?'CANCEL READY':'READY';
  if(host)$('#lStart').disabled=!m.players.every(p=>p.uid===m.host||p.ready);
}
async function drawQR(code){
  const url=location.origin+location.pathname+'?join='+code,box=$('#qrBox');box.textContent=code;
  try{if(!window.qrcode)await loadScript(QR_LIB);const q=window.qrcode(0,'M');q.addData(url);q.make();box.innerHTML=q.createSvgTag(5,0)}catch{}
}
const copy=(t,m)=>navigator.clipboard?.writeText(t).then(()=>toast(m)).catch(()=>toast(t));

// ---------- QR scan ----------
let scanStream=null,scanRaf=0;
async function openScan(){
  $('#mScan').classList.add('on');$('#scanNote').textContent='QR camera ke samne rakho';
  try{
    if(!window.jsQR)await loadScript(JSQR);
    scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=$('#scanVid');v.srcObject=scanStream;await v.play();scanTick();
  }catch{$('#scanNote').textContent='Camera allow nahi hua. Neeche code type karo.'}
}
function scanTick(){
  const v=$('#scanVid'),c=$('#scanCv');
  if(v.videoWidth){c.width=v.videoWidth>>1;c.height=v.videoHeight>>1;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0,c.width,c.height);
    const d=x.getImageData(0,0,c.width,c.height),r=window.jsQR(d.data,d.width,d.height),code=r&&parseCode(r.data);
    if(code){closeScan();return gotCode(code)}}
  scanRaf=requestAnimationFrame(scanTick);
}
function closeScan(){cancelAnimationFrame(scanRaf);scanStream&&scanStream.getTracks().forEach(t=>t.stop());scanStream=null;$('#mScan').classList.remove('on')}
function gotCode(code){if(api.S.token)joinLobby(code);else{joinCode=code;$('#joinBanner').classList.remove('hide');$('#joinCode').textContent=code}}

// ---------- race ----------
async function runRace(startAt){
  go('race');const L=$('#raceLoad');L.classList.remove('hide');
  await preload(p=>$('#raceBar').style.width=Math.max(5,p*100)+'%');
  if(startAt)await new Promise(r=>setTimeout(r,Math.max(0,startAt-Date.now())));
  L.classList.add('hide');const touch=matchMedia('(pointer:coarse)').matches;$('#s-race').classList.toggle('touch',touch);
  startRace({container:$('#raceView'),carIdx,name:api.S.name,scale:1,autoGas:touch,onFinish:showResult});
}
const netRace=m=>{raceKind='lobby';runRace(m.at)};
function showResult(res){
  $('#resTb').innerHTML=res.map(r=>`<tr class="${r.isP?'me':''}"><td>#${r.pos}</td><td>${esc(r.name)}</td><td>${esc(r.car)}</td><td>${r.time}</td></tr>`).join('');go('result');
}
function resultBack(){if(raceKind==='lobby'&&lobby){lobby.send({t:'back'});go('lobby')}else go('home')}

// ---------- wiring ----------
$('#goBtn').onclick=login;$('#nameIn').onkeydown=e=>e.key==='Enter'&&login();
$('#mRace').onclick=()=>{raceKind='solo';runRace()};$('#mLobby').onclick=createLobby;$('#mGarage').onclick=()=>openGarage('home');
$('#btnFriends').onclick=openFriends;$('#btnScan').onclick=openScan;$('#copyUid').onclick=()=>copy(api.S.uid,'UID copy ho gaya');
$('#gBack').onclick=()=>garageBack==='lobby'?go('lobby'):go('home');$('#gPrev').onclick=()=>gShow(gi-1);$('#gNext').onclick=()=>gShow(gi+1);$('#gSelect').onclick=selectCar;
$('#lobbyLeave').onclick=()=>leaveLobby();$('#lCar').onclick=()=>openGarage('lobby');$('#lInvite').onclick=openFriends;
$('#lCopy').onclick=()=>copy(location.origin+location.pathname+'?join='+lobby.code,'Link copy ho gaya');
$('#lReady').onclick=()=>{const me=lobbyState&&lobbyState.players.find(p=>p.uid===api.S.uid);lobby.send({t:'ready',v:!(me&&me.ready)})};
$('#lStart').onclick=()=>lobby.send({t:'start'});
$('#mFriends').onclick=friendsClick;$('#addBtn').onclick=async()=>{const u=$('#addUid').value.replace(/\D/g,'');if(!u)return;try{const r=await api.friendReq(u);toast(r.accepted?'Dost ban gaye!':'Request bhej di');$('#addUid').value='';await refreshMe();renderFriends()}catch(e){toast(e.message)}};
$$('#mScan [data-close]').forEach(b=>b.onclick=closeScan);$('#scanGo').onclick=()=>{const c=parseCode($('#scanCode').value);if(!c)return toast('6 letter ka code dalo');closeScan();gotCode(c)};
$('#invYes').onclick=()=>{$('#invBox').classList.add('hide');api.inviteClear(invCode).catch(()=>{});joinLobby(invCode)};
$('#invNo').onclick=()=>{$('#invBox').classList.add('hide');api.inviteClear(invCode).catch(()=>{})};
$('#resBack').onclick=resultBack;
boot();
