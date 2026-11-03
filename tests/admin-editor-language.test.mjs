import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
globalThis.addEventListener=()=>{};
const Arrastar=await import('../arrastar_time.mjs');

globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
async function source(name){const text=await readFile(new URL('../'+name,import.meta.url),'utf8');return{text,ast:parseAst(text)};}
function fn(s,name){const n=find(s.ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return s.text.slice(n.start,n.end);}
function arrow(s,name){const n=find(s.ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);assert(n,name);return 'const '+name+'='+s.text.slice(n.init.start,n.init.end)+';';}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const data=await source('admin/dados.mjs'),events=await source('admin/eventos.mjs');

test('actual data editor renders English save and reload guidance without changing schema or data',()=>{
 for(const recarga of ['vivo','reload']){
  const elements={'d-edit':{},'d-salvar':{},'d-descartar':{},'d-corpo':{append(){}}};
  const esq=Object.freeze({titulo:'Custom data',arquivo:'config_jogo',forma:'objeto',recarga}),dados=Object.freeze({densidade:1.5});let form;
  vm.runInNewContext(fn(data,'render')+';render()',{esq,dados,sujo:true,esc,$:id=>elements[id],salvar(){},document:{createElement:()=>({})},formulario:(el,value)=>{form=value;}});
  assert(elements['d-edit'].innerHTML.includes('● unsaved'));assert(elements['d-edit'].innerHTML.includes('File:'));assert(elements['d-edit'].innerHTML.includes('public/data/config_jogo.json'));assert(elements['d-edit'].innerHTML.includes(recarga==='vivo'?'applies changes immediately':'reload the game'));assert.equal(form,dados);
 }
});

test('actual data editor save preserves API method, route, payload keys and change notification',async()=>{
 const dados={1:[{item:2001,preco:300}]},calls=[],notices=[],changed=[];const dirty={hidden:false};
 const context={document:{querySelector:()=>null},esq:{titulo:'Shop',arquivo:'lojas'},dados,nomeAtual:'lojas',sujo:true,validarColecao:()=>({ok:true}),api:async(...args)=>{calls.push(args);return{ok:true,total:1};},$:()=>dirty,toast:s=>notices.push(s),avisarJogo:x=>changed.push(x)};
 await vm.runInNewContext(fn(data,'salvar')+';salvar()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['/admin/dados/lojas','POST',{dados}]]);assert.deepEqual(notices,['Shop: saved (1 record(s)).']);assert.deepEqual(changed,['lojas']);assert.equal(dirty.hidden,true);assert.equal(context.sujo,false);
});

test('actual event panel renders English maintenance controls and preserves custom text and field identifiers',()=>{
 const element={};const dados=Object.freeze({nome:'Meu evento particular',expMult:2,shinyMult:3,densidade:1.5,inicio:null,fim:null,manutencao:{ativa:true,inicio:null,texto:'Recado particular'}});
 const code=['multTxt','temEvent','campoMult'].map(n=>arrow(events,n)).join('\n')+fn(events,'render')+';render()';
 vm.runInNewContext(code,{dados,efetivo:dados,manutAgora:true,online:3,$:()=>element,esc,paraCampo:()=>'',dataHora:()=>'',ligar(){}});
 for(const text of ['MAINTENANCE ENABLED','only GMs can sign in','Wild Pokémon ×','Apply event','Maintenance mode','Disable maintenance','Meu evento particular','Recado particular','id="ev-densidade"','id="ev-minicio"'])assert(element.innerHTML.includes(text),text);
});

test('actual event apply handler retains server fields, custom event name and announcement flag',()=>{
 const values={'ev-atualizar':{},'ev-aplicar':{},'ev-encerrar':{},'ev-avisar':{},'ev-nome':{value:'My event'},'ev-expMult':{value:'2'},'ev-shinyMult':{value:'3'},'ev-densidade':{value:'1.5'},'ev-inicio':{value:''},'ev-fim':{value:''},'ev-anunciar':{checked:true}};
 const calls=[],dados={nome:'old',expMult:1,shinyMult:1,densidade:1,inicio:null,fim:null,manutencao:{ativa:false}};
 vm.runInNewContext(fn(events,'ligar')+';ligar();$("ev-aplicar").onclick()',{dados,$:id=>values[id]||null,document:{querySelectorAll:()=>[]},carregar(){},doCampo:v=>v||null,salvar:(...args)=>calls.push(args)});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[[{...dados,nome:'My event',expMult:2,shinyMult:3,densidade:1.5},{anunciar:true},'Event applied.']]);assert.equal(dados.nome,'old');
});

test('actual party restrictions retain blocked state and inventory while displaying English',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');let script;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('importmap')&&m[2].includes('function motivoArrastarTime('))script={text:m[2],ast:parseAst(m[2])};assert(script);
 const cases=[[{turno:{}},false,'You cannot reorder your party during a battle'],[{},true,'You cannot reorder your party during a trade'],[{raidArena:true},false,'You cannot reorder your party during a raid'],[{evoluindo:true},false,'Wait for the evolution to finish'],[{trocandoSeguidor:true},false,'Wait for the evolution to finish']];
 for(const [jogo,trade,expected] of cases){const time=[{uid:'1'},{uid:'2'}],caixa=[],notices=[],writes=[];const reason=vm.runInNewContext(fn(script,'motivoArrastarTime')+';motivoArrastarTime()',{jogo,Troca:{aberta:()=>trade}});Arrastar.instalar({time:()=>time,caixa:()=>caixa,motivo:()=>reason,avisar:s=>notices.push(I.t(s)),gravar:(...args)=>writes.push(args)});assert.equal(Arrastar.aplicar('time',0,'time',1),false);assert.deepEqual(notices,[expected]);assert.equal(writes.length,0);assert.deepEqual(time.map(p=>p.uid),['1','2']);assert.deepEqual(caixa,[]);}
 const p={nome:'Cancelar',lv:31};const raw=vm.runInNewContext(fn(script,'desobedece')+';desobedece(p)',{p,foraDoTeto:()=>false,tetoNivel:()=>30,proximoTeto:()=> 'vencer a Elite Four'});assert.equal(I.t('🔒 '+raw+'.'),'🔒 Cancelar will not obey: Lv 31 exceeds the Lv 30 cap — defeat the Elite Four.');
});

test('learnset display prefers English move name without modifying the source move fields',async()=>{
 const s=await source('admin/conteudo_learnset.mjs');const node=find(s.ast,n=>n.type==='VariableDeclarator'&&n.id.name==='descGolpe');const move=Object.freeze({nome:'Thunderbolt',nomePt:'Raio do Trovão',tipo:'Electric',cat:'especial',poder:90,pp:15});const text=vm.runInNewContext('('+s.text.slice(node.init.start,node.init.end)+')("thunderbolt")',{golpes:{thunderbolt:move},TIPOS:{Electric:'Electric'},CAT:{especial:'special'}});assert.equal(text,'Thunderbolt · Electric · special · power 90 · PP 15');assert.equal(move.nomePt,'Raio do Trovão');
});
