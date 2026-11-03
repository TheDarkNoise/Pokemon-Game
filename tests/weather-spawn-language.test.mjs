import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function ligarClima('))[2],ast=parseAst(source);
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}
const extract=n=>source.slice(n.start,n.end),weatherNode=all(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='CLIMAS')[0],CLIMAS=vm.runInNewContext('('+extract(weatherNode.init)+')');
const calls=all(ast,n=>n.type==='CallExpression'&&(n.callee.name==='flutuar'||n.callee.object?.name==='Chat'&&n.callee.property?.name==='sistema'));
function notice(fragment,fields){const n=calls.find(n=>extract(n).includes(fragment));assert(n,fragment);let message;vm.runInNewContext(extract(n),{...fields,Chat:{sistema:s=>message=I.t(s)},flutuar:(_,s)=>message=I.t(s)});return message;}

test('actual weather activation translates all six notices while retaining weather codes, lighting and configuration data',()=>{
 const fn=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='ligarClima')[0];assert(fn);
 const labels={chuva:'rain',chuva_forte:'heavy rain',neve:'snow',granizo:'hail',nevoeiro:'fog',areia:'sandstorm'},before=JSON.stringify(CLIMAS);
 for(const [nome,label]of Object.entries(labels)){
  const clima={guarda:null},sol={intensity:2},hemi={intensity:3},messages=[],cena={background:'original-sky',fog:{color:{clone:()=> 'original-fog',set(v){this.value=v}}}},tela={style:{}},jogo={};
  const scope={nome,CLIMAS,INTERIOR:false,clima,sol,hemi,cena,tela,jogo,FILTRO_BASE:'contrast(1)',THREE:{Color:class{constructor(value){this.value=value}}},Chat:{sistema:s=>messages.push(I.t(s))}};
  assert.equal(vm.runInNewContext(extract(fn)+';ligarClima(nome)',scope),true);
  assert.deepEqual(messages,['Weather: '+label+'.']);assert.equal(clima.nome,nome);assert.equal(clima.cfg,CLIMAS[nome]);assert.equal(jogo.clima,clima);assert.equal(sol.intensity,2*CLIMAS[nome].sol);assert.equal(hemi.intensity,3*CLIMAS[nome].hemi);assert.equal(cena.background.value,CLIMAS[nome].ceu);assert.equal(clima.guarda.ceu,'original-sky');assert.equal(clima.guarda.nevoa,'original-fog');
 }
 for(const [nome,INTERIOR]of [['unknown-code',false],['chuva',true]])assert.equal(vm.runInNewContext(extract(fn)+';ligarClima(nome)',{nome,INTERIOR,CLIMAS}),false);
 assert.equal(JSON.stringify(CLIMAS),before);
});

test('actual reload notices preserve filtered map counts and NPC counts without changing map keys',()=>{
 const ZONAS=[{mapa:'kanto'},{mapa:'other'},{mapa:'kanto'}],before=JSON.stringify(ZONAS);
 assert.equal(notice("'Zonas de spawn recarregadas ('",{ZONAS,NOME:'kanto'}),'Spawn zones reloaded (2 on this map).');
 assert.equal(notice("'Zonas de spawn recarregadas ('",{ZONAS,NOME:'unknown-map'}),'Spawn zones reloaded (0 on this map).');
 for(const n of [0,5])assert.equal(notice("'Falas dos NPCs recarregadas ('",{n}),'NPC dialogue reloaded ('+n+' on this map).');
 assert.equal(JSON.stringify(ZONAS),before);
});

test('actual appearance, approach and bonus-Pokémon notices retain species names verbatim',()=>{
 for(const name of ['Mew','Shedinja','Moeda','Pedra']){
  const s={nome:name},S={name},sp={name},before=JSON.stringify({s,S,sp});
  assert.equal(notice("s.nome + ' apareceu!'",{s}),name+' appeared!');
  assert.equal(notice("S.name + ' está chegando!'",{S,ash:{}}),name+' is approaching!');
  assert.equal(notice("'Um ' + sp.name + ' apareceu na Pokébola vazia!'",{sp}),'A '+name+' appeared in the empty Poké Ball!');
  assert.equal(JSON.stringify({s,S,sp}),before);
 }
});

test('actual developer navigation labels translate their text while keeping DOM IDs and insertion behavior',()=>{
 for(const [id,label]of [['cena-box','scene:'],['ir-box','go to:']]){
  const n=all(ast,n=>n.type==='CallExpression'&&n.callee.property?.name==='insertAdjacentHTML'&&extract(n).includes(id))[0];assert(n);const writes=[];
  vm.runInNewContext(extract(n),{I18n:I,$:name=>{assert.equal(name,'teclas');return{insertAdjacentHTML:(...a)=>writes.push(a)}}});
  assert.deepEqual(writes,[['beforeend','<div style="margin-top:6px" id="'+id+'">'+label+' </div>']]);
 }
});

test('actual admin reload warning preserves literal resource names and paths',()=>{
 for(const arq of ['Moeda','dialogos','data/my-map.json'])assert.equal(notice('pra aplicar.',{arq}),'The admin panel changed "'+arq+'" — reload the game (Ctrl+Shift+R) to apply the changes.');
});
