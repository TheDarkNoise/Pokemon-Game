import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const source=await read('menus.mjs'),ast=parseAst(source),engine=await read('missoes.mjs'),engineAst=parseAst(engine);
const data=JSON.parse(await read('public/data/missoes.json')),D=JSON.parse(await read('public/data/menus_dados.json'));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}
const callCache=new Map();
const call=id=>{if(callCache.has(id))return callCache.get(id);const n=find(ast,n=>n.type==='CallExpression'&&n.callee.object?.name==='Popup'&&n.callee.property?.name==='texto'&&n.arguments[1]?.value===id);assert(n,id);const code=source.slice(n.start,n.end);callCache.set(id,code);return code};
const run=(code,ctx)=>{let text;vm.runInNewContext(code,{tr:I.t,Popup:{texto:(_,__,value)=>text=I.t(value)},pop:{},fa:{},g:{},linha:{},el:{},...ctx});return text};
const quests=data.capitulos.flatMap(c=>c.missoes.map(m=>({...m,capitulo:c.id,capNome:c.nome})));

test('actual popup calls translate all chapter names, objective locations and counted progress before adding decorations',()=>{
 assert.equal(data.capitulos.length,20);const before=JSON.stringify(data);
 const counter=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='cont'&&source.slice(n.start,n.end).includes('p2.n'));
 assert(counter);const countCode='const cont='+source.slice(counter.init.start,counter.init.end)+';';let steps=0;
 for(const c of data.capitulos){
  const ativa={capitulo:c.id,capNome:c.nome};
  assert.equal(run(call('capitulo-local'),{ativa}),'Chapter '+c.id+' · '+I.t(c.nome));
  assert.equal(run(call('capitulo-nome'),{c}),'Chapter '+c.id+' · '+I.t(c.nome));
  for(const m of c.missoes)for(const p2 of m.passos){
   steps++;
   assert.equal(run(call('objetivo-local'),{p2}),p2.onde?'('+I.t(p2.onde)+')':'');
   for(const [i,idx,prog]of [[0,0,1],[0,0,(p2.n||1)+5],[1,0,1]]){
    const count=i===idx&&p2.n>1?' '+Math.min(prog,p2.n)+'/'+p2.n:'';
    assert.equal(run(countCode+call('objetivo'),{p2,i,idx,prog}),I.t(p2.texto||'')+count);
   }
  }
 }
 assert.equal(steps,155);assert.equal(JSON.stringify(data),before);
 assert.equal(run(call('capitulo-local'),{ativa:{capitulo:1,capNome:'O Início da Jornada'}}),'Chapter 1 · The Beginning of Your Journey');
 assert.equal(run(call('objetivo-local'),{p2:{onde:'Cidade Pallet'}}),'(Pallet Town)');
});

test('actual quest summaries and rewards translate source fragments while retaining all item IDs and amounts',()=>{
 const fn=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='textoRecompensaMi'),helper=source.slice(fn.start,fn.end),before=JSON.stringify(quests);assert.equal(quests.length,56);
 for(const m of quests){
  const expected=[m.recompensa?.dinheiro?m.recompensa.dinheiro+' Coins':null,...Object.entries(m.recompensa?.itens||{}).map(([id,n])=>I.t(D.itens[id]?.n||'item '+id)+' ×'+n),m.recompensa?.exp?m.recompensa.exp+' XP':null].filter(Boolean).join(' · ')||'—';
  const result=run(helper+';'+call('missao-resumo'),{D,m});assert.equal(result,I.t(m.des||'')+' · reward: '+expected);assert(!result.includes('Moedas'));
  assert.equal(run(helper+';'+call('recompensa'),{D,ativa:m}),'Reward: '+expected);
 }
 assert.equal(vm.runInNewContext(helper+';textoRecompensaMi({})',{D,tr:I.t}),'—');assert.equal(JSON.stringify(quests),before);
});

test('actual quest completion notices translate all quest names without changing quest progress or reward callbacks',()=>{
 const fn=find(engineAst,n=>n.type==='FunctionDeclaration'&&n.id.name==='concluirMissao'),code=engine.slice(fn.start,fn.end);
 for(let i=0;i<quests.length;i++){
  const m=quests[i],next=quests[i+1]||null,state={atual:m.id,passo:2,feitas:[]},messages=[],paid=[];let saves=0,checks=0;
  vm.runInNewContext(code+';concluirMissao(m)',{m,estado:state,tr:I.t,proxima:id=>{assert.equal(id,m.id);return next},gravar:()=>saves++,checarImediatos:()=>checks++,ctx:{recompensa:(r,q)=>paid.push([r,q]),aviso:text=>messages.push(I.t(text))}});
  assert.equal(state.atual,next?.id??null);assert.equal(state.passo,0);assert.deepEqual(state.feitas,[m.id]);assert.equal(saves,1);assert.equal(checks,1);
  assert.equal(paid[0][0],m.recompensa);assert.equal(paid[0][1],m);assert.equal(messages[0],'🏁 Quest completed: '+I.t(m.nome));if(next)assert.equal(messages[1],'📜 New quest: '+I.t(next.nome));
 }
 const step=find(engineAst,n=>n.type==='CallExpression'&&n.callee.property?.name==='aviso'&&engine.slice(n.start,n.end).startsWith("ctx.aviso?.('✔ '"));assert(step);
 for(const m of quests)for(const p of m.passos){let message;vm.runInNewContext(engine.slice(step.start,step.end),{p,tr:I.t,ctx:{aviso:text=>message=I.t(text)}});assert.equal(message,'✔ '+I.t(p.texto||'step completed'));}
});

test('actual Pokédex collector summary and ranking suffix remain English with original counts and rank values',()=>{
 const base=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='base'&&source.slice(n.start,n.end).includes('Kanto Collector'));
 const ranked=find(ast,n=>n.type==='CallExpression'&&n.callee.property?.name==='texto'&&n.arguments[1]?.value==='colecionador'&&source.slice(n.start,n.end).includes('p.especies.pos'));
 assert(base&&ranked);const r={pegosKanto:5,kantoAte:151,vistosKanto:9,shinies:1},p={especies:{pos:2},total:8};
 const output=run('const base='+source.slice(base.init.start,base.init.end)+';'+source.slice(ranked.start,ranked.end),{r,p});
 assert.equal(output,'Kanto Collector · 5/151 caught · 9 seen · 1 shiny · rank 2 of 8');assert.equal(p.especies.pos,2);
});
