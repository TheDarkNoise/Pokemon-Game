import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {comprarNaLoja} from '../servidor_loja.mjs';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const catalogo=JSON.parse(await read('public/data/menus_dados.json'));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
const source=await read('menus.mjs'),ast=parseAst(source);
function fn(name){const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);}

test('Poké Mart debits server prices and delivers balls/items in the authoritative save',()=>{
 const conta={rev:3,save:{dinheiro:10000,bolas:{1001:2},itens:{},insignias:[101],nome:'Moeda'}},beforeCatalogue=JSON.stringify(catalogo);
 const ball=catalogo.lojas['2150101'].find(p=>p.item===1001),item=catalogo.lojas['2150101'].find(p=>p.item===2001);
 const a=comprarNaLoja(conta,{loja:'2150101',item:1001,preco:0,n:999},catalogo);assert(!a.erro);assert.equal(conta.save.dinheiro,10000-ball.preco);assert.equal(conta.save.bolas[1001],2+ball.n);assert.equal(a.n,ball.n);assert.deepEqual(a.bolsa.insignias,[101]);
 const b=comprarNaLoja(conta,{loja:'2150101',item:2001,qtd:2},catalogo);assert(!b.erro);assert.equal(conta.save.itens[2001],2*item.n);assert.equal(conta.save.dinheiro,10000-ball.preco-2*item.preco);assert.equal(conta.rev,5);assert.equal(conta.save.nome,'Moeda');assert.equal(JSON.stringify(catalogo),beforeCatalogue);
});

test('refused purchases and malformed catalogue values leave money, inventory and revision unchanged',()=>{
 for(const pedido of [{loja:'missing',item:1001},{loja:'2150101',item:999999},{loja:'2150101',item:1001,qtd:0},{loja:'2150101',item:1001,qtd:-1},{loja:'2150101',item:1001,qtd:1.5},{loja:'2150101',item:1001,qtd:1000},{loja:'2150101',item:1001}]){
  const c={rev:2,save:{dinheiro:1,itens:{},bolas:{}}},before=JSON.stringify(c);assert(comprarNaLoja(c,pedido,catalogo).erro);assert.equal(JSON.stringify(c),before);
 }
 assert(comprarNaLoja(null,{item:1001},catalogo).erro);
 const c={save:{dinheiro:500,itens:{},bolas:{}}},before=JSON.stringify(c),invalid=structuredClone(catalogo);invalid.lojas['2150101'][0].preco=-1;assert(comprarNaLoja(c,{loja:'2150101',item:1001},invalid).erro);assert.equal(JSON.stringify(c),before);
});

test('item-currency payments and shop bundle quantities use catalogue values',()=>{
 const d={itens:{2:{t:1},100:{t:9}},lojas:{7:[{item:100,n:3,moeda:2,preco:4}]}},c={save:{dinheiro:10,itens:{2:12,100:1},bolas:{}}};
 const r=comprarNaLoja(c,{loja:7,item:100,qtd:2,moeda:1,preco:0},d);assert(!r.erro);assert.equal(c.save.dinheiro,10);assert.equal(c.save.itens[2],4);assert.equal(c.save.itens[100],7);
});

test('actual server purchase dispatch persists successful purchases and returns explicit refusals',async()=>{
 const s=await read('servidor.mjs'),tree=parseAst(s),n=find(tree,n=>n.type==='IfStatement'&&n.test.type==='BinaryExpression'&&n.test.left.name==='op'&&n.test.right.value==='comprar');assert(n);
 for(const dinheiro of [1000,0]){
  const c={save:{dinheiro,itens:{},bolas:{}}},messages=[];let saved=0;
  vm.runInNewContext(s.slice(n.start,n.consequent.end),{op:'comprar',c,m:{loja:'2150101',item:1001},comprarNaLoja,fs:{readFileSync:()=>JSON.stringify(catalogo)},nodePath:{join:()=>''},DADOS_PUB:'',ws:{},enviar:(ws,m)=>messages.push(m),salvarContas:()=>saved++});
  assert.equal(messages[0].t,dinheiro?'bolsa':'bolsa_erro');assert.equal(saved,dinheiro?1:0);if(dinheiro)assert.equal(messages[0].bolsa.bolas[1001],1);
 }
});

test('Pokédex discoveries from legacy records remain visible without granting higher knowledge or changing saves',()=>{
 for(const [estado,nivel,pontos,proximo]of [[undefined,0,0,1],['visto',1,1,4],['pego',2,4,10]]){
  const rv={nivel:0,pontos:0,proximo:1},before=JSON.stringify(rv),result=vm.runInNewContext(fn('revelacaoDex')+';revelacaoDex(4,estado)',{ctx:{conhecimento:{revela:()=>rv}},estado});
  assert.equal(result.nivel,nivel);assert.equal(result.pontos,pontos);assert.equal(result.proximo,proximo);assert.equal(JSON.stringify(rv),before);
 }
 const result=vm.runInNewContext(fn('revelacaoDex')+';revelacaoDex(4,"pego")',{ctx:{conhecimento:{revela:()=>({nivel:5,pontos:33,proximo:null})}}});assert.equal(result.nivel,5);assert.equal(result.pontos,33);
});

test('Side quests tab displays its empty state and switching back restores main-story content',()=>{
 const elements=Object.fromEntries(['missao-ativa','lista-capitulos','recompensa'].map(k=>[k,{style:{}}])),pop={appendChild(el){this.child=el;}},calls=[];
 const context=vm.createContext({pop,abaMi:'secundarias',Popup:{trocarAba:(p,n)=>calls.push(n),grupo:(p,n)=>elements[n],no:(p,n)=>elements[n]},document:{createElement:()=>({style:{}})},tr:s=>s});
 assert.equal(vm.runInContext(fn('vistaMissoes')+';vistaMissoes(pop)',context),false);assert.equal(pop.child.textContent,'No side quests are available in this version yet.');for(const el of Object.values(elements))assert.equal(el.style.display,'none');
 context.abaMi='principal';assert.equal(vm.runInContext('vistaMissoes(pop)',context),true);assert.equal(pop.child.style.display,'none');for(const el of Object.values(elements))assert.equal(el.style.display,'');assert.deepEqual(calls,['secundarias','principal']);
});

test('missing shop responses do not play the purchase success sound',async()=>{
 const html=await read('index.html'),script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('async function bolsaOp'))[1],tree=parseAst(script),n=find(tree,n=>n.type==='FunctionDeclaration'&&n.id.name==='bolsaOp');assert(n);
 for(const response of [null,{erro:'Declined'},{bolsa:{dinheiro:800}}]){
  const sounds=[],notices=[];const r=await vm.runInNewContext(script.slice(n.start,n.end)+';bolsaOp("comprar",{})',{comConta:()=>true,Rede:{pedirBolsa:async()=>response},Chat:{sistema:s=>notices.push(s)},Som:{tocar:s=>sounds.push(s)},performance:{now:()=>1000},ultimoItemget:0});
  assert.equal(sounds.length,response&&!response.erro?1:0);assert.equal(notices.length,response&&!response.erro?0:1);assert(r);
 }
});


test('Pokédex collector counters agree with known party and legacy discoveries without modifying knowledge',()=>{
 const resumo={kantoAte:151,vistosKanto:1,pegosKanto:0,pontosTotal:1},before=JSON.stringify(resumo),estado={4:'pego',16:'pego',14:'visto',999:'pego'};
 const result=vm.runInNewContext(fn('resumoDex')+';resumoDex(estado)',{ctx:{conhecimento:{resumo:()=>resumo}},estado});assert.equal(result.vistosKanto,3);assert.equal(result.pegosKanto,2);assert.equal(result.pontosTotal,1);assert.equal(JSON.stringify(resumo),before);
});
