import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const source=await read('menus.mjs'),ast=parseAst(source);
function fn(name){const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end)}

test('actual Social failures translate the server error while keeping routes, action names and payloads',async()=>{
 const cases=[['aceitar','/social/aceitar',{de:'original-user'},'Social: Invalid session.'],['recusar','/social/recusar',{de:'original-user'},'Social: Invalid session.'],['desfazer-amizade','/social/remover',{usuario:'original-user'},'Social: Invalid session.'],['enviar-convite','/social/pedido',{para:'Moeda'},'Invitation: Invalid session.'],['enviar','/social/mensagem',{para:'original-user',texto:'Cancelar'},'Message: Invalid session.']];
 for(const [action,path,body,expected]of cases){
  const requests=[],messages=[],input={value:action==='enviar'?'Cancelar':'Moeda'},r={ok:false,erro:'Sessão inválida.'},before=JSON.stringify(r);
  const scope={popSo:{},soInput:()=>input,soChamar:async(...a)=>{requests.push(a);return r},Chat:{sistema:s=>messages.push(I.t(s))},tr:I.t,Popup:{mostrarExtra(){}},soCarregar:async()=>{},encherSolicitacoes(){},soAmigoMenu:{usuario:'original-user',nick:'Moeda'},soConversa:'original-user',el:{closest:()=>({__de:'original-user'})},action};
  await vm.runInNewContext(fn('soAcao')+';soAcao(action,el)',scope);
  assert.deepEqual(messages,[expected]);assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['POST',path,body]]);assert.equal(input.value,action==='enviar'?'Cancelar':'Moeda');assert.equal(JSON.stringify(r),before);
 }
});

test('actual failed release displays English without removing or saving a Pokémon',async()=>{
 for(const erro of ['Sessão inválida.',null]){
  const target={uid:'original-mon',nome:'Moeda'},time=[target],before=JSON.stringify(time),messages=[],requests=[];let rendered=0;
  const scope={confirmarSoltar:'original-mon',ctx:{jogo:{time},soltarNoServidor:async p=>{requests.push(p);return{ok:false,erro}}},chaveDe:p=>p.uid,tr:I.t,Chat:{sistema:s=>messages.push(I.t(s))},render:()=>rendered++};
  await vm.runInNewContext(fn('soltar')+";soltar('original-mon','time')",scope);
  assert.deepEqual(messages,['Release: '+(erro?'Invalid session.':'the server refused')]);assert.equal(JSON.stringify(time),before);assert.equal(requests[0],target);assert.equal(rendered,1);assert.equal(scope.confirmarSoltar,null);
 }
});

test('actual successful release keeps original request/storage behavior and preserves the name in its farewell',async()=>{
 for(const origem of ['time','caixa'])for(const name of ['Moeda','Pedra','Cancelar']){
  const target={uid:'release-me',nome:name},remaining={uid:'keep-me',nome:'Pikachu'},list=[remaining,target],requests=[],writes=[],messages=[];
  const scope={origem,confirmarSoltar:'release-me',selPokemon:1,ctx:{jogo:{time:list,ash:{}},lerLS:()=>list,soltarNoServidor:async p=>{requests.push(p);return{ok:true}},gravarLS:(...a)=>writes.push(a),flutuar:(_,s)=>messages.push(I.t(s)),pintarTime(){},atualizarSeguidorPainel(){}},chaveDe:p=>p.uid,Chat:{sistema(){}},render(){}};
  await vm.runInNewContext(fn('soltar')+";soltar('release-me',origem)",scope);
  assert.deepEqual(messages,['Goodbye, '+name+'! 👋']);assert.equal(requests[0],target);assert.deepEqual(list,[remaining]);assert.equal(writes.length,1);assert.equal(writes[0][0],origem);assert.equal(writes[0][1],list);assert.equal(scope.selPokemon,0);assert.equal(target.nome,name);
 }
});

test('actual failed progress removal translates the refusal and does not reload or invoke the offline removal path',async()=>{
 const messages=[],calls=[],scope={popCf:{},ctx:{conta:{estado:()=>({modo:'conta'}),apagarPersonagem:async()=>{calls.push('original-action');return{ok:false,erro:'Sessão inválida.'}}}},tr:I.t,Popup:{mostrarExtra(){}},Chat:{sistema:s=>messages.push(I.t(s))},location:{reload:()=>assert.fail('must not reload on refusal')},apagarTudo:()=>assert.fail('must not invoke the offline path')};
 await vm.runInNewContext(fn('cfApagarProgresso')+';cfApagarProgresso()',scope);
 assert.deepEqual(messages,['Could not delete: Invalid session.']);assert.deepEqual(calls,['original-action']);
});

test('composed Social errors keep a free-text moderation reason verbatim',async()=>{
 const messages=[],reason='Cancelar',raw='Sua conta foi suspensa para sempre. Motivo: '+reason;
 const scope={popSo:{},soChamar:async()=>({ok:false,erro:raw}),Chat:{sistema:s=>messages.push(I.t(s))},tr:I.t,Popup:{mostrarExtra(){}},soCarregar:async()=>{},soAmigoMenu:{usuario:'original-user',nick:'Moeda'}};
 await vm.runInNewContext(fn('soAcao')+";soAcao('desfazer-amizade')",scope);
 assert.deepEqual(messages,['Social: Your account has been permanently suspended. Reason: Cancelar']);
});
