import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(url).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const html=await read('index.html'),game=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function pintarBarra()'))[2],ast=parseAst(game);
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}

test('actual developer button renderers preserve boss/mount states, shortcuts and cached updates',()=>{
 const paint=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='pintarBarra');
 const head=paint.body.body.slice(0,6).map(n=>game.slice(n.start,n.end)).join('\n');
 for(const boss of [false,true])for(const mounted of [false,true]){
  const bc={disabled:!boss,style:{}},bm={dataset:{}},writes={boss:0,mount:0};
  Object.defineProperty(bc,'innerHTML',{set(v){this.markup=v;writes.boss++}});Object.defineProperty(bm,'innerHTML',{set(v){this.markup=v;writes.mount++}});
  const jogo={pika:{},chefe:boss?{id:'boss-123'}:null,montaria:mounted?{glb:'pm0249_00'}:null},before=JSON.stringify(jogo);
  const ctx={jogo,I18n:I,$:id=>({'chefe-btn':bc,'monta-btn':bm}[id])};
  vm.runInNewContext('function paint(){'+head+'};paint()',ctx);
  assert.equal(bc.disabled,boss);assert(bc.markup.includes(boss?'Boss active':'Summon boss'));assert(bm.markup.includes(mounted?'Dismount':'Mount'));assert(bm.markup.includes('>M</b>'));if(!boss)assert(bc.markup.includes('>B</b>'));
  assert.equal(JSON.stringify(jogo),before);vm.runInNewContext('paint()',ctx);assert.deepEqual(writes,{boss:1,mount:1});
 }
 for(const [key,en]of [['🐾 Seguir','🐾 Follow'],['⚙ Painel Admin','⚙ Admin panel'],['☄ Chamar chefe','☄ Summon boss']]){
  const assignment=find(ast,n=>n.type==='AssignmentExpression'&&n.left.property?.name==='innerHTML'&&game.slice(n.right.start,n.right.end).includes("I18n.t('"+key+"')"));
  assert(assignment);assert(vm.runInNewContext(game.slice(assignment.right.start,assignment.right.end),{I18n:I}).startsWith(en));
 }
});

test('actual gym-rematch, insufficient-Coins and timeout notices translate with values and names intact',()=>{
 const rematch=find(ast,n=>n.type==='CallExpression'&&n.callee.property?.name==='sistema'&&game.slice(n.start,n.end).startsWith("Chat.sistema('🏆 Revanche vencida contra '"));
 const coin=find(ast,n=>n.type==='CallExpression'&&n.callee.name==='flutuar'&&n.arguments[1]?.value==='sem Moedas suficientes');
 const timeout=find(ast,n=>n.type==='CallExpression'&&n.callee.property?.name==='sistema'&&game.slice(n.start,n.end).includes("((r && r.erro) || 'o servidor não respondeu')"));
 assert(rematch&&coin&&timeout);const messages=[];
 const ctx={g:{lider:'Moeda'},ganho:125,Chat:{sistema:s=>messages.push(I.t(s))},jogo:{ash:{}},flutuar:(_,s)=>messages.push(I.t(s)),r:null};
 for(const node of [rematch,coin,timeout])vm.runInNewContext(game.slice(node.start,node.end),ctx);
 assert.deepEqual(messages,['🏆 Rematch won against Moeda: +125 Coins.','not enough Coins','⚠ The server did not respond.']);
});

test('all reachable knowledge-level notices translate; an empty synthetic hint is not a reachable game state',async()=>{
 const source=await read('conhecimento.mjs'),tree=parseAst(source),template=find(tree,n=>n.type==='TemplateLiteral'&&n.quasis[0]?.value.cooked==='📖 ');
 assert(template);const NIVEIS=['desconhecido','Avistado','Registrado','Estudado','Especialista','Mestre'];
 for(let depois=1;depois<=5;depois++){
  const raw=vm.runInNewContext(source.slice(template.start,template.end),{S:{name:'Pikachu'},dex:25,depois,NIVEIS}),english=I.t(raw);
  assert(english.includes('Pikachu: knowledge level '+depois));assert(!/conhecimento|você|gênero|espécie/.test(english));
 }
});
