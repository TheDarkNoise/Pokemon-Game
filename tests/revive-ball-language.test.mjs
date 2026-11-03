import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function reanimar('))[2],ast=parseAst(source);
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}
function code(name){const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n);return source.slice(n.start,n.end)}
function value(name){const n=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);assert(n);return vm.runInNewContext('('+source.slice(n.init.start,n.init.end)+')')}

test('actual Revive handler translates both success messages without changing HP, inventory or server requests',()=>{
 for(const max of [false,true])for(const active of [false,true])for(const nickname of ['Pedra','Moeda','Cancelar','João (HP cheio).']){
  const id=max?2013:2012,nome=max?'Reanimador Máximo':'Reanimador',items={[id]:2},target={nome:nickname,hp:0,maxHp:31,koAte:9,uid:'unchanged-uid'},pika={nome:nickname,hp:0,maxHp:31,desmaiado:9},notices=[],requests=[],writes=[];
  const scope={jogo:{time:[target],pika,ash:{}},eliteEstado:{corrida:null},lerLS:()=>items,gravarLS:(...a)=>writes.push(a),estaKO:()=>true,membroAtivo:()=>active?0:1,bolsaOp:(...a)=>requests.push(a),tocarAnim(){},guardarEstadoAtivo(){},Som:{tocar(){}},flutuar:(_,s)=>notices.push(I.t(s)),Chat:{sistema:s=>notices.push(I.t(s))},pintarTime(){},pintarAtalhos(){},id,nome};
  assert.equal(vm.runInNewContext(code('reanimar')+';reanimar(0,id,nome)',scope),true);
  const label=max?'Max Revive':'Revive';assert.deepEqual(notices,[label+' → '+nickname,label+' used on '+nickname+(max?' (full HP).':' (half HP).')]);
  assert.equal((active?pika:target).hp,max?31:16);assert.equal(items[id],1);assert.equal(target.nome,nickname);
  assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['usar',{item:id,uid:'unchanged-uid'}]]);assert.equal(writes[0][0],'itens');
 }
});

test('actual Revive refusal preserves the nickname and spends nothing',()=>{
 for(const nickname of ['Pedra','Moeda','Cancelar']){
  const notices=[],items={2012:2},scope={jogo:{time:[{uid:'u',nome:nickname,hp:31}],ash:{}},eliteEstado:{corrida:null},lerLS:()=>items,estaKO:()=>false,flutuar:(_,s)=>notices.push(I.t(s)),REANIMADORES:value('REANIMADORES')};
  assert.equal(vm.runInNewContext(code('reanimar')+';reanimar(0,2012)',scope),false);assert.deepEqual(notices,[nickname+' has not fainted']);assert.equal(items[2012],2);
 }
});

test('actual ball shortcuts translate selection and empty-item notices while preserving IDs and counts',()=>{
 const balls=value('BOLAS');
 for(const [id,[name]]of Object.entries(balls))for(const count of [0,2]){
  const notices=[],writes=[],b={tipo:'item',id,nome:name,bola:true},jogo={ash:{},atalhos:[b],bolas:{[id]:count},bolaSel:'original'};
  vm.runInNewContext(code('usarAtalho')+';usarAtalho(0)',{jogo,flutuar:(_,s)=>notices.push(I.t(s)),I18n:I,gravarLS:(...a)=>writes.push(a),pintarAtalhos(){}});
  assert.deepEqual(notices,[count?I.t(name)+' selected — press F to throw':'no '+I.t(name)+' left']);assert.equal(jogo.bolaSel,count?id:'original');assert.equal(jogo.bolas[id],count);assert.equal(writes.length,count?1:0);
 }
 const notices=[];vm.runInNewContext(code('usarAtalho')+';usarAtalho(0)',{jogo:{ash:{},atalhos:[{tipo:'item',id:'2001',nome:'Poção'}]},usarItem:()=>false,lerLS:()=>({}),I18n:I,flutuar:(_,s)=>notices.push(I.t(s))});assert.deepEqual(notices,['no Potion left']);
});

test('actual ball cycling translates the selected ball before adding the remaining count',()=>{
 const BOLAS=value('BOLAS'),ids=Object.keys(BOLAS);
 for(let i=0;i<ids.length;i++){
  const jogo={ash:{},bolaSel:ids[i],bolas:Object.fromEntries(ids.map(id=>[id,3]))},notices=[],writes=[];
  vm.runInNewContext(code('proximaBola')+';proximaBola()',{jogo,BOLAS,I18n:I,gravarLS:(...a)=>writes.push(a),flutuar:(_,s)=>notices.push(I.t(s))});
  const next=ids[(i+1)%ids.length];assert.equal(jogo.bolaSel,next);assert.deepEqual(notices,[I.t(BOLAS[next][0])+' ×3']);assert.deepEqual(writes,[['bolaSel',next]]);
 }
});

test('evolution item confirmations and Revive callbacks translate while keeping target names verbatim',()=>{
 const call=find(ast,n=>n.type==='CallExpression'&&n.callee.object?.name==='Chat'&&source.slice(n.start,n.end).includes('Evolucao.nomeItem(alvo.consome)'));assert(call);
 for(const nickname of ['Moeda','Pedra','João, Jr.']){
  const notices=[];vm.runInNewContext(source.slice(call.start,call.end),{Chat:{sistema:s=>notices.push(I.t(s))},Evolucao:{nomeItem:()=> 'Pedra do Trovão'},alvo:{consome:3010},p:{nome:nickname}});assert.deepEqual(notices,['Thunder Stone used on '+nickname+'.']);
  assert.equal(I.t('Reanimador usado em '+nickname),'Revive used on '+nickname);
 }
});

test('actual potion and single/all-move PP recovery callbacks translate without changing nicknames or healing',()=>{
 for(const nickname of ['Moeda','Pedra'])for(const id of [2001,2022,2024]){
  const p={nome:nickname,hp:5,maxHp:31,movs:[{id:1,pp:0,ppMax:20}]},items={[id]:2},notices=[],floating=[],requests=[];
  const ctx={jogo:{pika:p,ash:{}},eliteEstado:{corrida:null},ehReanimador:()=>false,lerLS:()=>items,gravarLS(){},bolsaOp:(...a)=>requests.push(a),uidParceiro:()=> 'unchanged-uid',Som:{tocar(){}},flutuar:(_,s)=>floating.push(I.t(s)),pintarTime(){},guardarEstadoAtivo(){},pintarAtalhos(){},aviso:s=>notices.push(I.t(s)),id,nome:id===2001?'Poção':id===2022?'Éter':'Elixir'};
  assert.equal(vm.runInNewContext(code('usarItem')+';usarItem(id,nome,aviso)',ctx),true);assert.equal(items[id],1);assert.equal(p.nome,nickname);
  assert.deepEqual(notices,[nickname+(id===2001?' recovered 20 HP':id===2022?' recovered 10 PP':' recovered 10 PP (all moves)')]);assert.equal(p.hp,id===2001?25:5);assert.equal(p.movs[0].pp,id===2001?0:10);
  assert.deepEqual(floating,[id===2001?'healed 20 HP':'+10 PP']);
  assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['usar',{item:id,uid:'unchanged-uid'}]]);
 }
 for(const nickname of ['Moeda','Pedra'])for(const [raw,en]of [[' não tem golpes',' has no moves'],[' já está com o PP cheio',' already has full PP'],[' está desmaiado',' has fainted'],[' está desmaiado: use um Reanimador ou vá ao Centro Pokémon',' has fainted: use a Revive or visit a Pokémon Center'],[' já está com o HP cheio. Pra curar outro, chame ele pela barra do time',' already has full HP. To heal another Pokémon, select it from the party bar']])assert.equal(I.t(nickname+raw),nickname+en);
});
