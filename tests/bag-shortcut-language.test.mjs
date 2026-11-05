import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>({ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))});
const I=await import('../i18n.mjs');await I.carregar('en');
const source=await read('menus.mjs'),ast=parseAst(source);
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}
const fn=name=>{const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n);return source.slice(n.start,n.end)};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

test('bag evolution refusal translates only the item and leaves nicknames and inventory unchanged',()=>{
 const item={id:'3010',it:{n:'Pedra do Trovão',t:9}},notices=[],calls=[];
 const ctx={jogo:{pika:{nome:'Pedra'}},ehItemDeEvolucao:()=>true,usarItemEvolucao:()=>calls.push('evolve')};
 const before=JSON.stringify({item,ctx});
 vm.runInNewContext(fn('acaoMochila')+`;acaoMochila('usar')`,{itensMochila:()=>[item],selMo:0,confirmarDescarte:null,ctx,podeUsarMo:()=>true,evoluiAgoraMo:()=>false,tr:I.t,avisarMo:(id,s)=>notices.push([id,s]),render(){}});
 assert.deepEqual(notices,[['3010','Thunder Stone has no effect on Pedra']]);assert.equal(calls.length,0);assert.equal(JSON.stringify({item,ctx}),before);
});

test('discard confirmation still requires two clicks and sends the original item ID',()=>{
 const item={id:'2001',it:{n:'Poção',t:9}},requests=[],notices=[];let renders=0;
 const ctx={jogo:{ash:{}},comConta:()=>true,bolsaOp:(...a)=>{requests.push(a);return Promise.resolve()},flutuar:(_,s)=>notices.push(s)};
 const scope={itensMochila:()=>[item],selMo:0,confirmarDescarte:null,ctx,podeDescartarMo:()=>true,tr:I.t,render:()=>renders++};vm.createContext(scope);
 vm.runInContext(fn('acaoMochila')+`;acaoMochila('descartar')`,scope);assert.equal(requests.length,0);assert.equal(scope.confirmarDescarte,'2001');
 vm.runInContext(`acaoMochila('descartar')`,scope);
 assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['descartar',{item:2001}]]);assert.deepEqual(notices,['discarded Potion']);assert.equal(scope.confirmarDescarte,null);assert(renders>=2);assert.equal(item.it.n,'Poção');
});

test('evolution double-tap warning translates item data without changing its source',()=>{
 const call=find(ast,n=>n.type==='CallExpression'&&n.callee.name==='avisarMo'&&source.slice(n.start,n.end).includes('Evolution cannot be undone'));assert(call);
 const e2={id:'3010',it:{n:'Pedra do Trovão'}},notices=[];
 vm.runInNewContext(source.slice(call.start,call.end),{e2,tr:I.t,avisarMo:(id,s)=>notices.push([id,s])});
 assert.deepEqual(notices,[['3010','Evolution cannot be undone: do it again to use Thunder Stone']]);assert.equal(e2.it.n,'Pedra do Trovão');
});

test('actual shortcut picker translates item slots, preserves mount names and stores original item data',()=>{
 for(const atual of [null,{tipo:'item',nome:'Poção'},{tipo:'montaria',nome:'Pedra'}])for(const aba of ['itens','montarias']){
  const pinned=[],button={dataset:{item:'2001'}},clear={},corpo={innerHTML:'',querySelectorAll:()=>aba==='itens'?[button]:[],querySelector:()=>clear,insertAdjacentHTML(_,s){this.innerHTML+=s}};
  const ctx={atalhos:()=>[atual],definirAtalho:(...a)=>pinned.push(a),montarias:()=>[{nome:'Pedra',glb:'original/path.glb',voa:false}],dexDoGlb:()=>25};
  const item={n:'Poção',t:9,i:12},before=JSON.stringify({atual,item});
  vm.runInNewContext(fn('rAtalho')+';rAtalho(corpo)',{ctx,corpo,slotAtalho:0,$:()=>({}),abas:()=>aba,quantidades:()=>({2001:2}),D:{itens:{2001:item},tipos:{9:'Remédios'}},iconeItem:()=>'',tr:I.t,esc,fechar(){}});
  if(atual)assert(corpo.innerHTML.includes('current: <b>'+(atual.tipo==='item'?'Potion':'Pedra')+'</b>'));else assert(corpo.innerHTML.includes('empty slot'));
  if(aba==='itens'){button.onclick();assert.deepEqual(JSON.parse(JSON.stringify(pinned)),[[0,{tipo:'item',id:2001,nome:'Poção',icone:'./ui/itens/12.png',bola:false}]]);}else{assert(corpo.innerHTML.includes('<small>ground</small>'));assert(corpo.innerHTML.includes('<b>Pedra</b>'));}
  assert.equal(JSON.stringify({atual,item}),before);
 }
});
