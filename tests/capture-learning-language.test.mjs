import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import * as Ind from '../individuo.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function jogarBola('))[2],ast=parseAst(source);
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}
const extract=n=>source.slice(n.start,n.end);
const fn=name=>{const n=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name)[0];assert(n,name);return extract(n)};
const calls=all(ast,n=>n.type==='CallExpression'&&(n.callee.name==='flutuar'||n.callee.object?.name==='Chat'&&n.callee.property?.name==='sistema'));
const call=text=>{const n=calls.find(n=>extract(n).includes(text));assert(n,text);return extract(n)};
const ballNode=all(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='BOLAS')[0],BOLAS=vm.runInNewContext('('+extract(ballNode.init)+')');
function notice(code,ctx){const out=[];vm.runInNewContext(code,{...ctx,I18n:I,ash:{},de:null,flutuar:(_,s)=>out.push(I.t(s)),Chat:{sistema:s=>out.push(I.t(s))}});assert.equal(out.length,1);return out[0];}

test('actual successful-capture summary translates all default balls and all 25 nature effects without changing the caught record',()=>{
 const summary=call("'! Natureza '"),short=call("'capturou ' + s.nome");
 for(const [id,[ball]]of Object.entries(BOLAS))for(const [nature,up,down]of Ind.NATUREZAS){
  const s={nome:'Moeda',lv:17,natureza:nature,ivs:[1,2,3,4,5,6]},before=JSON.stringify(s),stats=['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'],effect=up===down?'neutral':'+'+stats[up]+' −'+stats[down];
  const desc={...Ind,somaIV:()=>21,IV_TOTAL:186};
  assert.equal(notice(summary,{s,id,BOLAS,Ind:desc}),`Caught Moeda Lv17 with ${I.t(ball)}! Nature ${nature} (${effect}), IV 21/186.`);
  assert.equal(notice(short,{s}),'caught Moeda!');assert.equal(JSON.stringify(s),before);
 }
});

test('actual capture failures translate all shake counts and retain species, ball and trainer names',()=>{
 const floating=call("'escapou! ('"),chat=call("s.nome + ' escapou da '"),otherSuccess=call("' capturou ' + s.nome"),otherFailure=call("'escapou da bola de '");
 for(const chac of [0,1,2,3])for(const [id,[ball]]of Object.entries(BOLAS)){
  const s={nome:'Pedra'},ending=chac===1?'shake':'shakes';
  assert.equal(notice(floating,{s,chac}),`escaped! (${chac} ${ending})`);
  assert.equal(notice(chat,{s,chac,id,BOLAS}),`Pedra escaped from the ${I.t(ball)} (${chac} ${ending}).`);
 }
 for(const trainer of ['Moeda','Cancelar','João, Jr.',null]){
  const m={por:trainer},s={nome:'Pedra'},before=JSON.stringify({m,s});
  assert.equal(notice(otherSuccess,{m,s}),(trainer||'someone')+' caught Pedra!');
  assert.equal(notice(otherFailure,{m,s}),'escaped from '+(trainer||'someone')+'’s ball');assert.equal(JSON.stringify({m,s}),before);
 }
});

test('actual empty-ball guard translates all default balls before throwing and changes no inventory or target state',async()=>{
 for(const [id,[name]]of Object.entries(BOLAS)){
  const jogo={ash:{},alvo:{estado:'desmaiado'},bolaSel:id,bolas:{[id]:0}},before=JSON.stringify(jogo),messages=[];
  await vm.runInNewContext(fn('jogarBola')+';jogarBola()',{jogo,BOLAS,I18n:I,flutuar:(_,s)=>messages.push(I.t(s))});
  assert.deepEqual(messages,['no '+I.t(name)+' left']);assert.equal(JSON.stringify(jogo),before);
 }
});

test('actual level-up learning retains move IDs, PP and pending queues while translating learned and pending messages',()=>{
 for(const count of [1,4]){
  const p={dex:25,nome:'Moeda',lv:10,movs:Array.from({length:count},(_,i)=>({id:'old'+i,pp:3,ppMax:15}))},messages=[];
  const scope={p,GOLPES:{new:{nome:'Thunder Shock'}},Ind:{aprendeEm:()=>['new'],novoGolpe:id=>({id,pp:30,ppMax:30}),idsDe:p=>p.movs.map(m=>m.id)},Chat:{sistema:s=>messages.push(I.t(s))},flutuar:(_,s)=>messages.push(I.t(s))};
  vm.runInNewContext(fn('aprenderNoNivel')+';aprenderNoNivel(p)',scope);
  assert.equal(p.nome,'Moeda');assert.equal(p.movs[0].pp,3);
  if(count===1){assert.deepEqual(messages,['Moeda learned Thunder Shock!','learned Thunder Shock!']);assert.equal(p.movs[1].id,'new');assert.equal(p.movs[1].pp,30);}
  else{assert.deepEqual(messages,['✧ Moeda wants to learn Thunder Shock — choose a move to forget in the Pokémon window.','wants to learn Thunder Shock!']);assert.deepEqual(Array.from(p.aprender),['new']);assert.equal(p.movs.length,4);}
 }
});

test('actual move replacement, refusal and free-slot learning keep nicknames and PP-memory behavior',()=>{
 for(const slot of [-1,0,1])for(const active of [false,true]){
  const target={dex:25,nome:'Pedra',movs:[{id:'old',pp:3,ppMax:15}],aprender:['new']},saved=[],forgotten=[],messages=[];
  const Ind={garantirMovs(){},golpeLembrado:(_,id)=>({id,pp:7,ppMax:30}),esquecerGolpe:(_,move)=>forgotten.push(move.id),idsDe:t=>t.movs.map(m=>m.id)};
  const scope={jogo:{pika:active?target:null,time:[target]},e:{seguindo:active},registroDoTime:()=>target,fallbackGolpes:()=>[],Ind,GOLPES:{old:{nome:'Tackle'},new:{nome:'Thunder Shock'}},slot,Chat:{sistema:s=>messages.push(I.t(s))},gravarLS:(...a)=>saved.push(a),guardarEstadoAtivo:()=>saved.push(['active']),pintarTime(){}};
  assert.equal(vm.runInNewContext(fn('aprenderGolpe')+";aprenderGolpe(e,'new',slot)",scope),true);
  assert.deepEqual(Array.from(target.aprender),[]);assert.equal(target.nome,'Pedra');assert.equal(saved.length,1);
  if(slot===-1){assert.deepEqual(messages,['Pedra did not learn Thunder Shock.']);assert.equal(target.movs[0].id,'old');assert.deepEqual(Array.from(target.recusados),['new']);}
  else if(slot===0){assert.deepEqual(messages,['Pedra forgot Tackle and learned Thunder Shock!']);assert.deepEqual(forgotten,['old']);assert.equal(target.movs[0].id,'new');assert.equal(target.movs[0].pp,7);}
  else{assert.deepEqual(messages,['Pedra learned Thunder Shock!']);assert.equal(target.movs[0].pp,3);assert.equal(target.movs[1].id,'new');}
 }
});

test('actual starter, knockout and Coin reward messages retain names and counts',()=>{
 assert.equal(notice(call("'recebeu ' + o.nome"),{jogo:{ash:{}},o:{nome:'Moeda'}}),'received Moeda!');
 assert.equal(notice(call("'Recebeu ' + o.nome"),{o:{nome:'Moeda'}}),'Received Moeda from Professor Oak!');
 assert.equal(notice(call("s.nome + ' caiu!'"),{s:{nome:'Pedra'}}),'Pedra fainted!');
 const rewards=calls.filter(n=>extract(n).includes("'+' +")&&extract(n).includes("' Moedas'"));assert(rewards.length>=3);
 for(const n of rewards)assert.equal(notice(extract(n),{jogo:{ash:{}},moedas:500,ganho:500,g:500,E:{ordem:1}}),'+500 Coins');
 assert.equal(I.t('Moeda foi pra caixa (time cheio).'),'Moeda was sent to storage (party full).');
});

test('actual intro skip label respects the selected language and keeps the skip action',async()=>{
 const label=all(ast,n=>n.type==='AssignmentExpression'&&n.left.object?.name==='pular'&&n.left.property?.name==='textContent')[0];
 const handler=all(ast,n=>n.type==='AssignmentExpression'&&n.left.object?.name==='pular'&&n.left.property?.name==='onclick')[0];assert(label&&handler);
 for(const lang of ['en','pt']){
  await I.carregar(lang);let skipped=0;const pular={};vm.runInNewContext(extract(label)+';'+extract(handler),{pular,I18n:I,terminarIntro:()=>skipped++});
  assert.equal(pular.textContent,lang==='en'?'Skip ▸':'Pular ▸');pular.onclick();assert.equal(skipped,1);
 }
 await I.carregar('en');
});
