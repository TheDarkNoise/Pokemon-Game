import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
const source=await readFile(new URL('../admin/admin.mjs',import.meta.url),'utf8'),ast=parseAst(source);
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
function fn(name){const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);}
function variable(name){const n=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);assert(n,name);return 'const '+name+'='+source.slice(n.init.start,n.init.end)+';';}
const translate=await carregarMensagens(async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public'+url,import.meta.url),'utf8'))};}catch{return{ok:false};}});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const names=Object.freeze({1101:'Cidade Pallet',1191:'Floresta Verde',9000:'Meu jardim'}),boxes=Object.freeze(Object.keys(names).map((a,i)=>Object.freeze({a:+a,x:i,z:0,sx:2,sz:2}))),dadosMapa=Object.freeze({nomes:names,caixas:boxes,areas:Object.freeze(Object.keys(names))});
const nameCode=variable('nomeArea')+variable('rotuloArea');
function context(extra={}){return{nomesCena:{},dadosMapa,traduzirErro:translate,esc,...extra};}

test('map layer labels remain connected to their original visibility keys',()=>{
 const assignment=find(ast,n=>n.type==='AssignmentExpression'&&n.left.property?.name==='innerHTML'&&n.left.object?.arguments?.[0]?.value==='m-camadas');assert(assignment);
 const camadas={minimapa:true,caixas:true,grama:true,agua:true,piso:true,zonas:true,npcs:false,treinadores:false};
 const html=vm.runInNewContext(variable('ROTULOS_CAMADAS')+';'+source.slice(assignment.right.start,assignment.right.end),{camadas,esc});
 for(const [key,label] of Object.entries({minimapa:'Minimap',caixas:'Area boxes',grama:'Grass',agua:'Water',piso:'Cave floor',zonas:'Spawn zones',npcs:'NPCs',treinadores:'Trainers'}))assert(html.includes(`data-cam="${key}"${camadas[key]?' checked':''}> ${label}</label>`));
 const statement=find(ast,n=>n.type==='ExpressionStatement'&&source.slice(n.start,n.end).startsWith("$('m-camadas').querySelectorAll('input').forEach"));assert(statement);
 const input={dataset:{cam:'agua'},checked:false,addEventListener(type,callback){assert.equal(type,'change');this.change=callback;}};let redraws=0;
 vm.runInNewContext(source.slice(statement.start,statement.end),{camadas,$:()=>({querySelectorAll:()=>[input]}),desenhar:()=>redraws++});input.change();assert.equal(camadas.agua,false);assert.equal(Object.hasOwn(camadas,'Water'),false);assert.equal(redraws,1);
});

test('area lists display English and can still be searched by source names or IDs',()=>{
 for(const query of ['Pallet','Cidade Pallet','1101','Forest','Floresta Verde']){
  const elements={'a-qtd':{},'a-filtro':{value:query},'a-lista':{querySelectorAll:()=>[]}};
  vm.runInNewContext(nameCode+fn('renderListaAreas')+';renderListaAreas()',context({$:id=>elements[id],areasOriginais:new Set(Object.keys(names).map(Number)),caixaSel:null}));
  const html=elements['a-lista'].innerHTML;assert(html.includes(query.includes('Forest')||query.includes('Floresta')?'Viridian Forest':'Pallet Town'));assert(!html.includes('Cidade Pallet'));assert(!html.includes('Floresta Verde'));
 }
 assert.equal(names[1101],'Cidade Pallet');assert.deepEqual(boxes.map(b=>b.a),[1101,1191,9000]);
});

test('translated area headings never replace the editable stored name or coordinates',()=>{
 const elements={};const $=id=>elements[id]||= {};
 vm.runInNewContext(nameCode+fn('atualizarCamposArea')+';atualizarCamposArea()',context({$,caixaSel:boxes[0],areasOriginais:new Set([1101]),document:{activeElement:null},FLIPX:-1,tilesDentro:()=>({dentro:0,grama:[],agua:[]})}));
 assert.equal(elements['a-titulo'].textContent,'Pallet Town');assert.equal(elements['a-nome'].value,'Cidade Pallet');assert.equal(elements['a-id'].value,1101);assert.equal(elements['a-id'].disabled,true);assert.equal(names[1101],'Cidade Pallet');assert.equal(boxes[0].x,0);
 assert.equal(vm.runInNewContext(nameCode+';rotuloArea(9000)',context()),'Meu jardim');assert.equal(vm.runInNewContext(nameCode+';rotuloArea(9876)',context()),'Area 9876');
});

test('habitat rows retain area IDs and match both English and source-language searches',()=>{
 const elements={'h-busca':{value:'Cidade Pallet'},'h-areas':{querySelectorAll:()=>[]}};
 const habitats=Object.freeze({areas:Object.freeze({1101:Object.freeze([{dex:25}])}),generico:Object.freeze([])});
 vm.runInNewContext(nameCode+fn('listaAreas')+fn('renderHabitats')+';renderHabitats()',context({$:id=>elements[id],habitats,areaSel:'1101'}));
 assert(elements['h-areas'].innerHTML.includes('data-id="1101"'));assert(elements['h-areas'].innerHTML.includes('Pallet Town'));assert.equal(habitats.areas[1101][0].dex,25);
});

test('actual admin login form fields match the handler and preserve its authentication payload',async()=>{
 const html=await readFile(new URL('../admin/index.html',import.meta.url),'utf8'),form=html.match(/<form id="f-login">([\s\S]*?)<\/form>/)[1];assert(form.includes('>Sign in</button>'));assert(!form.includes('>Entrar</button>'));
 const handler=find(ast,n=>n.type==='CallExpression'&&n.callee.property?.name==='addEventListener'&&n.callee.object?.arguments?.[0]?.value==='f-login').arguments[1];
 for(const gm of [true,false]){
  const elements=Object.fromEntries([...form.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:''}]));elements['l-usuario'].value='Dad_7';elements['l-senha'].value='test-only';const requests=[],saved=[];let starts=0,prevented=false;
  const ctx={$:id=>elements[id],token:'',api:async(...args)=>{requests.push(args);return{ok:true,gm,token:'test-session'};},localStorage:{setItem:(...args)=>saved.push(args)},iniciar:()=>starts++,e:{preventDefault(){prevented=true;}}};
  await vm.runInNewContext('('+source.slice(handler.start,handler.end)+')(e)',ctx);
  assert.equal(prevented,true);assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['/conta/entrar','POST',{usuario:'Dad_7',senha:'test-only'}]]);assert.equal(starts,gm?1:0);assert.equal(saved.length,gm?1:0);if(!gm)assert.equal(elements['l-msg'].textContent,'This account is not a GM.');
 }
});
