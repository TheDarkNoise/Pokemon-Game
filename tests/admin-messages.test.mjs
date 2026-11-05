import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
import {criarTradutor,carregarMensagens} from '../admin/mensagens.mjs';
const dictionary=JSON.parse(await readFile(new URL('../public/data/idioma/ui_en.json',import.meta.url),'utf8'));

test('admin messages format validation errors and preserve dynamic identifiers',()=>{
 const t=criarTradutor(dictionary);
 assert.equal(t('Caixa inválida: 1201'),'Invalid box: 1201');
 assert.equal(t('Faltou a lista de caixas.'),'The area-box list is missing.');
 assert.equal(t('Pokémon repetido (uid Son_7).'),'Duplicate Pokémon (uid Son_7).');
 assert.equal(t('npcs 12: sem posição'),'npcs 12: missing position');
 for(const value of ['Abra','Dad_42','/admin/mapa-areas','pm0025_00'])assert.equal(t(value),value);
 const data={dinheiro:500};assert.equal(t(data),data);
});

test('admin dictionary loading uses root paths and panel overrides for exact and pattern messages',async()=>{
 const paths=[];
 const t=await carregarMensagens(async url=>{paths.push(url);return{ok:true,json:async()=>url.endsWith('conteudo_en.json')?{'Cidade Pallet':'Pallet Town'}:url.endsWith('ui_en.json')?{'Só conta GM.':'GM only','Caixa inválida: {id}':'Bad box {id}'}:[{pt:'Só conta GM.',en:'Staff access required'},{pt:'Caixa inválida: {id}',en:'Check area {id}'}]};});
 assert.deepEqual(paths,['/data/idioma/conteudo_en.json','/data/idioma/ui_en.json','/data/traducoes.json']);
 assert.equal(t('Cidade Pallet'),'Pallet Town');assert.equal(t('Só conta GM.'),'Staff access required');assert.equal(t('Caixa inválida: 44'),'Check area 44');
});

test('unavailable dictionaries leave error messages readable without breaking requests',async()=>{
 const original='Faltou a lista de caixas.';
 assert.equal((await carregarMensagens(async()=>{throw Error('offline');}))(original),original);
 assert.equal((await carregarMensagens(async()=>({ok:false})))(original),original);
});

test('admin API translates only error text and preserves authentication, request payload and response data',async()=>{
 const source=await readFile(new URL('../admin/admin.mjs',import.meta.url),'utf8');
 const node=parseAst(source).body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='api');assert(node);
 const t=criarTradutor(dictionary),original=Object.freeze({erro:'Caixa inválida: 1201',dados:{caixas:[{a:1201}]}}),payload={mapa:'kanto',caixas:[{a:1201}],tilesArea:{grama:[1201],agua:[]}};let request;
 const context={BASE:'http://game.test:5190',token:'test-token',mensagensProntas:Promise.resolve(),traduzirErro:t,payload,
 fetch:async(...args)=>{request=args;return{status:400,ok:false,json:async()=>original};}};
 const result=await vm.runInNewContext(source.slice(node.start,node.end)+";api('/admin/mapa-areas','POST',payload)",context);
 assert.equal(request[0],'http://game.test:5190/admin/mapa-areas');assert.equal(request[1].method,'POST');
 assert.deepEqual(JSON.parse(JSON.stringify(request[1].headers)),{'Content-Type':'application/json',Authorization:'Bearer test-token'});
 assert.deepEqual(JSON.parse(request[1].body),payload);assert.equal(result.status,400);assert.equal(result.ok,false);
 assert.equal(result.erro,'Invalid box: 1201');assert.equal(result.dados,original.dados);assert.equal(original.erro,'Caixa inválida: 1201');
});
