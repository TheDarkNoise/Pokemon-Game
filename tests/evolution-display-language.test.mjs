import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const E=await import('../evolucao.mjs'),data=await E.carregar();
const rules=Object.entries(data.por).flatMap(([dex,rr])=>rr.map(r=>({dex:+dex,r})));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}

test('all 472 evolution rules produce English requirement fragments without modifying source rules or item IDs',()=>{
 assert.equal(rules.length,472);const before=JSON.stringify(data);let itemChecks=0;
 for(const {dex,r}of rules){
  const result=E.avaliar(r,{dex,lv:1,amizade:0});
  assert(!/\b(?:Pedra|amizade|troca|beleza alta|usar)\b|ligação|Metálico/.test(result.falta),result.falta);
  if(['item','troca'].includes(r.gatilho)&&r.item){
   itemChecks++;assert.equal(result.falta,'missing '+I.t(E.nomeItem(r.item))+' in your bag (Poké Mart)');assert.equal(result.pode,false);assert.equal(result.consome,null);
   const available=E.avaliar(r,{dex,lv:1},{itens:{[r.item]:1}});assert.equal(available.pode,true);assert.equal(available.consome,r.item);
  }
 }
 assert(itemChecks>20);assert.equal(JSON.stringify(data),before);
});

test('actual evolution popup translates rules before composing unavailable, ready and pending-model messages',async()=>{
 const source=await read('menus.mjs'),call=find(parseAst(source),n=>n.type==='CallExpression'&&n.callee.object?.name==='Popup'&&n.callee.property?.name==='texto'&&n.arguments[1]?.value==='evolucao');assert(call);
 const entry=rules.find(({dex,r})=>dex===25&&r.item),rule=entry.r;
 const o={nome:rule.nome,regra:rule,falta:E.avaliar(rule,{dex:25,lv:10}).falta};
 const contexts=[{novo:null,prontas:[],ops:[o],pronta:null,emBreve:null},{novo:null,prontas:[o],ops:[o],pronta:o,emBreve:null},{novo:null,prontas:[],ops:[],pronta:null,emBreve:o}];
 for(const fields of contexts){
  let text;vm.runInNewContext(source.slice(call.start,call.end),{...fields,pop:{},f:{},tr:I.t,Popup:{texto:(_,__,s)=>text=I.t(s)}});
  assert(text.includes(rule.nome));assert(text.includes('Thunder Stone'));assert(!/usar|Pedra|em breve/.test(text),text);
  if(fields.emBreve)assert(text.includes('coming soon'));else if(!fields.pronta)assert(text.includes('missing Thunder Stone in your bag'));
 }
});

test('actual legacy Revive button translates the item name and tooltip while retaining its count and disabled state',async()=>{
 const source=await read('menus.mjs'),template=find(parseAst(source),n=>n.type==='TemplateLiteral'&&n.quasis[0]?.value.cooked.startsWith('<button type="button" class="btn ouro" id="p-reanimar"'));assert(template);
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 for(const r of [null,{nome:'Reanimador',n:2,id:2004}]){
  const before=JSON.stringify(r),html=vm.runInNewContext(source.slice(template.start,template.end),{r,tr:I.t,esc});
  if(r){assert(html.includes('title="uses Revive"'));assert(html.includes('Revive (2)'));assert(!html.includes('disabled'));}else{assert(html.includes('disabled'));assert(html.includes('Revive — none in bag'));}
  assert.equal(JSON.stringify(r),before);
 }
});
