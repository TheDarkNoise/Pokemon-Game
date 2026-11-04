import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const fetcher=async p=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(p).replace(/^\.\//,'')))}}catch{return{ok:false}}};
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};globalThis.fetch=fetcher;
const I=await import('../i18n.mjs');await I.carregar('en');const admin=await carregarMensagens(p=>fetcher('.'+p));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
const source=await read('servidor_raid.mjs'),ast=parseAst(source);
const fn=name=>{const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);};
const snapshot=raid=>JSON.stringify(raid,(k,v)=>v instanceof Map?[...v]:v);

test('active raid status translates every phase, queue marker and timer while preserving protocol values and names',()=>{
 for(const [fase,label]of Object.entries({anunciada:'announced',contagem:'countdown',indo:'moving',luta:'battle',fim:'ending'}))for(const premio of ['mew','sem-mew']){
  const raid={id:9,fase,cfg:{chefeNome:'Moeda',chefeDex:151,vagas:10,chefeHp:1000,arena:'4120009'},sobre:{hp:null},chefe:{hp:80,maxHp:1000},fila:new Map([['a',{nome:'Cancelar',dano:10,ida:true,chegou:false}],['b',{nome:'Moeda',dano:0,chegou:true}]]),contagemAte:2100,lutaAte:4100,fimAte:3100},before=snapshot(raid);
  const ctx={raid,Date:{now:()=>1000},danoRaid:()=>1.5,taxaRaid:()=>100,premioRaid:()=>premio};
  const value=vm.runInNewContext(fn('retrato')+';'+fn('status')+';({text:status(),wire:retrato(null)})',ctx);
  const english=I.t('🐉 '+value.text);
  assert(english.includes('Raid #9 · '+label+' · queue 2/10 (Cancelar 10 en route, Moeda)'));
  assert(english.includes('Moeda 80/1000 · damage ×1.5 · Shiny 1/100 · reward '+(premio==='mew'?'Pokémon + items':'items only')));
  assert.equal(value.wire.fase,fase);assert.deepEqual(JSON.parse(JSON.stringify(value.wire.nomes)),['Cancelar','Moeda']);assert(english.includes('Cancelar 10 en route, Moeda'));assert.equal(snapshot(raid),before);
  assert.equal(english.includes('starts in 2 s'),fase==='contagem');assert.equal(english.includes(' s remaining'),fase==='luta'||fase==='fim');
 }
});

test('waiting raid status shows automatic and overridden HP without changing configuration',()=>{
 for(const hp of [null,750]){
  const raid={id:2,fase:'anunciada',cfg:{chefeNome:'Mew',vagas:10,chefeHp:0},sobre:{hp},fila:new Map()},before=snapshot(raid);
  const result=vm.runInNewContext(fn('status')+';status()',{raid,retrato:()=>({}),danoRaid:()=>1,taxaRaid:()=>4096,premioRaid:()=> 'mew'});
  assert(I.t('🐉 '+result).includes(' · HP '+(hp??'auto')+' · damage ×1'));assert.equal(snapshot(raid),before);
 }
});

test('translated route/file/model and idle raid notices preserve literal resource and boss names',()=>{
 for(const raw of ['Moeda','Cancelar','pm0151_00','/admin/dados/Moeda']){
  for(const [text,expected]of [
   ['Arquivo não editável pelo painel: '+raw,'File cannot be edited through the panel: '+raw],
   ['Rota admin não encontrada: '+raw,'Admin route not found: '+raw],
   ['Rota não encontrada: '+raw,'Route not found: '+raw],
   ['O modelo '+raw+'.glb não existe em public/cenario/mon: o chefe vai aparecer só como barra de vida.','Model '+raw+'.glb is missing from public/cenario/mon: only the boss HP bar will appear.'],
   ['Nenhuma raid agora (padrão do data/raid.json: '+raw+' Lv 70, 10 vagas, arena 4120009).','No raid is active (defaults from data/raid.json: Lv 70 '+raw+', 10 places, arena 4120009).']
  ]){assert.equal(admin(text),expected);assert.equal(I.t(text),expected);}
 }
});

test('actual Social loading notice translates and failure status stays readable',async()=>{
 const s=await read('menus.mjs'),tree=parseAst(s),call=find(tree,n=>n.type==='CallExpression'&&n.callee.object?.name==='Popup'&&n.callee.property?.name==='texto'&&n.arguments[1]?.value==='amigos-contagem'&&n.arguments[2]?.type==='ConditionalExpression');assert(call);
 for(const [soFalha,expected]of [[false,'Loading…'],[true,'Unavailable on this server']])assert.equal(I.t(vm.runInNewContext(s.slice(call.arguments[2].start,call.arguments[2].end),{soFalha})),expected);
});
