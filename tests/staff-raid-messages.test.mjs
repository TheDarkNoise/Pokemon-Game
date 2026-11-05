import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';

globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
const source=await readFile(new URL('../servidor_raid.mjs',import.meta.url),'utf8');
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const value of Object.values(node))if(value&&typeof value==='object'){for(const child of Array.isArray(value)?value:[value]){const hit=find(child,predicate);if(hit)return hit;}}return null;}
const ast=parseAst(source);
const command=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='comando');assert(command);
function run(op,valor,{gm=true,raid={fase:'anunciada',sobre:{},fila:new Map(),cfg:{chefeNome:'Mew'}}}={}){
 const raw=[],logs=[];
 const ctx={sessoes:new Map([['test-token','admin']]),contas:{admin:{gm}},raid,semAcento:s=>String(s||'').toLowerCase(),OP_ALIAS:{},sistema:(ws,s)=>raw.push(s),logAdmin:(...args)=>logs.push(args),m:{op,valor},ws:{_info:{token:'test-token'}}};
 vm.runInNewContext(source.slice(command.start,command.end)+';comando(ws,m)',ctx);
 return{raw,english:raw.map(I.t),logs,raid};
}

test('actual staff raid refusals translate with prefixes, command spellings and phase values preserved',()=>{
 const cases=[['anunciar',null,{},'⚠ A raid already exists (announced). Use /raid cancelar first.'],['comecar',null,{},'⚠ No one is in the queue yet.'],['hp',0,{},'⚠ Usage: /raid hp N (1 to 10 million) or /raid hp auto.'],['dano',11,{},'⚠ Usage: /raid dano F (0 to 10; 1 = normal, 0 = minimum, 1 damage).'],['anunciar',null,{gm:false},'⚠ Only staff can manage the raid.'],['comecar',null,{raid:null},'⚠ No raid is active. Use /raid anunciar first.']];
 for(const [op,value,options,expected] of cases){const r=run(op,value,options);assert.deepEqual(r.english,[expected]);assert.equal(r.logs.length,0);if(r.raid)assert.deepEqual(r.raid.sobre,{});}
});

test('actual successful raid commands retain their state changes and audit payloads',()=>{
 const damage=run('dano',1.5);assert.deepEqual(damage.english,['🐉 Boss damage ×1.5.']);assert.equal(damage.raid.sobre.dano,1.5);assert.equal(damage.logs[0][2],'raid dano');assert.equal(damage.logs[0][3].depois.dano,1.5);
 const shiny=run('shiny',100);assert.deepEqual(shiny.english,['🐉 Reward Shiny chance: 1 in 100.']);assert.equal(shiny.raid.sobre.shiny,100);
 const reward=run('premio','sem-mew');assert.deepEqual(reward.english,['🐉 Reward: items only.']);assert.equal(reward.raid.sobre.premio,'sem-mew');
 const boss=run('premio','mew');assert.deepEqual(boss.english,['🐉 Reward: Mew + items.']);assert.equal(boss.raid.sobre.premio,'mew');
});

test('live raid announcement and queue messages preserve species, levels, places and player names',()=>{
 const examples=[['📢 RAID: um Mew Lv 70 apareceu! Entre na fila pelo botão RAID (10 vagas).','📢 RAID: a Lv 70 Mew appeared! Join the queue using the RAID button (10 places).'],['A raid do Mew começa em 15 s!','The Mew raid starts in 15 s!'],['Você entrou na fila da raid do Mew (2/10).','You joined the Mew raid queue (2/10).'],['Você saiu da fila da raid.','You left the raid queue.'],['🐉 Raid #7 anunciada: Mew Lv 70, 10 vagas. /raid comecar abre a contagem.','🐉 Raid #7 announced: Lv 70 Mew, 10 places. /raid comecar starts the countdown.'],['🔊 chris_7 pode falar de novo.','🔊 chris_7 can speak again.']];
 for(const [raw,english] of examples)assert.equal(I.t(raw),english);
 const status=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='status');const raw=vm.runInNewContext(source.slice(status.start,status.end)+';status()',{raid:null,lerCfg:()=>({chefeNome:'Mew',chefeNivel:70,vagas:10,arena:'4120009'})});assert.equal(I.t('🐉 '+raw),'🐉 No raid is active (defaults from data/raid.json: Lv 70 Mew, 10 places, arena 4120009).');
});

test('actual moderation response adds punctuation before English lookup without changing user identifiers',async()=>{
 const s=await readFile(new URL('../rede.mjs',import.meta.url),'utf8');const block=find(parseAst(s),n=>n.type==='SwitchCase'&&n.test?.value==='mod_erro').consequent[0];
 for(const [erro,expected] of [['Conta "chris_7" não encontrada','⚠ Account "chris_7" not found.'],['Isso não pode ser feito na sua própria conta','⚠ You cannot do this to your own account.'],['chris_7 não está online','⚠ chris_7 is not online.']]){const notices=[];vm.runInNewContext('(()=>'+s.slice(block.start,block.end)+')()',{ctx:{Chat:{sistema:s=>notices.push(I.t(s))}},m:{t:'mod_erro',erro}});assert.deepEqual(notices,[expected]);}
 assert.equal(I.t('📩 GM: encontro na cidade'),'📩 GM: encontro na cidade');
 await I.carregar('pt');assert.equal(I.t('🐉 Prêmio: só itens.'),'🐉 Prêmio: só itens.');await I.carregar('en');
});
