import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {criarTradutor} from '../admin/mensagens.mjs';

globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const value of Object.values(node))if(value&&typeof value==='object')for(const child of Array.isArray(value)?value:[value]){const hit=find(child,predicate);if(hit)return hit;}return null;}
const raidSource=await readFile(new URL('../servidor_raid.mjs',import.meta.url),'utf8'),raidAst=parseAst(raidSource),status=find(raidAst,n=>n.type==='FunctionDeclaration'&&n.id.name==='status');

test('actual raid summaries translate phases, boss HP, reward modes and both optional timers',()=>{
 const phases={anunciada:'announced',contagem:'countdown',indo:'moving',luta:'battle',fim:'ending'};
 for(const [phase,label] of Object.entries(phases))for(const boss of [false,true])for(const queue of [false,true])for(const reward of ['mew','sem-mew'])for(const timer of ['none','countdown','remaining','both']){
  const raid={id:7,fase:phase,cfg:{vagas:10,chefeNome:'Mew',chefeHp:1000},sobre:{hp:null},chefe:boss?{hp:850,maxHp:1000}:null,fila:new Map(queue?[['a',{nome:'contagem',dano:20,ida:true,chegou:false}],['b',{nome:'João, Jr.',dano:0,ida:false,chegou:true}]]:[])};
  const r={contagemMs:['countdown','both'].includes(timer)?14500:0,fimMs:['remaining','both'].includes(timer)?20900:0},before=JSON.stringify({...raid,fila:[...raid.fila]});
  const raw=vm.runInNewContext(raidSource.slice(status.start,status.end)+';status()',{raid,retrato:()=>r,danoRaid:()=>1.5,taxaRaid:()=>100,premioRaid:()=>reward});
  const en=I.t('🐉 '+raw),queueText=queue?'2/10 (contagem 20 en route, João, Jr.)':'0/10';
  let expected=`🐉 Raid #7 · ${label} · queue ${queueText} · ${boss?'Mew 850/1000':'HP 1000'} · damage ×1.5 · Shiny 1/100 · reward ${reward==='mew'?'Pokémon + items':'items only'}`;
  if(r.contagemMs)expected+=' · starts in 15 s';if(r.fimMs)expected+=' · 21 s remaining';
  assert.equal(en,expected);assert.equal(JSON.stringify({...raid,fila:[...raid.fila]}),before);
 }
});

test('all actual event multiplier combinations translate without translating the custom event name',async()=>{
 const source=await readFile(new URL('../servidor_eventos.mjs',import.meta.url),'utf8'),ast=parseAst(source),node=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='textoMult');assert(node);
 for(const exp of [1,2])for(const shiny of [1,3])for(const wild of [1,1.5]){
  if(exp===1&&shiny===1&&wild===1)continue;
  const e={expMult:exp,shinyMult:shiny,densidade:wild};
  const suffix=vm.runInNewContext('('+source.slice(node.init.start,node.init.end)+')(e)',{e});
  const raw='🎉 Evento: Cancelar'+suffix;
  let expected='🎉 Event: Cancelar';if(exp!==1)expected+=' · EXP ×2';if(shiny!==1)expected+=' · Shiny ×3';if(wild!==1)expected+=' · wild Pokémon ×1.5';assert.equal(I.t(raw),expected);
 }
 assert.equal(I.t('🎉 O evento "Cancelar" acabou. Obrigado por jogar!'),'🎉 The event "Cancelar" has ended. Thanks for playing!');
 assert.equal(I.t('🎉 O evento acabou. Obrigado por jogar!'),'🎉 The event has ended. Thanks for playing!');
});

test('suspension and disconnect notices preserve free-text reasons even when they match a dictionary key',async()=>{
 const dictionary=JSON.parse(await readFile(new URL('../public/data/idioma/ui_en.json',import.meta.url),'utf8'));
 for(const translate of [I.t,criarTradutor(dictionary)])for(const reason of ['Cancelar','contagem','comentário particular: João · 17']){
  assert.equal(translate('Sua conta foi suspensa para sempre. Motivo: '+reason),'Your account has been permanently suspended. Reason: '+reason);
  assert.equal(translate('Conta suspensa até 03/11/2026, 08:00:00. Motivo: '+reason),'Account suspended until 03/11/2026, 08:00:00. Reason: '+reason);
  assert.equal(translate('Você foi desconectado por um GM. Motivo: '+reason),'You were disconnected by a GM. Reason: '+reason);
 }
 assert.equal(I.t('🧭 Um GM levou você para perto de Cancelar…'),'🧭 A GM moved you near Cancelar…');
 assert.equal(I.t('⚠ Cidade desconhecida: Cancelar (use pallet, viridian).'),'⚠ Unknown city: Cancelar (use pallet, viridian).');
 assert.equal(I.t('📩 GM: Cancelar'),'📩 GM: Cancelar');assert.equal(I.t('📢 recado particular'),'📢 recado particular');
});

test('raw translation slots preserve braces and Portuguese mode while ordinary slots still translate',async()=>{
 assert.equal(I.t('🎉 Evento: {Cancelar} · EXP ×2'),'🎉 Event: {Cancelar} · EXP ×2');
 assert.equal(I.t('Prêmio: só itens.'),'Reward: items only.');
 const raw='Sua conta foi suspensa para sempre. Motivo: Cancelar';await I.carregar('pt');assert.equal(I.t(raw),raw);await I.carregar('en');
});
