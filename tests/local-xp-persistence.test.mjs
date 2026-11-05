import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {experienciaLocal} from '../servidor_experiencia.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),data=async n=>JSON.parse(await read('public/data/'+n+'.json'));
const config={exp:await data('exp'),especies:JSON.parse(await read('public/pokedex.json')).species,learnset:await data('learnset'),golpes:await data('golpes'),tetoNivel:(await data('config_jogo')).tetoNivel};
const curve=config.exp.curvas[config.exp.especies[4].c];
const account=()=>({rev:0,save:{dinheiro:2500,insignias:[],time:[{uid:'starter-uid',dex:4,nome:'Moeda',lv:5,exp:curve[5],ivs:[15,15,15,15,15,15],natureza:'Hardy',hp:20,movs:[{id:'scratch',pp:30,ppMax:35}]}]}});
const event=i=>({id:'battle-receipt-'+i,uid:'starter-uid',derrotado:{dex:16,lv:5}});
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}

test('level 5 starter reaches level 6 in the persisted account and remains level 6 after scene reload',()=>{
 const c=account();let i=0;while(c.save.time[0].lv===5){assert(experienciaLocal(c,event(i++),config).ok);assert(i<20);}
 const fresh=JSON.parse(JSON.stringify(c)),p=fresh.save.time[0];assert.equal(p.lv,6);assert(p.exp>=curve[6]);assert.equal(p.uid,'starter-uid');assert.deepEqual(p.ivs,[15,15,15,15,15,15]);assert.equal(p.natureza,'Hardy');assert.equal(p.nome,'Moeda');assert.equal(fresh.save.dinheiro,2500);assert.equal(p.movs[0].pp,30);
});

test('server calculates XP and ignores client-supplied level/money/XP; retries do not award twice',()=>{
 const c=account(),e={...event(1),exp:1e9,lv:100,dinheiro:1e9};const r=experienciaLocal(c,e,config);assert(r.ok);assert(r.ganho<1000);const before=JSON.stringify(c);assert(experienciaLocal(c,e,config).repetido);assert.equal(JSON.stringify(c),before);assert.equal(c.save.dinheiro,2500);assert(c.save.time[0].lv<10);
});

test('unknown Pokémon, invalid opponent levels and malformed receipts cannot change saves',()=>{
 for(const e of [{...event(1),uid:'another-account-mon'},{...event(1),derrotado:{dex:16,lv:101}},{...event(1),id:''}]){const c=account(),before=JSON.stringify(c);assert(experienciaLocal(c,e,config).erro);assert.equal(JSON.stringify(c),before);}
});

test('level cap stores excess XP instead of losing it and level-up move learning survives serialization',()=>{
 const c=account();c.save.time[0].lv=20;c.save.time[0].exp=curve[21]-1;const r=experienciaLocal(c,event(1),config);assert(r.ok);assert.equal(c.save.time[0].lv,20);assert.equal(c.save.time[0].exp,curve[21]-1);assert.equal(c.save.time[0].expReserva,r.ganho);
 const learning=account();learning.save.time[0].lv=16;learning.save.time[0].exp=curve[17]-1;experienciaLocal(learning,event(2),config);assert.equal(learning.save.time[0].lv,17);assert(JSON.parse(JSON.stringify(learning)).save.time[0].movs.some(m=>m.id==='firefang'));
});

test('client flush waits for acknowledgement and retries the same receipt after a failure',async()=>{
 const source=await read('conta.mjs'),a=source.indexOf('const experienciaPendente = new Map();');const ast=parseAst(source);const end=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='enviarAgora')[0].end;
 const requests=[];let complete;const scope={modo:'conta',travado:false,crypto:{randomUUID:()=> 'test-receipt-0001'},api:(_m,_p,body)=>{requests.push(body);return new Promise(r=>complete=r)},despachar:()=>null};
 vm.createContext(scope);vm.runInContext(source.slice(a,end).replace(/export /g,'')+";registrarExperienciaLocal('starter-uid',{dex:16,lv:5});",scope);
 let finished=false;const failed=vm.runInContext('enviarAgora()',scope).then(r=>{finished=true;return r});await Promise.resolve();assert.equal(finished,false);complete({ok:false});assert.equal(await failed,false);
 const retry=vm.runInContext('enviarAgora()',scope);assert.equal(requests.length,2);assert.equal(requests[0].id,requests[1].id);complete({ok:true});assert.equal(await retry,true);assert.equal(await vm.runInContext('enviarAgora()',scope),true);assert.equal(requests.length,2);
});

test('door navigation waits for the account flush and refuses to reload when XP cannot be saved',async()=>{
 const html=await read('index.html'),source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('async function atravessar('))[1],ast=parseAst(source),fn=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='atravessar')[0];const tail=source.slice(fn.start,fn.end),start=tail.indexOf('  if (await Conta.enviarAgora() === false)');assert(start>=0);
 for(const ok of [false,true]){const calls=[],jogo={navegando:true},boot={hidden:false},scope={Conta:{enviarAgora:async()=>{calls.push('saved');return ok}},jogo,portaOcupado:true,$:()=>boot,Chat:{sistema:s=>calls.push(s)},sessionStorage:{setItem(){}},descarregarCena:()=>calls.push('unload'),location:{replace:()=>calls.push('reload')},u:{toString:()=>'/center'}};
  await vm.runInNewContext('(async()=>{'+tail.slice(start,-1)+'})()',scope);assert.equal(calls[0],'saved');assert.equal(calls.includes('reload'),ok);if(!ok){assert.equal(jogo.navegando,false);assert.equal(boot.hidden,true);}
 }
});
