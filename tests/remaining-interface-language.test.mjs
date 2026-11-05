import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {carregarMensagens} from '../admin/mensagens.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(url).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const menus=await read('menus.mjs'),html=await read('index.html');
const game=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function pintarTurno()'))[2];
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
function functionCode(source,name){const node=find(parseAst(source),n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(node,name);return source.slice(node.start,node.end);}

test('actual battle panel translates controls, move names and types while retaining PP locks and action payloads',()=>{
 const code=functionCode(game,'pintarTurno');
 const moves={a:{id:'a',nome:'Thunder Shock',nomePt:'Choque do Trovão',tipo:'Elétrico',poder:40},b:{id:'b',nome:'Scratch',nomePt:'Arranhão',tipo:'Normal',poder:40}};
 for(const phase of ['escolha','executando'])for(const noPP of [false,true]){
  const elements={turno:{querySelectorAll:()=>buttons}},buttons=[{dataset:{tg:'0'}},{dataset:{tg:'1'}},{dataset:{tg:'s'}}];
  const actions=[],opened=[];const jogo={turno:{fase:phase,info:{nome:'Moeda',time:[1,2]},idx:0,rodada:3},pika:{hp:20,movs:[{id:'a',pp:0,ppMax:15},{id:'b',pp:5,ppMax:35}],golpesIds:['a','b']},time:[{hp:20},{hp:10}]};
  const ctx={jogo,$:id=>elements[id]||={},membroAtivo:()=>0,GOLPES:moves,I18n:I,Ind:{semPP:()=>noPP},Som:{destravar(){}},Menus:{abrir:name=>opened.push(name)},rodadaTurno:value=>actions.push(value),STRUGGLE:{id:'struggle'}};
  vm.runInNewContext(code+';pintarTurno()',ctx);const output=elements.turno.innerHTML;
  assert(output.includes('<b>Moeda</b>'));assert(output.includes('round 3'));assert(output.includes('Thunder Shock')||output.includes('ThunderShock'));assert(output.includes('Electric'));
  for(const text of ['Bag','Switch Pokémon','Forfeit'])assert(output.includes(text),text);
  assert.equal(output.includes('…executing'),phase==='executando');assert.equal(output.includes('no PP'),noPP);
  assert(/data-tg="0" disabled/.test(output));assert.equal(/data-tg="1" disabled/.test(output),phase!=='escolha');
  if(phase==='escolha'){
   buttons[1].onclick();elements['t-mochila'].onclick();elements['t-troca'].onclick();elements['t-fugir'].onclick();
   assert.deepEqual(JSON.parse(JSON.stringify(actions)),[{tipo:'golpe',g:moves.b},{tipo:'troca',i:1},{tipo:'desistir'}]);assert.deepEqual(opened,['mochila']);
  }
 }
 const el={hidden:false};vm.runInNewContext(code+';pintarTurno()',{jogo:{turno:null},$:()=>el});assert.equal(el.hidden,true);
});

test('collector rankings use English categories and preserve player names, values and list keys',async()=>{
 const ast=parseAst(menus),names=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='NOMES_RANKING');
 for(const total of [1,2]){
  const messages=[],requests=[],data={total,listas:{especies:[{pos:1,nick:'Moeda',valor:12}],shinies:[],conhecimento:[{pos:1,nick:'Cidade Pallet',valor:23}]}};
  const result=await vm.runInNewContext('const NOMES_RANKING='+menus.slice(names.init.start,names.init.end)+';'+functionCode(menus,'mostrarRanking')+';mostrarRanking()',{pegarRanking:async path=>{requests.push(path);return data},Chat:{sistema:text=>messages.push(I.t(text))}});
  assert.equal(result,true);assert.deepEqual(requests,['/ranking']);assert.equal(messages[0],`🏆 Collector rankings (${total} trainer${total===1?'':'s'}):`);
  assert(messages.includes('• knowledge points: 1. Cidade Pallet (23)'));assert(messages.includes('• Kanto species: 1. Moeda (12)'));assert(messages.includes('• shinies: no one yet'));
 }
});

test('friendship notifications stay English while preserving player-supplied names and event behavior',()=>{
 const code=functionCode(menus,'socialEvento');
 for(const [tipo,expected]of [['aceito','🤝 Moeda accepted your invitation.'],['removido','Moeda ended the friendship.']]){
  const messages=[];let reloads=0;
  vm.runInNewContext(code+';socialEvento(m)',{m:{t:'social',tipo,nick:'Moeda'},ctx:{Som:{tocar(){}}},Chat:{sistema:text=>messages.push(I.t(text))},soCarregar:()=>reloads++});
  assert.deepEqual(messages,[expected]);assert.equal(reloads,1);
 }
});

test('password placeholders, validation and Social hints translate through the actual dictionary',()=>{
 const node=find(parseAst(menus),n=>n.type==='FunctionDeclaration'&&n.id.name==='cfDialogoSenha');
 const assignment=find(node,n=>n.type==='AssignmentExpression'&&n.left.property?.name==='innerHTML');
 const markup=vm.runInNewContext(menus.slice(assignment.right.start,assignment.right.end),{});
 const placeholders=[...markup.matchAll(/placeholder="([^"]+)"/g)].map(m=>I.t(m[1]));
 assert.deepEqual(placeholders,['current password','new password (6–64 characters)','repeat the new password']);
 assert.equal(I.t('Trocar'),'Change');assert.equal(I.t('precisa do servidor — em breve'),'requires server support — coming soon');
 assert.equal(I.t('a senha nova precisa de 6 caracteres ou mais.'),'The new password must contain at least 6 characters.');
 assert.equal(I.t('o nome precisa de pelo menos 3 letras'),'The name must contain at least 3 characters');
 assert(I.t('Isso parece enchimento (letra repetida ou quase nenhum caractere diferente). Conte de verdade o que aconteceu.').startsWith('This looks like filler'));
});

test('3D editor translates server errors without modifying authentication, request bodies or response data',async()=>{
 const source=await read('admin/cenario.mjs'),node=find(parseAst(source),n=>n.type==='VariableDeclarator'&&n.id.name==='api');
 const translate=await carregarMensagens(async url=>({ok:true,json:async()=>JSON.parse(await read('public'+url))}));
 const response=Object.freeze({erro:'Faltou a lista de caixas.',dados:{mapa:'kanto',objetos:[{n:'lib:piece',x:1,z:2}]}}),payload={mapa:'kanto',objetos:[{n:'lib:piece',x:1,z:2}]};let request;
 const result=await vm.runInNewContext('const api='+source.slice(node.init.start,node.init.end)+";api('/admin/mapa-objetos','POST',payload)",{BASE:'https://example.test/servidor',token:'test-only',payload,mensagensProntas:Promise.resolve(),traduzirErro:translate,fetch:async(...args)=>{request=args;return{status:400,ok:false,json:async()=>response}}});
 assert.equal(request[0],'https://example.test/servidor/admin/mapa-objetos');assert.equal(request[1].headers.Authorization,'Bearer test-only');assert.deepEqual(JSON.parse(request[1].body),payload);
 assert.equal(result.erro,translate(response.erro));assert.notEqual(result.erro,response.erro);assert.equal(result.dados,response.dados);assert.equal(response.erro,'Faltou a lista de caixas.');
});
