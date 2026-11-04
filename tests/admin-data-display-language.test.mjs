import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
import {campoDado,registroDado,textoDado} from '../admin/idioma_dados.mjs';
import {ESQUEMAS,validarCampo} from '../admin/esquemas.mjs';
const read=async f=>readFile(new URL('../'+f,import.meta.url),'utf8');
const json=async f=>JSON.parse(await read('public/data/'+f+'.json'));
const tr=await carregarMensagens(async p=>({ok:true,json:()=>json(p.replace('/data/','').replace('.json',''))}));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

test('all configured balls and authored admin fields translate without changing source keys, paths or numbers',async()=>{
 const balls=(await json('config_jogo')).bolas,before=JSON.stringify(balls);
 const names=Object.values(balls).map(r=>registroDado('bolas',r,tr).nome);
 for(const name of ['Poké Ball','Great Ball','Ultra Ball','Master Ball','Safari Ball','Level Ball','Net Ball','Nest Ball','Repeat Ball'])assert(names.includes(name),name);
 for(const raw of ['Bola Rápida','Bola Parque','bola brilhante'])assert.notEqual(campoDado('bolas','nome',raw,tr),raw);
 assert.equal(JSON.stringify(balls),before);
 const original={nome:'Grande Bola',glb:'Grande Bola',icone:'Pokébola',taxa:1.5,time:[{dex:1,lv:5}],rotulos:{cabelo:'cabelo/macacão'}};
 const result=registroDado('bolas',original,tr);assert.equal(result.nome,'Great Ball');assert.equal(result.glb,original.glb);assert.equal(result.icone,original.icone);assert.equal(result.taxa,1.5);assert.equal(result.time,original.time);
 const recipe=campoDado('receitas_cor','rotulos',original.rotulos,tr);assert.deepEqual(recipe,{cabelo:'Hair/overalls'});assert.deepEqual(original.rotulos,{cabelo:'cabelo/macacão'});
 assert.equal(campoDado('traducoes','pt','Grande Bola',tr),'Grande Bola');assert.equal(campoDado('golpes','nomePt','Grande Bola',tr),'Grande Bola');
});

test('actual generic form shows English but keeps the original payload until the user edits a field',async()=>{
 const s=await read('admin/dados.mjs'),ast=parseAst(s),n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='formulario');
 const nodes=[];const make=tag=>{const el={tag,children:[],dataset:{},classList:{add(){},remove(){}},append(...x){this.children.push(...x);},addEventListener(event,fn){this[event]=fn;}};nodes.push(el);return el;};
 const r={nome:'Grande Bola',taxa:1.5},before=JSON.stringify(r),cont=make('div');let dirty=0,updates=0;
 vm.runInNewContext(s.slice(n.start,n.end)+';formulario(cont,r,()=>updates++)',{document:{createElement:make},esq:ESQUEMAS.bolas,nomeAtual:'bolas',r,cont,campoDado,traduzirDado:tr,esc,validarCampo,marcar:()=>dirty++,get updates(){return updates;},set updates(v){updates=v;}});
 const input=nodes.find(n=>n.tag==='input'&&n.type==='text');assert.equal(input.value,'Great Ball');assert.equal(JSON.stringify(r),before);assert.equal(dirty,0);
 input.value='Custom Ball';input.input();assert.equal(r.nome,'Custom Ball');assert.equal(r.taxa,1.5);assert.equal(dirty,1);assert.equal(updates,1);
});

test('every quest chapter, description, tracker, hint and step dialogue has a translated admin display',async()=>{
 const data=await json('missoes'),before=JSON.stringify(data);let chapters=0,quests=0,texts=0;
 const verify=v=>{if(Array.isArray(v))return v.forEach(verify);if(typeof v==='string'&&v.trim()){const en=textoDado(v,tr);assert(en.trim());assert(!/[ãõç]|\b(?:Você|Fale|Derrote|Vá|entregue|encontre)\b/i.test(en),en);texts++;}};
 for(const c of data.capitulos){chapters++;verify(c.nome);for(const m of c.missoes){quests++;verify(m.nome);verify(m.des);for(const p of m.passos)for(const key of ['texto','onde','fala'])verify(p[key]);}}
 assert.equal(chapters,20);assert.equal(quests,56);assert(texts>150);assert.equal(JSON.stringify(data),before);
 const s=await read('admin/conteudo_missoes.mjs'),ast=parseAst(s),node=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='campoTexto');
 let shown;const raw={nome:'Grande Bola'};const fn=vm.runInNewContext(s.slice(node.init.start,node.init.end),{campo:o=>(shown=o),textoDado,traduzir:tr});
 fn({valor:raw.nome,aoMudar:v=>raw.nome=v});assert.equal(shown.valor,'Great Ball');assert.equal(raw.nome,'Grande Bola');shown.aoMudar('My Quest');assert.equal(raw.nome,'My Quest');
});

test('English Pokédex field uses the complete English dataset and is read-only alongside the original entry',async()=>{
 const en=await json('idioma/dex_en'),pt=await json('idioma/dex_pt');for(const k of Object.keys(pt))assert(en[k]?.trim(),k);
 const s=await read('admin/conteudo_especies.mjs'),ast=parseAst(s),node=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='descricaoEn');let options;
 const field=vm.runInNewContext(s.slice(node.init.start,node.init.end),{campo:o=>(options=o,{entrada:{}}),descricoesEn:en,k:'1'});
 assert.equal(options.valor,en['1']);assert.equal(options.rotulo,'Pokédex description (English)');assert(!options.aoMudar);
 const assignment=find(ast,n=>n.type==='AssignmentExpression'&&n.left.object?.object?.name==='descricaoEn');assert(assignment);vm.runInNewContext(s.slice(assignment.start,assignment.end),{descricaoEn:field});assert.equal(field.entrada.readOnly,true);
 assert(s.includes("valor: D.descricoes_pt[k]"));
});



test('requested data categories translate authored text, retaining every original record',async()=>{
 let fields=0;
 for(const name of ['itens','treinadores','npcs','bolas','ginasios','mochilas','skins_treinador','receitas_cor','insignias','golpes','dialogos']){
  const e=ESQUEMAS[name];let data=await json(e.arquivo);if(e.caminho)data=data[e.caminho];const before=JSON.stringify(data);
  for(const row of e.forma==='objeto'?[data]:Object.values(data)){
   const shown=registroDado(name,row,tr);
   assert.deepEqual(Object.keys(shown),Object.keys(row));
   for(const c of e.campos){const value=campoDado(name,c.k,row[c.k],tr);if(typeof value==='string'&&value!==row[c.k])fields++;}
  }
  assert.equal(JSON.stringify(data),before,name);
 }
 assert(fields>1000);
});
