import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
const source=await read('raid.mjs'),ast=parseAst(source),fn=name=>{const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);};
const html=await read('index.html'),game=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('async function telaEscura'))[1],gameAst=parseAst(game),screen=find(gameAst,n=>n.type==='FunctionDeclaration'&&n.id.name==='telaEscura');assert(screen);

test('actual transition screen translates raid exit and previous-location fallback text without changing its delay',async()=>{
 for(const [text,expected]of [['Voltando pra onde você estava…','Returning to your previous location…'],['A raid acabou. Voltando…','The raid is over. Returning…']]){
  const boot={hidden:true},waits=[];await vm.runInNewContext(game.slice(screen.start,screen.end)+';telaEscura(9000,text)',{I18n:I,$:()=>boot,dorme:async n=>waits.push(n),text});assert.equal(boot.textContent,expected);assert.equal(boot.hidden,false);assert.deepEqual(waits,[9000]);
 }
});

test('actual lost-raid recovery retains the four-second timer and both safe-exit paths',()=>{
 for(const direct of [true,false]){
  let callback,delay,cleared=0;const exits=[],ctx={mapa:'4120009',emArena:()=>true,navegando:()=>false,irParaCena:p=>exits.push(p)};if(direct)ctx.sairDaArena=text=>exits.push({texto:text});
  const m={fase:'nenhuma',eu:false};const before=JSON.stringify(m);
  vm.runInNewContext(fn('aoEstado')+';aoEstado(m)',{ctx,m,recebeu:false,snap:{},ARENA:'4120009',FASES_DENTRO:new Set(['indo','luta','fim']),timerFim:null,ui(){},setTimeout:(f,ms)=>{callback=f;delay=ms;return 7;},apagarCarimbo:()=>cleared++,chefe(){}});
  assert.equal(delay,4000);assert.equal(exits.length,0);callback();assert.equal(exits.length,1);assert.equal(I.t(exits[0].texto),'The raid is over. Returning…');if(!direct)assert.equal(exits[0].mapa,null);assert.equal(cleared,1);assert.equal(JSON.stringify(m),before);
 }
});

test('actual raid travel keeps boss names literal while retaining destination and raid identifiers',()=>{
 for(const name of ['Mew','Moeda','Cancelar','Abra']){
  const calls=[],marks=[],m={id:7,mapa:'4120009'},before=JSON.stringify(m);
  vm.runInNewContext(fn('aoIr')+';aoIr(m)',{m,snap:{},ARENA:'4120009',ctx:{mapa:'kanto',emArena:()=>false,irParaCena:p=>calls.push(p)},nomeChefe:()=>name,carimbar:id=>marks.push(id),clearTimeout(){},timerIda:1});
  assert.equal(I.t(calls[0].texto),'Joining the '+name+' raid…');assert.equal(calls[0].mapa,'4120009');assert.equal(calls[0].raid,7);assert.deepEqual(marks,[7]);assert.equal(JSON.stringify(m),before);
 }
});

test('actual raid defeat, shiny reward and party-delivery notices translate without renaming Pokémon',()=>{
 for(const name of ['Mew','Moeda','Cancelar']){
  const notices=[],banners=[],ctx={emArena:()=>false,Chat:{sistema:s=>notices.push(I.t(s))},Som:{tocar(){}},nomeItem:()=> 'Poção'},context={ctx,nomeChefe:()=>name,I18n:I,avisar:s=>banners.push(I.t(s))};
  vm.runInNewContext(fn('aoFim')+';aoFim({venceu:false})',context);assert.equal(banners[0],'The raid is over: '+name+' escaped.');
  const m={venceu:true,premio:{mew:{nome:name,shiny:true,lv:70},dinheiro:100,itens:{2001:1}}},before=JSON.stringify(m);vm.runInNewContext(fn('aoFim')+';aoFim(m)',{...context,m});
  assert(notices.includes('✨ Your '+name+' is SHINY!'));assert(notices.includes(name+' joined your party (or storage, if your party is full).'));assert(banners[1].includes(name+' defeated! Reward: ✨ '+name+' Lv 70'));assert.equal(JSON.stringify(m),before);
 }
});
