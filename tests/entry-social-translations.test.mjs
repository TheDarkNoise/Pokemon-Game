import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
const layout=JSON.parse(await readFile(new URL('../ui/hud_layout.json',import.meta.url),'utf8'));
const source=await readFile(new URL('../menus.mjs',import.meta.url),'utf8');
function fn(name){const n=parseAst(source).body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);}
function fields(node){const out=[];function walk(v){if(!v||typeof v!=='object')return;if(v.tipo==='rotulo'&&v.texto)out.push(I.t(v.texto));if(v.tipo==='txt'&&v.exemplo&&!/^v\d/.test(v.exemplo))out.push(I.t(v.exemplo));for(const x of Object.values(v))if(x&&typeof x==='object')Array.isArray(x)?x.forEach(walk):walk(x);}walk(node);return out;}

test('shipped login and registration layouts display English labels and placeholders in both orientations',()=>{
 for(const ori of ['pc','deitado']){
  assert.deepEqual(fields(layout.telas[ori].login),['Sign in','email or username','password','Sign in','forgot password','create account']);
  assert.deepEqual(fields(layout.telas[ori].cadastro),['Create account','username','email','password','confirm password','Create account','already have an account — back to sign in']);
 }
});

test('Social and Trainer layout tabs and buttons use English',()=>{
 for(const ori of ['pc','deitado']){
  const social=fields(layout.popups[ori].social),trainer=fields(layout.popups[ori].treinador);
  for(const label of ['Messages','Friends','Requests','Send','send message','remove friend'])assert(social.includes(label),ori+': '+label);
  for(const label of ['Trainer','Profile','money','badges','character','starter','Kanto badges'])assert(trainer.includes(label),ori+': '+label);
 }
});

test('a missing Social endpoint is cached and displayed without repeated requests or chat spam',async()=>{
 const requests=[],logs=[],data={soCarregando:false,soFalha:null,soDados:null,popSo:{},aberta:'social',renders:0,soLigado:()=>true,soChamar:async(...a)=>{requests.push(a);return{ok:false,status:404,erro:'Rota não encontrada: /social'};},Popup:{aberto:()=>true},Chat:{sistema:m=>logs.push(m)},tr:I.t};
 const context=vm.createContext(data);context.encherSocial=()=>data.renders++;
 await vm.runInContext(fn('soCarregar')+';(async()=>{await soCarregar();await soCarregar();})()',context);
 assert.deepEqual(requests,[['GET','/social']]);assert.equal(logs.length,0);assert.match(data.soFalha,/not available on this server yet/);assert.equal(data.renders,1);
});

test('supported Social responses preserve data and request contracts',async()=>{
 const payload={amigos:[],pedidos:[],conversas:[]},requests=[],data={soCarregando:false,soFalha:null,soDados:null,popSo:null,aberta:'social',soLigado:()=>true,soChamar:async(...a)=>{requests.push(a);return{ok:true,status:200,dados:payload};},Chat:{sistema(){}},tr:I.t};
 await vm.runInNewContext(fn('soCarregar')+';soCarregar()',data);
 assert.deepEqual(requests,[['GET','/social']]);assert.equal(data.soDados,payload);assert.equal(data.soFalha,null);assert.equal(data.soCarregando,false);
});

test('Battle explains unavailable PvP and rankings without falsely reporting an offline server',()=>{
 for(const tab of ['pvp','rank']){
  const body={innerHTML:''};vm.runInNewContext(fn('rBatalha')+';rBatalha(body)',{body,abas:()=>tab,esc:s=>s,tr:I.t});
  assert(!body.innerHTML.includes('Requires a server'));assert(!body.innerHTML.includes('positioning'));
  assert.match(body.innerHTML,tab==='pvp'?/PvP battles are not available/:/rankings are not available on this server/);
 }
});

test('temporary Social errors do not immediately re-render and repeat the failed request',async()=>{
 const logs=[],data={soCarregando:false,soFalha:null,soDados:null,popSo:{},aberta:'social',soLigado:()=>true,soChamar:async()=>({ok:false,status:503,erro:'Temporarily unavailable'}),Popup:{aberto:()=>true},Chat:{sistema:m=>logs.push(m)},tr:I.t,encherSocial:()=>assert.fail('must not immediately retry after a transient failure')};
 await vm.runInNewContext(fn('soCarregar')+';soCarregar()',data);
 assert.deepEqual(logs,['Social: Temporarily unavailable']);assert.equal(data.soFalha,null);assert.equal(data.soCarregando,false);
});
