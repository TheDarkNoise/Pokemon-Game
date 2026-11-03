import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
const read=async name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const sourceFetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(url).replace(/^\.\//,'')))};}catch{return{ok:false};}};
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};globalThis.fetch=sourceFetch;
const I=await import('../i18n.mjs');await I.carregar('en');const admin=await carregarMensagens(url=>sourceFetch('.'+url));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
const extra=JSON.parse(await read('public/data/dex_extra.json')),abilityNames=JSON.parse(await read('public/data/idioma/habilidades_en.json'));

test('all 1025 species ability labels have English names without rewriting source records or ordinary names',async()=>{
 const before=JSON.stringify(extra);let checked=0;
 for(const sp of Object.values(extra.especies))for(const raw of [...(sp.h||[]),...(sp.ho?[sp.ho]:[])]){assert(Object.hasOwn(abilityNames,raw),raw);assert.equal(I.habilidade(raw),abilityNames[raw]);checked++;}
 assert.equal(Object.keys(extra.especies).length,1025);assert.equal(Object.keys(abilityNames).length,268);assert(checked>2000);
 for(const [raw,en] of [['Exuberante','Overgrow'],['Fogo Intenso','Blaze'],['Correnteza','Torrent'],['Pó de escamas','Shield Dust'],['Óculos coloridos','Tinted Lens'],['Telepatia','Telepathy'],['armadura de cauda','Armor Tail']])assert.equal(I.habilidade(raw),en);
 assert.equal(I.t('Exuberante'),'Exuberante');assert.equal(I.t('Sombra'),'Sombra');assert.equal(I.habilidade('Unknown custom ability'),'Unknown custom ability');assert.equal(I.habilidade(null),null);assert.equal(JSON.stringify(extra),before);
 await I.carregar('pt');assert.equal(I.habilidade('Exuberante'),'Exuberante');await I.carregar('en');assert.equal(I.habilidade('Exuberante'),'Overgrow');await I.recarregar();assert.equal(I.habilidade('Clorofila'),'Chlorophyll');
});

test('actual Pokédex ability markup retains knowledge locks and translates normal and hidden abilities',async()=>{
 const source=await read('menus.mjs'),ast=parseAst(source);
 const row=find(ast,n=>n.type==='ArrayExpression'&&n.elements?.[0]?.value==='info-habilidades');assert(row);
 const template=find(ast,n=>n.type==='TemplateLiteral'&&n.quasis[0].value.cooked==='<tr><td>abilities</td>');assert(template);
 const X=extra.especies['1'],esc=s=>String(s),ctx={X,I18n:I,esc,trava:n=>`LOCKED ${n}`};
 for(const nv of [2,3,4]){
  const markup=vm.runInNewContext(source.slice(template.start,template.end),{...ctx,nv});
  if(nv===2){assert(markup.includes('LOCKED 3'));assert(!markup.includes('Overgrow'));}
  else{assert(markup.includes('Overgrow'));assert.equal(markup.includes('Chlorophyll'),nv===4);}
  const info=vm.runInNewContext(source.slice(row.start,row.end),{X,I18n:I,nv});assert.equal(info[0],'info-habilidades');assert.equal(info[1],3);assert.equal(info[2].includes('Chlorophyll'),nv===4);
 }
});

test('every shipped Safari scene label translates and all source descriptions have English alternatives',async()=>{
 const scenes=JSON.parse(await read('public/data/cenas.json'));let checked=0;
 for(const scene of scenes.cenas)for(const name of [scene.nome,...(scene.areas||[]).map(a=>a.nome)])if(/campo de saf[aá]ri/i.test(name)){assert(I.t(name).includes('Safari Zone'),name);checked++;}
 assert(checked>=12);assert.equal(I.t('campo de safári'),'Safari Zone');assert.equal(I.t('Campo de Safári Casa 5'),'Safari Zone House 5');
 await I.carregarDex();for(const [dex,sp]of Object.entries(extra.especies))if(sp.d)assert(I.descricaoDex(dex),dex);
});

test('actual door destination formatter translates Safari names and retains arrival IDs and fallback behavior',async()=>{
 const source=await read('admin/camadas.mjs'),ast=parseAst(source),node=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='destinoTexto');assert(node);
 const ref={portas:{7:{a:1192,c:4440001}},cenas:{4440001:'Campo de Safári Casa 5'}},before=JSON.stringify(ref);
 const run=(n,curto,name)=>vm.runInNewContext(source.slice(node.start,node.end)+';destinoTexto(n,curto)',{ref,n,curto,nomeArea:()=>name,traduzir:admin});
 assert.equal(run(7,false,'campo de safári'),'Safari Zone House 5 · Safari Zone (arrival 7)');assert.equal(run(7,true,'campo de safári'),'Safari Zone');assert.equal(run(7,true,'Área 9876'),'Safari Zone House 5');assert.equal(run(0,false,''),'no exit');assert.equal(run(99,false,''),'cfg 99 (not found)');assert.equal(JSON.stringify(ref),before);
});

test('quest content references expose English labels while preserving scene and area identifiers',async()=>{
 const source=await read('admin/conteudo.mjs'),ast=parseAst(source),node=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='ref');assert(node);
 const data=JSON.parse(await read('public/data/cenas.json')),before=JSON.stringify(data);
 const result=await vm.runInNewContext('const ref='+source.slice(node.init.start,node.init.end)+';ref.areas()',{baixar:async()=>data,traduzirNomes:async()=>admin});
 for(const ce of data.cenas){assert.equal(result.cenas[ce.id],admin(ce.nome));for(const area of ce.areas||[])if(/saf[aá]ri/i.test(area.nome))assert(result.areas[area.id].includes('Safari Zone'));}
 assert.equal(JSON.stringify(data),before);
});

test('cosmetic preview displays English part labels while keeping the actual color-channel keys',async()=>{
 const source=await read('admin/previa_skin.mjs'),ast=parseAst(source),node=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='seletores');assert(node);
 const buttons={'.aleatorio':{},'.padrao':{}},el={querySelectorAll:()=>[],querySelector:s=>buttons[s]},colors={cabelo:'#112233',roupa:'#445566'},labels={cabelo:'cabelo/macacão',roupa:'acessório'};
 vm.runInNewContext(source.slice(node.start,node.end)+';seletores("test","preview",new Set(["cabelo","roupa"]))',{raiz:{querySelector:()=>el},coresDe:()=>colors,ROTULOS:{test:labels},traduzirRotulo:admin,esc:s=>s,PRESETS:{},PADRAO:{test:colors},P:{}});
 assert(el.innerHTML.includes('Hair/overalls'));assert(el.innerHTML.includes('Accessory'));assert(el.innerHTML.includes('data-k="cabelo"'));assert(el.innerHTML.includes('data-k="roupa"'));assert.deepEqual(colors,{cabelo:'#112233',roupa:'#445566'});
});

test('missing optional ability dictionary falls back safely without affecting other interface translations',async()=>{
 globalThis.fetch=async url=>String(url).includes('habilidades_en.json')?{ok:false}:sourceFetch(url);
 try{const isolated=await import('../i18n.mjs?ability-fallback-test');await isolated.carregar('en');assert.equal(isolated.habilidade('Exuberante'),'Exuberante');assert.equal(isolated.t('Entrar'),'Sign in');}finally{globalThis.fetch=sourceFetch;}
});
