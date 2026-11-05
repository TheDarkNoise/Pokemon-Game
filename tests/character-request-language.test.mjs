import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}
const character=await read('personagem.mjs'),ast=parseAst(character);

test('actual trainer placeholders translate outfit hints and preserve account names and stored skin metadata',()=>{
 const assignments=all(ast,n=>n.type==='AssignmentExpression'&&n.left.object?.name==='input'&&n.left.property?.name==='placeholder');assert.equal(assignments.length,2);
 for(const n of assignments)for(const account of ['', 'Moeda','Cancelar']){
  const input={},skin={nome:'Coração de Ouro e Alma de Prata',id:'unchanged-skin'},before=JSON.stringify(skin);
  vm.runInNewContext(character.slice(n.start,n.end),{input,skin,s:skin,contaUsuario:()=>account,tr:I.t});
  assert.equal(input.placeholder,account||'HeartGold and SoulSilver');assert.equal(JSON.stringify(skin),before);
 }
});

test('actual optional character close button has an English accessible name and preserves user-entered text',()=>{
 const n=all(ast,n=>n.type==='AssignmentExpression'&&n.left.object?.name==='root'&&n.left.property?.name==='innerHTML')[0];assert(n);
 const root={};vm.runInNewContext(character.slice(n.start,n.end),{root,cancelavel:true,nomeSalvo:'Moeda',esc:s=>s});
 assert(root.innerHTML.includes('aria-label="Close"'));assert(root.innerHTML.includes('value="Moeda"'));assert(root.innerHTML.includes('class="cancela">Cancel'));
});

test('actual repeated purchase request retains its protocol, resolves the older request and displays English without a success sound',async()=>{
 const net=await read('rede.mjs'),n=all(parseAst(net),n=>n.type==='FunctionDeclaration'&&n.id.name==='pedirBolsa')[0];const requests=[],old=[],cleared=[],queue=new Map([['comprar',{timer:7,resolve:r=>old.push(r)}]]),data={loja:'2150101',item:1001};
 const pending=vm.runInNewContext(net.slice(n.start,n.end)+";pedirBolsa('comprar',data)",{data,ws:{readyState:1},bolsaEsperando:queue,clearTimeout:id=>cleared.push(id),setTimeout:()=>8,enviar:m=>requests.push(JSON.parse(JSON.stringify(m)))});
 assert.deepEqual(cleared,[7]);assert.deepEqual(JSON.parse(JSON.stringify(old)),[{erro:'pedido repetido'}]);assert.deepEqual(requests,[{t:'bolsa_comprar',loja:'2150101',item:1001}]);queue.get('comprar').resolve({ok:true});await pending;
 const html=await read('index.html'),game=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('async function bolsaOp('))[1],op=all(parseAst(game),n=>n.type==='FunctionDeclaration'&&n.id.name==='bolsaOp')[0],messages=[];
 const r=await vm.runInNewContext(game.slice(op.start,op.end)+";bolsaOp('comprar',data)",{data,comConta:()=>true,Rede:{pedirBolsa:async()=>old[0]},Chat:{sistema:s=>messages.push(I.t(s))},Som:{tocar:()=>assert.fail('no success sound on refusal')}});
 assert.deepEqual(messages,['⚠ Duplicate request.']);assert.equal(r.erro,'pedido repetido');
});
