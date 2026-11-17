import {API} from './env.js';
const LS=localStorage;
export const S={token:LS.rc_token||'',uid:LS.rc_uid||'',name:LS.rc_name||''};
async function call(p,m='GET',b){
  const r=await fetch(API+p,{method:m,headers:{'content-type':'application/json',...(S.token?{authorization:'Bearer '+S.token}:{})},body:b?JSON.stringify(b):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Error '+r.status);return j;
}
export async function register(name){const j=await call('/api/register','POST',{name});Object.assign(S,j);LS.rc_token=j.token;LS.rc_uid=j.uid;LS.rc_name=j.name;return j}
export function logout(){S.token=S.uid=S.name='';delete LS.rc_token;delete LS.rc_uid;delete LS.rc_name}
export const me=()=>call('/api/me');
export const friendReq=uid=>call('/api/friend/request','POST',{uid});
export const friendAccept=uid=>call('/api/friend/accept','POST',{uid});
export const friendDecline=uid=>call('/api/friend/decline','POST',{uid});
export const invite=(uid,code)=>call('/api/invite','POST',{uid,code});
export const inviteClear=code=>call('/api/invite/clear','POST',{code});
export const createLobby=()=>call('/api/lobby/create','POST',{});
export function openLobby(code,create,h){
  const ws=new WebSocket(API.replace(/^http/,'ws')+`/api/lobby/${code}/ws?token=${S.token}&create=${create?1:0}`);
  const o={code,send:d=>ws.readyState===1&&ws.send(JSON.stringify(d)),close:()=>{o.dead=true;clearInterval(ping);ws.close()}};
  const ping=setInterval(()=>o.send({t:'p'}),25000);
  ws.onopen=()=>h.open&&h.open();
  ws.onmessage=e=>{try{h.msg(JSON.parse(e.data))}catch{}};
  ws.onclose=()=>{clearInterval(ping);if(!o.dead&&h.close)h.close()};
  return o;
}
