import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
function nodes(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])nodes(c,p,out);return out;}
const popup=await read('popup.mjs'),pa=parseAst(popup),fn=name=>{const n=nodes(pa,n=>n.type==='FunctionDeclaration'&&n.id.name===name)[0];assert(n,name);return popup.slice(n.start,n.end)};
const popupCode=fn('texto')+'\n'+fn('textoBruto');

test('actual raw popup writer preserves messages, Unicode and literal markup while normal labels still translate',async()=>{
 const el={textContent:'',style:{whiteSpace:'normal'},dataset:{}};let sizes=0;
 const ctx={tr:I.t,noDe:()=>el,Hud:{encolher:()=>sizes++},document:{},pop:{}};vm.createContext(ctx);vm.runInContext(popupCode,ctx);
 for(const text of ['Moeda','Cidade Pallet','こんにちは 🌟','<img src=x onerror=alert(1)>','first\nsecond']){
  ctx.text=text;vm.runInContext("textoBruto(pop,'message',text)",ctx);assert.equal(el.textContent,text);
  const before=sizes;vm.runInContext("textoBruto(pop,'message',text)",ctx);assert.equal(sizes,before);
 }
 assert.equal(el.style.whiteSpace,'pre-line');ctx.text='Moeda';vm.runInContext("textoBruto(pop,'message',text)",ctx);assert.equal(el.style.whiteSpace,'normal');assert.equal(el.dataset.preLinha,undefined);
 vm.runInContext("texto(pop,'item','Moeda')",ctx);assert.equal(el.textContent,'Coin');
 vm.runInContext("textoBruto(pop,'message',null)",ctx);assert.equal(el.textContent,'');vm.runInContext("textoBruto(pop,'message',0)",ctx);assert.equal(el.textContent,'0');
 ctx.document.fonts={status:'loading',ready:Promise.resolve()};const before=sizes;vm.runInContext("textoBruto(pop,'message','font check')",ctx);await Promise.resolve();assert.equal(sizes,before+2);
});

test('all actual player-name and message-preview popup calls use the verbatim writer',async()=>{
 const source=await read('menus.mjs'),ast=parseAst(source),calls=nodes(ast,n=>n.type==='CallExpression'&&n.callee.object?.name==='Popup'&&n.callee.property?.name==='textoBruto');assert.equal(calls.length,12);
 const expected={'item-nome':'Moeda','ficha-nome':'Moeda','jogador-nome':'Moeda',inicial:'Moeda','pokemon-nome':'Moeda','solicitante-nome':'Moeda','conversa-nome':'Cidade Pallet','ultima-mensagem':'Moeda','amigo-nome':'Moeda',nome:'Abra','especie-nome':'Abra'};
 for(const call of calls){
  const fields=new Map();const ctx={tr:I.t,noDe:(_,__,id)=>{if(!fields.has(id))fields.set(id,{textContent:'',style:{whiteSpace:'normal'},dataset:{}});return fields.get(id)},Hud:{encolher(){}},document:{},pop:{},p:{nome:'Moeda',nick:'Moeda',shiny:false},e:{nome:'Moeda',shiny:false},v:{nick:'Cidade Pallet',ultima:'Moeda'},a:{nick:'Moeda'},ctx:{nome:'Moeda'},ini:{nome:'Moeda'},st:'pego',s:{name:'Abra'},S:{name:'Abra'},nv:1,visto:true,it:{},f:{},c:{}};
  vm.createContext(ctx);vm.runInContext(popupCode+';const Popup={textoBruto};'+source.slice(call.start,call.end),ctx);
  const id=call.arguments[1].value;assert.equal(fields.get(id)?.textContent,expected[id],id);
 }
});

test('own and remote player nameplates bypass translation while NPC labels and earned titles still translate',async()=>{
 const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function rotuloSprite('))[2],ast=parseAst(source);
 const sprite=nodes(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='rotuloSprite')[0];
 const params=sprite.params.map(n=>source.slice(n.start,n.end)).join(','),head=sprite.body.body.slice(0,2).map(n=>source.slice(n.start,n.end)).join('\n');
 const raw=vm.runInNewContext('function label('+params+'){'+head+';return {txt,sub}};label("Moeda",undefined,undefined,"Caçador de Shiny",undefined,false)',{I18n:I});
 assert.equal(raw.txt,'Moeda');assert.equal(raw.sub,'<'+I.t('Caçador de Shiny')+'>');
 assert.equal(vm.runInNewContext('function label('+params+'){'+head+';return txt};label("Moeda")',{I18n:I}),'Coin');
 const own=nodes(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='rotularJogador')[0];let args;
 vm.runInNewContext(source.slice(own.start,own.end)+';rotularJogador()',{jogo:{ash:{pivo:{add(){}},altura:1.5}},Conta:{comCargo:name=>({texto:name,cor:'#123456'})},nomeJogador:()=>'Moeda',Conhecimento:{tituloAtual:()=>''},rotuloSprite:(...a)=>{args=a;return{position:{set(){}}}}});
 assert.equal(args[0],'Moeda');assert.equal(args[5],false);
 const network=await read('rede.mjs'),remote=nodes(parseAst(network),n=>n.type==='FunctionDeclaration'&&n.id.name==='etiquetar')[0];
 vm.runInNewContext(network.slice(remote.start,remote.end)+';etiquetar(o)',{o:{nome:'Cidade Pallet',titulo:'Caçador de Shiny',ent:{altura:1.5,pivo:{add(){}}}},Conta:{comCargo:name=>({texto:name,cor:'#123456'})},ctx:{rotuloSprite:(...a)=>{args=a;return{position:{}}}}});
 assert.equal(args[0],'Cidade Pallet');assert.equal(args[3],'Caçador de Shiny');assert.equal(args[5],false);
});

test('actual Pokédex state row shows caught, seen and unknown without changing saved state identifiers',async()=>{
 const source=await read('menus.mjs'),call=nodes(parseAst(source),n=>n.type==='CallExpression'&&n.callee.property?.name==='texto'&&n.arguments[1]?.value==='especie-visto')[0];
 for(const [st,expected]of [['pego','· caught'],['visto','· seen'],[null,'· unknown']]){
  let value;vm.runInNewContext(source.slice(call.start,call.end),{st,pop:{},Popup:{texto:(_,__,text)=>value=I.t(text)}});assert.equal(value,expected);
 }
});
