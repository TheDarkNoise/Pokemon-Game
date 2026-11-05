import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');let itemSource;
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('importmap')){const s=m[2],fn=parseAst(s).body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='usarItem');if(fn)itemSource=s.slice(fn.start,fn.end);}assert(itemSource);
function use({p={},items={},id=2001,name='Poção',turn=null,callback=true}){
 const notices=[],requests=[],writes=[],rounds=[];
 const ctx={jogo:{pika:p,ash:{},time:[],turno:turn},eliteEstado:{corrida:null},REANIMADORES:{},ehReanimador:()=>false,lerLS:()=>items,gravarLS:(...x)=>writes.push(x),bolsaOp:(...x)=>requests.push(x),uidParceiro:()=> 'partner-7',flutuar:(e,s)=>notices.push(I.t(s)),Som:{tocar(){}},pintarTime(){},pintarTurno(){},rodadaDoServidor:(t,r)=>rounds.push(r),id,name,aviso:callback?(s,ok)=>notices.push(I.t(s)):null};
 const result=vm.runInNewContext(itemSource+';usarItem(id,name,aviso)',ctx);return{result,notices,requests,writes,rounds};
}
test('actual item refusals display English without spending items or turns',()=>{
 const cases=[
  {p:{nome:'Pikachu',hp:20,maxHp:20},items:{2001:2},expected:'Pikachu already has full HP. To heal another Pokémon, select it from the party bar'},
  {p:{nome:'Pikachu',hp:0,maxHp:20},items:{2001:2},expected:'Pikachu has fainted: use a Revive or visit a Pokémon Center'},
  {p:{nome:'Pikachu',movs:[{id:1,pp:10,ppMax:10}]},items:{2022:2},id:2022,name:'Éter',expected:'Pikachu already has full PP'},
  {p:{nome:'Pikachu',movs:[{id:1,pp:10,ppMax:10}]},items:{2022:2},id:2022,name:'Éter',callback:false,expected:'PP is already full'},
  {p:{nome:'Pikachu',movs:[]},items:{2022:2},id:2022,name:'Éter',expected:'Pikachu has no moves'},
  {p:{nome:'Pikachu'},items:{},expected:'You have no Potion left'},
  {p:{nome:'Pikachu'},items:{2001:2},turn:{serv:true,fase:'inimigo'},expected:'Wait for your turn in battle'},
 ];
 for(const spec of cases){const before=JSON.stringify(spec),r=use(spec);assert.equal(r.result,false);assert.deepEqual(r.notices,[spec.expected]);assert.equal(r.requests.length,0);assert.equal(r.writes.length,0);assert.equal(r.rounds.length,0);assert.equal(JSON.stringify(spec),before);}
});
test('successful all-move PP restoration retains inventory, request and turn contracts',()=>{
 const p={nome:'Pikachu',movs:[{id:1,pp:0,ppMax:10},{id:2,pp:7,ppMax:20}]},items={2024:2},turn={serv:true,fase:'escolha'};const r=use({p,items,turn,id:2024,name:'Elixir'});
 assert.equal(r.result,true);assert.deepEqual(p.movs.map(m=>m.pp),[10,17]);assert.equal(items[2024],1);assert(r.notices.includes('Pikachu recovered 20 PP (all moves)'));
 assert.deepEqual(JSON.parse(JSON.stringify(r.requests)),[['usar',{item:2024,uid:'partner-7',estado:{movs:[{id:1,pp:0,ppMax:10},{id:2,pp:7,ppMax:20}]}}]]);assert.deepEqual(JSON.parse(JSON.stringify(r.rounds)),[{tipo:'item',item:2024}]);assert.equal(turn.fase,'usando');assert.equal(r.writes[0][0],'itens');
});
test('raid queue refusals translate with the actual server warning prefix',async()=>{
 const source=await readFile(new URL('../servidor_raid.mjs',import.meta.url),'utf8');let fn;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id.name==='entrarFila')fn=n;for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);}walk(parseAst(source));assert(fn);
 const notices=[];let prefix;
 function inspect(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee.name==='recusa')notices.push(n.arguments[0].value);if(n.type==='CallExpression'&&n.callee.name==='sistema')prefix??=source.slice(n.arguments[1].start,n.arguments[1].end);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(inspect):inspect(v);}inspect(fn);assert.equal(notices.length,5);
 for(const text of notices){const raw=vm.runInNewContext(prefix,{texto:text});assert(raw.startsWith('⚠ '));assert.notEqual(I.t(raw),raw);assert.equal(I.t(raw),'⚠ '+I.t(text));}
 assert.equal(I.t('⚠ A fila da raid está cheia.'),'⚠ The raid queue is full.');
});
