import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
import {rotuloAcao} from '../admin/idioma_dados.mjs';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const data=JSON.parse(await read('public/data/menus_dados.json'));
const traduzir=await carregarMensagens(async p=>({ok:true,json:async()=>JSON.parse(await read('public'+p))}));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
async function source(f){const text=await read('admin/'+f+'.mjs');return {text,ast:parseAst(text)};}
function fn(s,name){const n=find(s.ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return s.text.slice(n.start,n.end);}
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const players=await source('jogadores');

test('player inventory suggestions and item names display English without modifying reference data',async()=>{
 const before=JSON.stringify(data),list={},context={ref:null,fetch:async()=>({json:async()=>data}),$:()=>list,esc,traduzir};
 const ref=await vm.runInNewContext(fn(players,'referencia')+';referencia()',context);
 assert(list.innerHTML.includes('Coin'));assert(!list.innerHTML.includes('Moeda'));
 assert.equal(ref.itens,data.itens);assert.equal(JSON.stringify(data),before);
 const n=find(players.ast,n=>n.type==='VariableDeclarator'&&n.id.name==='nomeItem');const name=vm.runInNewContext('('+players.text.slice(n.init.start,n.init.end)+')',{ref,traduzir});assert.equal(name('1002'),'Great Ball');assert.equal(name('999999999'),'item 999999999');
});

test('actual player sheet translates ball, badge and action labels while preserving account names and messages',()=>{
 const sheet={},det={conta:{usuario:'Moeda',nome:'Cancelar',email:'test@example.invalid'},save:{bolas:{1002:7},insignias:[101]},log:[{acao:'recado',gm:'Moeda',quando:1,depois:{texto:'Cancelar'}}]},before=JSON.stringify(det);
 const ref={bolas:[{id:'1002',nome:'Grande Bola'}],insignias:[{id:101,n:'Insígnia da Rocha',gen:1}]};
 vm.runInNewContext(fn(players,'renderFicha')+';renderFicha()',{det,ref,traduzir,rotuloAcao,$:()=>sheet,esc,CIDADES:[],dataHora:()=>'',resumoLog:()=> '"Cancelar"',renderTime(){},ligarFicha(){}});
 for(const value of ['Great Ball','Boulder Badge','GM (opens the admin panel)','<b>Message</b>','Cancelar','Moeda','data-bola="1002"','data-ins="101"'])assert(sheet.innerHTML.includes(value),value);
 assert.equal(JSON.stringify(det),before);
});

test('actual item lookup accepts English names, original names and IDs with the same item key',()=>{
 const node=find(players.ast,n=>n.type==='VariableDeclarator'&&n.id.name==='addItem');assert(node);
 for(const query of ['Moeda','Coin','1 Coin']){
  const input={value:query},count={value:'2'},row={querySelector:()=>count};let changes=0;
  const elements={'j-item-add':input,'j-itens':{querySelector:selector=>selector==='tr[data-item="1"]'?row:null}};
  const ctx={ref:{itens:{1:{n:'Moeda',t:1}}},traduzir,$:id=>elements[id],toast:()=>assert.fail('unexpected rejection'),ligarItens(){},mexeuBolsa:()=>changes++};
  vm.runInNewContext('('+players.text.slice(node.init.start,node.init.end)+')()',ctx);assert.equal(count.value,3);assert.equal(input.value,'');assert.equal(changes,1);
 }
});

test('admin history action labels and grant locations translate without changing log codes or user text',()=>{
 for(const [raw,en]of [['bolsa','Bag'],['time','Team'],['deu pokemon','Gave Pokémon'],['novo código de recuperação','New recovery code'],['tirar silêncio','Unmute'],['ir até (chat)','Go to player (chat)'],['raid dano','Raid: Damage'],['raid comecar','Raid: Start']])assert.equal(rotuloAcao(raw),en);
 assert.equal(rotuloAcao('My custom action'),'My custom action');assert.equal(rotuloAcao(null),null);
 const summary=vm.runInNewContext(fn(players,'resumoLog')+';resumoLog',{dataHora:()=>''});
 for(const [raw,en]of [['time','team'],['caixa','storage']]){const e={acao:'deu pokemon',depois:{nome:'Moeda',lv:5,lugar:raw}},before=JSON.stringify(e);assert.equal(summary(e),'Moeda Lv 5 → '+en);assert.equal(JSON.stringify(e),before);}
 assert.equal(summary({acao:'recado',depois:{texto:'Cancelar'}}),'"Cancelar"');
});

test('actual trainer preview translates empty states and levels while retaining species, levels and model paths',async()=>{
 const s=await source('previa_treinador'),team={},info={classList:{remove(){}}},stage={dataset:{},classList:{remove(){}}},raiz={querySelector:sel=>sel==='.previa-time'?team:sel==='.palco'?stage:info};
 const render=vm.runInNewContext(fn(s,'renderTime')+';renderTime',{raiz,esc,nomesDex:async()=>({1:'Bulbasaur'})});
 await render(undefined);assert.equal(team.innerHTML,'');await render([]);assert(team.innerHTML.includes('No team.'));
 const party=[{dex:1,lv:12}],before=JSON.stringify(party);await render(party);assert(team.innerHTML.includes('Lv 12'));assert(team.innerHTML.includes('/ui/mon/pm0001.png'));assert.equal(JSON.stringify(party),before);
 await vm.runInNewContext(fn(s,'atualizar')+';atualizar({glb:""})',{raiz,renderTime:async()=>{},atual:null});assert.equal(info.textContent,'No model.');
});


test('all 32 badges display English in player management, data fields and actual badge previews',async()=>{
 const {campoDado}=await import('../admin/idioma_dados.mjs'),s=await source('previa_insignia'),original=JSON.stringify(data.insignias);
 const expected=['Boulder','Cascade','Thunder','Rainbow','Soul','Marsh','Volcano','Earth','Zephyr','Hive','Plain','Fog','Storm','Mineral','Glacier','Rising','Stone','Knuckle','Dynamo','Heat','Balance','Feather','Mind','Rain','Coal','Forest','Cobble','Fen','Relic','Mine','Icicle','Beacon'].map(n=>n+' Badge');
 assert.equal(data.insignias.length,32);
 for(const [i,badge]of data.insignias.entries()){
  assert.equal(campoDado('insignias','n',badge.n,traduzir),expected[i]);
  const raiz={querySelector:()=>null};await vm.runInNewContext(fn(s,'atualizar')+';atualizar(r)',{raiz,r:badge,esc,carregarGinasios:async()=>({}),carregarMensagens:async()=>traduzir});
  assert(raiz.innerHTML.includes('<b>'+expected[i]+'</b>'));assert(raiz.innerHTML.includes('/ui/icones/'+badge.i+'.png'));
 }
 assert.equal(JSON.stringify(data.insignias),original);
});
