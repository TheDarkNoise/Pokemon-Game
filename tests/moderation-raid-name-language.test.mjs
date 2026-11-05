import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {criarTradutor} from '../admin/mensagens.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}

test('actual moderation response preserves account names through prefixed English chat formatting',async()=>{
 const source=await read('rede.mjs'),block=find(parseAst(source),n=>n.type==='SwitchCase'&&n.test?.value==='mod_erro').consequent[0];
 for(const name of ['Moeda','Cancelar','Abra','Pedra'])for(const [erro,expected]of [[`Conta "${name}" não encontrada`,`⚠ Account "${name}" not found.`],[`${name} não está online`,`⚠ ${name} is not online.`]]){
  const messages=[],m={t:'mod_erro',erro},before=JSON.stringify(m);
  vm.runInNewContext('(()=>'+source.slice(block.start,block.end)+')()',{ctx:{Chat:{sistema:s=>messages.push(I.t(s))}},m});
  assert.deepEqual(messages,[expected]);assert.equal(JSON.stringify(m),before);
 }
});

test('raid announcement, countdown, queue and reward messages keep custom boss names literal',()=>{
 for(const name of ['Moeda','Cancelar','Abra'])for(const [source,expected]of [
  [`📢 RAID: um ${name} Lv 70 apareceu! Entre na fila pelo botão RAID (10 vagas).`,`📢 RAID: a Lv 70 ${name} appeared! Join the queue using the RAID button (10 places).`],
  [`A raid do ${name} começa em 15 s!`,`The ${name} raid starts in 15 s!`],
  [`Você entrou na fila da raid do ${name} (2/10).`,`You joined the ${name} raid queue (2/10).`],
  [`🐉 Raid #7 anunciada: ${name} Lv 70, 10 vagas. /raid comecar abre a contagem.`,`🐉 Raid #7 announced: Lv 70 ${name}, 10 places. /raid comecar starts the countdown.`],
  [`🐉 Prêmio: o ${name} + itens.`,`🐉 Reward: ${name} + items.`],
  [`A raid do ${name} foi cancelada pela staff.`,`Staff canceled the ${name} raid.`],
  [`🔊 ${name} pode falar de novo.`,`🔊 ${name} can speak again.`],
  [`🧭 Indo até ${name}…`,`🧭 Going to ${name}…`],
  [`perto de ${name}`,`near ${name}`],
 ])assert.equal(I.t(source),expected);
});

test('actual server default-raid status preserves the configured boss name, arena identifier and command syntax',async()=>{
 const source=await read('servidor_raid.mjs'),n=find(parseAst(source),n=>n.type==='FunctionDeclaration'&&n.id.name==='status');
 for(const name of ['Moeda','Cancelar']){
  const cfg={chefeNome:name,chefeNivel:70,vagas:10,arena:'4120009'},before=JSON.stringify(cfg);
  const raw=vm.runInNewContext(source.slice(n.start,n.end)+';status()',{raid:null,lerCfg:()=>cfg});
  assert.equal(I.t('🐉 '+raw),`🐉 No raid is active (defaults from data/raid.json: Lv 70 ${name}, 10 places, arena 4120009).`);assert.equal(JSON.stringify(cfg),before);
 }
});

test('admin notices use English prompts and preserve names while Portuguese remains available',async()=>{
 const tr=criarTradutor(JSON.parse(await read('public/data/idioma/ui_en.json')));
 assert.equal(tr('Escreva o aviso.'),'Enter an announcement.');
 assert.equal(tr('Conta "Moeda" não encontrada.'),'Account "Moeda" not found.');
 assert.equal(tr('Cancelar não está online.'),'Cancelar is not online.');
 await I.carregar('pt');assert.equal(I.t('A raid do Moeda começa em 15 s!'),'A raid do Moeda começa em 15 s!');await I.carregar('en');
});


test('actual event banner and chat translate before the lightning prefix and preserve custom event names',async()=>{
 const html=await read('index.html');let code;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('importmap')){const found=find(parseAst(m[2]),n=>n.type==='FunctionExpression'&&n.id?.name==='letreiroInvasao');if(found)code=m[2].slice(found.start,found.end);}
 assert(code);const name='Double Xp , Shiny 10 , Wild 2',raw='🎉 Evento: '+name+' · EXP ×3 · selvagens ×2',expected='⚡ 🎉 Event: '+name+' · EXP ×3 · wild Pokémon ×2',lt={style:{}},messages=[],el={classList:{remove(){}},querySelector:()=>lt};
 vm.runInNewContext('('+code+')(text)',{text:raw,I18n:I,document:{getElementById:id=>id==='letreiro-css'?{}:el},Chat:{sistema:txt=>messages.push(I.t(txt))},clearTimeout(){},setTimeout(){}});
 assert.equal(lt.textContent.trim(),expected);assert.deepEqual(messages,[expected]);
});

test('F-slot ball icons use the catalogue, including the shared Shiny Ball icon',async()=>{
 const html=await read('index.html'),catalogue=JSON.parse(await read('public/data/menus_dados.json')).itens;let code;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('importmap')){const found=find(parseAst(m[2]),n=>n.type==='FunctionDeclaration'&&n.id.name==='iconeBola');if(found)code=m[2].slice(found.start,found.end);}
 assert(code);const before=JSON.stringify(catalogue);
 for(const [id,item] of Object.entries(catalogue).filter(([,v])=>v.t===7)){
  const path=vm.runInNewContext(code+';iconeBola(id)',{ITENS_CATALOGO:catalogue,id});assert.equal(path,'./ui/itens/'+item.i+'.png');assert((await readFile(new URL('../'+path,import.meta.url))).length>0);
 }
 assert.equal(vm.runInNewContext(code+';iconeBola(1012)',{ITENS_CATALOGO:catalogue}),'./ui/itens/ic_1008.png');assert.equal(JSON.stringify(catalogue),before);
});
