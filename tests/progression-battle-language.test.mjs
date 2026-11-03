import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function guardarReserva('))[2],ast=parseAst(source);
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}
const code=name=>{const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end)};

test('actual bench level-up and XP-cap calculation retain XP, reserve and HP behavior while translating the notice',()=>{
 for(const capped of [false,true]){
  const tr={dex:25,nome:'Moeda',lv:capped?3:1,exp:capped?390:190,hp:capped?25:10,maxHp:capped?40:20,movs:[]},messages=[];
  const scope={tr,n:capped?40:20,tetoNivel:()=>3,foraDoTeto:()=>false,Evolucao:{pronto:()=>true,expPara:(_,lv)=>lv*100},Ind:{garantir(){},garantirMovs(){},hpDe:(_,p)=>10+p.lv*10},fallbackGolpes:()=>[],porDex:new Map([[25,{}]]),aprenderNoNivel(){},Chat:{sistema:s=>messages.push(I.t(s))}};
  const result=vm.runInNewContext(code('guardarReserva')+';'+code('subirRegistro')+';subirRegistro(tr,n)',scope);
  assert.equal(tr.nome,'Moeda');assert.equal(tr.lv,capped?3:2);assert.equal(tr.exp,capped?399:210);assert.equal(tr.expReserva||0,capped?31:0);assert.equal(tr.hp,capped?25:20);assert.equal(result,capped?0:1);
  assert.deepEqual(messages,capped?[]:['Moeda reached Lv 2!']);
 }
});

test('actual stored-XP warning translates both messages, preserves the nickname and retains its one-minute throttle',()=>{
 const p={nome:'Pedra',expReserva:450},before=JSON.stringify(p),floating=[],chat=[];
 const scope={p,tetoNivel:()=>70,proximoTeto:()=> 'vencer a Elite Four',avisoReservaEm:0,Date:{now:()=>100000},flutuar:(_,s)=>floating.push(I.t(s)),Chat:{sistema:s=>chat.push(I.t(s))}};vm.createContext(scope);
 vm.runInContext(code('avisarReserva')+';avisarReserva(p,25);avisarReserva(p,25)',scope);
 assert.deepEqual(floating,['🔒 Lv 70 cap · 25 XP stored','🔒 Lv 70 cap · 25 XP stored']);assert.deepEqual(chat,['🔒 Pedra reached the Lv 70 cap: XP is stored (450) and released after you defeat the Elite Four.']);assert.equal(JSON.stringify(p),before);assert.equal(scope.avisoReservaEm,100000);
});

test('actual trainer send-out notice preserves custom names and the trainer battle state',async()=>{
 const T={idx:-1,info:{nome:'Moeda',time:[{dex:25,glb:'pm0025_00',lv:17}]},npc:{},ponto:()=>({x:2,z:3})},jogo={turno:T,ash:{x:0,z:0},pika:{},selvagens:[]},messages=[],created=[];
 const scope={jogo,porDex:new Map([[25,{name:'Pedra'}]]),livre:()=>true,criarSelvagem:async(...a)=>{created.push(a);return{nome:a[0].nome,lv:a[3].lv,pivo:{visible:true}}},GOLPES_ESPECIE:{25:['thunder-shock']},GOLPES:{'thunder-shock':{id:'thunder-shock'}},tocarUma(){},bolaLancada:async()=>{},efeito(){},Chat:{sistema:s=>messages.push(I.t(s))}};
 assert.equal(await vm.runInNewContext(code('proximoInimigoTurno')+';proximoInimigoTurno()',scope),true);
 assert.deepEqual(messages,['Moeda sent out Pedra Lv17!']);assert.equal(T.idx,0);assert.equal(T.caiu,false);assert.equal(T.inimigo,jogo.alvo);assert.equal(T.inimigo,jogo.selvagens[0]);assert.equal(T.inimigo.estado,'turno');assert.equal(T.inimigo.golpes[0].id,'thunder-shock');assert.equal(created[0][0].glb,'pm0025_00.glb');assert.equal(created[0][3].lv,17);
});

test('actual attack guard keeps fainted/captured target names and spends no move',()=>{
 for(const state of ['desmaiado','capturando'])for(const boss of [false,true]){
  const alvo={nome:'Moeda',estado:state,chefe:boss},jogo={pika:{hp:20,recargas:{}},alvo},before=JSON.stringify(jogo),messages=[];
  vm.runInNewContext(code('usarGolpe')+";usarGolpe('tackle')",{jogo,Ind:{semPP:()=>false,temPP:()=>true},GOLPES:{tackle:{id:'tackle',nome:'Tackle'}},flutuar:(_,s)=>messages.push(I.t(s))});
  assert.deepEqual(messages,[state==='capturando'?'Moeda is already in its ball':boss?'Moeda has already fainted':'Moeda has fainted — press F to catch it']);assert.equal(JSON.stringify(jogo),before);
 }
});

test('actual distance/capture notices and evolution hints translate while preserving target names',()=>{
 for(const [fragment,ctx,expected]of [
  ["'longe demais ('",{dist:12.4},'too far away (12 m)'],
  ["' acordou antes da bola chegar",{s:{nome:'Moeda'}},'Moeda woke up before the ball arrived — knock it out again and throw quickly.']
 ]){
  const n=find(ast,n=>n.type==='CallExpression'&&(n.callee.name==='flutuar'||n.callee.object?.name==='Chat')&&source.slice(n.start,n.end).includes(fragment));assert(n);let actual;
  vm.runInNewContext(source.slice(n.start,n.end),{...ctx,ash:{},flutuar:(_,s)=>actual=I.t(s),Chat:{sistema:s=>actual=I.t(s)}});assert.equal(actual,expected);
 }
 for(const [raw,en]of [
  ['Pedra nada do seu lado','Pedra swims beside you'],['Pedra está longe','Pedra is too far away'],['Pedra não obedece! (teto Lv 20)','Pedra disobeys! (Lv 20 cap)'],
  ['Pedra do Trovão não tem efeito em Moeda','Thunder Stone has no effect on Moeda'],
  ['✧ Moeda já pode evoluir para Raichu (usa Pedra do Trovão)!','✧ Moeda can now evolve into Raichu (uses Thunder Stone)!'],
  ['✧ Moeda já pode evoluir para Vaporeon, Jolteon — escolha no ✧ da grade.','✧ Moeda can now evolve into Vaporeon, Jolteon — choose using ✧ in the grid.']
 ])assert.equal(I.t(raw),en);
});

test('actual raid with no arrivals ends with an English notice and does not start a boss battle',async()=>{
 const s=await read('servidor_raid.mjs'),n=find(parseAst(s),n=>n.type==='FunctionDeclaration'&&n.id.name==='lutar');assert(n);
 const raid={cfg:{chefeNome:'Moeda'},fila:new Map([['u',{chegou:false}]])},before=JSON.stringify({...raid,fila:[...raid.fila]}),messages=[];let finished=0;
 vm.runInNewContext(s.slice(n.start,n.end)+';lutar()',{raid,todos:s=>messages.push(I.t(s)),terminar:()=>finished++});
 assert.deepEqual(messages,['The Moeda raid ended: no one reached the arena.']);assert.equal(finished,1);assert.equal(JSON.stringify({...raid,fila:[...raid.fila]}),before);
});
