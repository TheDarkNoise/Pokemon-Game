import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
import {ESQUEMAS} from '../admin/esquemas.mjs';
import {TIPOS} from '../admin/esquemas_f2.mjs';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const json=async p=>JSON.parse(await read('public/data/'+p+'.json'));
const fetcher=async p=>({ok:true,json:()=>json(p.replace('/data/','').replace('.json',''))});
const traduzir=await carregarMensagens(fetcher);
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
async function source(f){const text=await read('admin/'+f+'.mjs');return {text,ast:parseAst(text)};}
function expression(s,name){const n=find(s.ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);assert(n,name);return s.text.slice(n.init.start,n.init.end);}
function fn(s,name){const n=find(s.ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return s.text.slice(n.start,n.end);}
const evo=await source('conteudo_evolucoes');

test('actual generated evolution descriptions translate item, move and special-rule fragments',async()=>{
 const data=await json('evolucoes'),before=JSON.stringify(data),itens=(await json('menus_dados')).itens,golpesDex=(await json('dex_extra')).golpes;
 const make=r=>vm.runInNewContext(fn(evo,'textoDa')+';textoDa(r)',{r,itens,golpesDex,TIPOS,traduzir,nomeSp:n=>'Species '+n});
 for(const r of Object.values(data.por).flat()){const en=make(r);assert(en);assert(!/[ãõç]|\b(?:Pedra|amizade|durante|conhecendo)\b/.test(en),en);}
 assert.equal(make({gatilho:'item',itemNome:'Pedra do Fogo'}),'use Fire Stone');
 assert.equal(make({gatilho:'outro',extra:'chuva'}),'special rule: '+traduzir('chuva'));
 assert.equal(JSON.stringify(data),before);
});

test('actual evolution widgets translate descriptive values and preserve numeric and enum inputs',()=>{
 const r={gatilho:'item',item:1,itemNome:'Grande Bola',texto:'Bola Mestra'},before=JSON.stringify(r),CAMPO=Object.fromEntries(ESQUEMAS.evolucoes.campos.map(c=>[c.k,c]));
 const widgets={},options=[];const make=vm.runInNewContext('('+expression(evo,'fazer')+')',{r,CAMPO,traduzir,campo:o=>{options.push(o);return {entrada:{value:o.valor}};},widgets,itens:{1:{n:'Grande Bola'}},golpesDex:{},especies:new Map(),comModelo:new Set(),nomeSp:n=>String(n)});
 for(const key of ['itemNome','texto','item','gatilho'])make(key);
 assert.equal(options[0].valor,'Great Ball');assert.equal(options[1].valor,'Master Ball');assert.equal(options[2].valor,1);assert.equal(options[3].valor,'item');assert.equal(JSON.stringify(r),before);
 assert.equal(options[2].dica(1),'Great Ball');
});

test('raid preview displays English warnings, level and slots without changing config or model path',async()=>{
 const s=await source('previa_raid'),info={classList:{toggle(){}}},r={arena:123,chefeNome:'Moeda',chefeGlb:'pm0151_00',chefeNivel:70,vagas:10},before=JSON.stringify(r);
 await vm.runInNewContext(fn(s,'atualizar')+';atualizar(r)',{r,raiz:{querySelector:()=>info},PADRAO:{},atual:'pm0151_00',esc:s=>String(s),nomesDeLugares:async()=>({cenas:{}}),recurso:async()=>({modelos:[]})});
 for(const label of ['Moeda','Lv 70','10 slots','Scene <b>123</b>','Model <code>cenario/mon/pm0151_00.glb'])assert(info.innerHTML.includes(label),label);
 assert.equal(JSON.stringify(r),before);
});

test('badge preview translates the awarding gym and retains badge IDs and source records',async()=>{
 const s=await source('previa_insignia'),el={},gyms={1:{nome:'Ginásio Cinza Escuro',insignia:{id:101}}},before=JSON.stringify(gyms),r={id:101,n:'Boulder Badge',gen:1};
 await vm.runInNewContext(fn(s,'atualizar')+';atualizar(r)',{r,raiz:{querySelector:sel=>sel==='.gins'?el:null},esc:s=>String(s),carregarGinasios:async()=>gyms,carregarMensagens:async()=>traduzir});
 assert.equal(el.textContent,'generation 1 · awarded by: '+traduzir(gyms[1].nome));assert.notEqual(traduzir(gyms[1].nome),gyms[1].nome);assert.equal(JSON.stringify(gyms),before);
});

test('resource location names translate for music and raid previews, preserving all IDs and original maps',async()=>{
 const data={cenas:[{id:42,nome:'campo de safári',areas:[{id:7,nome:'Campo de Safári Casa 5'}]}]},before=JSON.stringify(data);
 globalThis.location={protocol:'https:',origin:'https://example.test'};globalThis.fetch=async p=>p==='/data/cenas.json'?{json:async()=>data}:fetcher(p);
 try{const R=await import('../admin/recursos.mjs?language-test');const names=await R.nomesDeLugares();assert.equal(names.cenas[42],'Safari Zone');assert.equal(names.areas[7],'Safari Zone House 5');assert.equal(JSON.stringify(data),before);assert.equal(await R.nomesDeLugares(),names);}finally{delete globalThis.location;delete globalThis.fetch;}
});


test('learnset suggestions and fallback descriptions show English names and retain move IDs',async()=>{
 const s=await source('conteudo_learnset'),golpes={tackle:{nome:'Tackle',nomePt:'Investida',tipo:'Normal',cat:'fisico',poder:40,pp:35},custom:{nomePt:'Investida',tipo:'Normal',cat:'fisico',poder:20,pp:10}},before=JSON.stringify(golpes),traduzir=v=>v==='Investida'?'Tackle':v;
 const call=find(s.ast,n=>n.type==='CallExpression'&&n.callee.name==='datalist'&&n.arguments[0]?.value==='dl-f2-golpes');assert(call);
 const suggestions=vm.runInNewContext(s.text.slice(call.arguments[1].start,call.arguments[1].end),{golpes,traduzir});assert.deepEqual(JSON.parse(JSON.stringify(suggestions)),[['tackle','Tackle'],['custom','Tackle']]);
 const desc=vm.runInNewContext('('+expression(s,'descGolpe')+')',{golpes,traduzir,TIPOS,CAT:{fisico:'physical'}});assert.equal(desc('custom'),'Tackle · Normal · physical · power 20 · PP 10');assert(desc('missing').includes('unknown move'));assert.equal(JSON.stringify(golpes),before);
});
