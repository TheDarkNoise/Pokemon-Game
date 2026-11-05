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
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}

test('all 25 nature descriptions render in English in the actual Pokémon detail row, preserving names and stat multipliers',async()=>{
 const source=await read('menus.mjs'),ast=parseAst(source),row=find(ast,n=>n.type==='CallExpression'&&n.callee.object?.name==='Popup'&&n.callee.property?.name==='texto'&&n.arguments[1]?.value==='natureza');assert(row);
 const before=JSON.stringify(Ind.NATUREZAS),stats=['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'];
 for(const [name,up,down]of Ind.NATUREZAS){
  const e={natureza:name},record=JSON.stringify(e),output=[];
  vm.runInNewContext(source.slice(row.start,row.end),{e,ctx:{Ind},tr:I.t,pop:{},f:{},Popup:{texto:(_,id,text)=>{assert.equal(id,'natureza');output.push(I.t(text))}}});
  const description=up===down?'neutral':'+'+stats[up]+' −'+stats[down];
  assert.deepEqual(output,[name+'  '+description]);assert.equal(I.t(Ind.descNatureza(name)),description,name+' legacy detail');
  for(let stat=0;stat<6;stat++)assert.equal(Ind.multNatureza(name,stat),up===down?1:stat===up?1.1:stat===down?.9:1);
  assert.equal(JSON.stringify(e),record);
 }
 assert.equal(JSON.stringify(Ind.NATUREZAS),before);
 const output=[];vm.runInNewContext(source.slice(row.start,row.end),{e:{},ctx:{Ind},tr:I.t,pop:{},f:{},Popup:{texto:(_,__,text)=>output.push(text)}});assert.deepEqual(output,['']);
 await I.carregar('pt');assert.equal(I.t(Ind.descNatureza('Adamant')),'+Ataque −At. Esp.');await I.carregar('en');
});

test('actual boss health bar says BOSS while retaining health, name, level and fill behavior',async()=>{
 const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function hudChefe('))[2];
 const fn=find(parseAst(source),n=>n.type==='FunctionDeclaration'&&n.id.name==='hudChefe');assert(fn);
 for(const hp of [100,40,10,0]){
  const el={},c={nome:'Moeda',lv:70,hp,maxHp:100},before=JSON.stringify(c);
  const result=vm.runInNewContext(source.slice(fn.start,fn.end)+';hudChefe(c)',{c,document:{getElementById:()=>el},I18n:I});
  assert.equal(result,el);assert(el.innerHTML.includes('MOEDA'));assert(el.innerHTML.includes('Lv70 · BOSS'));assert(el.innerHTML.includes(hp+' / 100'));assert(el.innerHTML.includes('width:'+hp+'%'));assert.equal(JSON.stringify(c),before);
 }
});
