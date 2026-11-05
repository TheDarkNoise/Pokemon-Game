import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function proximoDoTime('))[2],ast=parseAst(source);
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}
const extract=n=>source.slice(n.start,n.end),fn=name=>{const n=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name)[0];assert(n);return extract(n)};
const calls=all(ast,n=>n.type==='CallExpression'&&(n.callee.name==='flutuar'||n.callee.object?.name==='Chat'&&n.callee.property?.name==='sistema'));
function call(fragment){const n=calls.find(n=>extract(n).includes(fragment));assert(n,fragment);return extract(n)}
function notice(code,fields){const out=[];vm.runInNewContext(code,{...fields,Chat:{sistema:s=>out.push(I.t(s))},flutuar:(_,s)=>out.push(I.t(s))});assert.equal(out.length,1);return out[0]}

test('actual party cycling cooldown is English, rounds seconds as before and changes no party state',async()=>{
 for(const seconds of [0.1,1,1.2,8]){
  const jogo={ash:{},time:[{uid:'original',nome:'Moeda'}],trocaCd:seconds},before=JSON.stringify(jogo),out=[];
  await vm.runInNewContext(fn('proximoDoTime')+';proximoDoTime()',{jogo,flutuar:(_,s)=>out.push(I.t(s))});
  assert.deepEqual(out,['switch available in '+Math.ceil(seconds)+' s']);assert.equal(JSON.stringify(jogo),before);
 }
});

test('all actual send-out prompts preserve the Pokémon name regardless of source word order',()=>{
 const variants=calls.filter(n=>/\+ ', vai!'|'vai, '\s*\+/.test(extract(n)));assert(variants.length>=4);
 for(const n of variants)for(const name of ['Moeda','Pedra','Cancelar']){
  const p={nome:name},before=JSON.stringify(p),text=notice(extract(n),{novo:p,t:p,alvo:p,p});assert.equal(text,'Go, '+name+'!');assert.equal(JSON.stringify(p),before);
 }
});

test('actual evolution completion and missing requirement messages translate without changing names or rules',async()=>{
 const E=await import('../evolucao.mjs');await E.carregar();const rule=E.regras(25).find(r=>r.item),o={falta:E.avaliar(rule,{dex:25,lv:10}).falta},before=JSON.stringify({rule,o});
 assert.equal(notice(call("'falta: ' + o.falta"),{p:{},o}),'requirements: missing Thunder Stone in your bag (Poké Mart)');
 assert.equal(notice(call("nomeAntes + ' evoluiu para '"),{nomeAntes:'Moeda',alvo:{nome:'Pedra'}}),'Moeda evolved into Pedra!');assert.equal(JSON.stringify({rule,o}),before);
});

test('actual battle header, trainer distance and revival notices are English',()=>{
 for(const name of ['Moeda','Cancelar'])for(const size of [1,6])assert.equal(notice(call("'⚔ Batalha contra '"),{n:{treino:{nome:name,time:Array(size).fill({})}}}),'⚔ Battle against '+name+' ('+size+' Pokémon)!');
 assert.equal(notice(call("'chegue mais perto do treinador'"),{a:{}}),'move closer to the trainer');
 assert.equal(notice(call("'de volta!'"),{pika:{}}),'back!');
});

test('actual crystal pickup notice translates its item, type and respawn hint',()=>{
 assert.equal(notice(call("'Pegou um Fragmento de Teracristal Normal"),{}),'Picked up a Normal Tera Shard (the crystal returns in 2 min).');
 assert.equal(notice(call("'pegou Fragmento de Teracristal'"),{a:{}}),'picked up a Tera Shard');
});

test('actual raid numeric help translates valid commands without translating command names',()=>{
 const usage=call("'Use: /raid ' + o +");
 for(const [o,expected]of [['hp','Usage: /raid hp N (Mew’s HP) or /raid hp auto.'],['dano','Usage: /raid dano F (e.g. 0.5 or 1.5).'],['shiny','Usage: /raid shiny N (1 in N).']])assert.equal(notice(usage,{o}),expected);
});

test('actual trainer-name validation is English and preserves trimming, offline storage and API contracts',async()=>{
 const s=await read('conta.mjs'),n=all(parseAst(s),n=>n.type==='FunctionDeclaration'&&n.id.name==='trocarNome')[0];assert(n);const code=s.slice(n.start,n.end);
 for(const name of ['', 'a','ab','  a  ']){
  const calls=[];const result=await vm.runInNewContext(code+';trocarNome(name)',{name,I18n:I,api:(...a)=>calls.push(a),gravar:(...a)=>calls.push(a)});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:false,erro:'Trainer names must contain at least 3 characters.'});assert.equal(calls.length,0);
 }
 for(const modo of ['offline','conta']){
  const requests=[],writes=[],scope={modo,I18n:I,api:async(...a)=>{requests.push(a);return{ok:true,dados:{nome:'Moeda Admin'}}},gravar:(...a)=>writes.push(a),gravarBruto:(...a)=>writes.push(a),ultimoHash:null,colherLocal:()=>({})};
  const result=await vm.runInNewContext(code+`;trocarNome('  Moeda   Admin  ')`,scope);assert.equal(result.ok,true);assert.equal(result.nome,'Moeda Admin');
  assert.deepEqual(writes,[['nome','"Moeda Admin"']]);assert.deepEqual(JSON.parse(JSON.stringify(requests)),modo==='conta'?[['POST','/conta/nome',{nome:'Moeda Admin'}]]:[]);
 }
});
