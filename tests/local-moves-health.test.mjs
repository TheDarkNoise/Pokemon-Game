import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import * as Ind from '../individuo.mjs';
import {usarItemLocal} from '../servidor_itens.mjs';
import {aplicarEstadoLocal,prepararEstadoLocal} from '../servidor_estado_local.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),data=async n=>JSON.parse(await read('public/data/'+n+'.json'));
const dados={especies:JSON.parse(await read('public/pokedex.json')).species,learnset:await data('learnset'),golpes:await data('golpes')};
Ind.carregarLearnset(dados.learnset);
const cyndaquil=()=>({uid:'cyn',dex:155,lv:7,inicial:true,ivs:[15,15,15,15,15,15],natureza:'Hardy',hp:12,movs:[{id:'tackle',pp:25,ppMax:35}]});
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}
const html=await read('index.html'),source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('function desmontar('))[1],ast=parseAst(source),fn=name=>{const n=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name)[0];assert(n,name);return source.slice(n.start,n.end);};

test('client and server agree on the two starter moves; repairing Cyndaquil preserves HP and spent PP',()=>{
 const p=cyndaquil(),S=dados.especies.find(s=>s.n===155),fallback=Ind.fallbackDaEspecie(155,S,dados.golpes),expected=Ind.golpesPara(155,7,fallback);
 prepararEstadoLocal(p,dados);assert.deepEqual(p.movs.map(m=>m.id),['tackle','firespin']);assert.deepEqual(p.movs.map(m=>m.id),expected.map(m=>m.id));assert.equal(p.movs[0].pp,25);assert.equal(p.hp,12);
 const before=JSON.stringify(p);prepararEstadoLocal(p,dados);assert.equal(JSON.stringify(p),before);
});

test('low HP and fainted HP survive local save and a Poké Mart/Center scene reload without healing or PP refill',()=>{
 for(const hp of [9,0])for(const spent of [0,7]){const p=cyndaquil();prepararEstadoLocal(p,dados);aplicarEstadoLocal(p,{hp,movs:[{id:'tackle',pp:spent},{id:'firespin',pp:spent}]},dados);const fresh=JSON.parse(JSON.stringify(p));prepararEstadoLocal(fresh,dados);assert.equal(fresh.hp,hp);assert.deepEqual(fresh.movs.map(m=>m.pp),[spent,spent]);}
});

test('client state cannot grant health, refill PP, change level/IVs or add an unknown move',()=>{
 const p=cyndaquil();prepararEstadoLocal(p,dados);aplicarEstadoLocal(p,{hp:999,lv:100,ivs:[31,31,31,31,31,31],movs:[{id:'tackle',pp:999},{id:'ember',pp:999}]},dados);assert.equal(p.hp,12);assert.equal(p.lv,7);assert.deepEqual(p.ivs,[15,15,15,15,15,15]);assert.equal(p.movs[0].pp,25);
 const moves=JSON.stringify(p.movs);aplicarEstadoLocal(p,{movs:[{id:'invented-move',pp:5}]},dados);assert.equal(JSON.stringify(p.movs),moves);
});

test('actual dismount preserves the same Pokémon, move order, PP, current HP and cooldowns',()=>{
 const p={...cyndaquil(),movs:[{id:'tackle',pp:20,ppMax:35},{id:'ember',pp:7,ppMax:25}],golpesIds:['tackle','ember'],recargas:{ember:1.3},pivo:{position:{set(){}},visible:false}},before=JSON.stringify({movs:p.movs,hp:p.hp,cool:p.recargas,ids:p.golpesIds});
 const ash={x:0,z:0,y:0,pivo:{position:{set(){}},rotation:{set(){}}}},jogo={ash,pika:p,montaria:{voa:false,y:0,giro:0}};let saved=0;
 const result=vm.runInNewContext(fn('desmontar')+';desmontar()',{jogo,naAgua:()=>false,terraPerto:()=>({x:1,z:1}),guardarEstadoAtivo:()=>saved++,soltarMontaria:()=>{jogo.montaria=null},chaoEm:()=>0,livre:()=>true,tocarUma(){},soEsta(){}});
 assert.equal(result,true);assert.equal(saved,1);assert.equal(jogo.pika,p);assert.equal(p.pivo.visible,true);assert.equal(JSON.stringify({movs:p.movs,hp:p.hp,cool:p.recargas,ids:p.golpesIds}),before);
});

test('actual mounting hides the same partner without replacing its moves, HP, PP or cooldowns',async()=>{
 const p={...cyndaquil(),movs:[{id:'tackle',pp:20,ppMax:35},{id:'ember',pp:7,ppMax:25}],golpesIds:['tackle','ember'],recargas:{ember:1.3},pivo:{visible:true}},before=JSON.stringify({moves:p.movs,hp:p.hp,ids:p.golpesIds,cool:p.recargas});
 const transform={position:{set(){}},rotation:{set(){}},scale:{setScalar(){}},updateMatrixWorld(){}};
 const ash={x:0,z:0,y:0,vel:4,giro:0,pivo:transform},mount={altura:1,pivo:transform},jogo={ash,pika:p,selvagens:[]};let saved=0;
 await vm.runInNewContext(fn('montar')+";montar('test-mount')",{jogo,MONTARIAS:[['test-mount','Test','Idle','Run',false,1,10000,'terra']],podeMontar:()=>true,naAgua:()=>false,guardarEstadoAtivo:()=>saved++,modeloMon:async()=>({scene:{}}),montarCorpo:()=>mount,SkeletonUtils:{clone:s=>s},MERGULHO:{},params0:{get:()=>null},THREE:{Vector3:class{}},pontoDeSela:()=>({getWorldScale:o=>{o.x=1},add(){}}),tocarAnim(){},soEsta(){},semCorte(){},efeito(){},Som:{tocar(){}},flutuar(){},ADM:false});
 assert.equal(saved,1);assert.equal(jogo.pika,p);assert.equal(jogo.montaria,mount);assert.equal(p.pivo.visible,false);assert.equal(JSON.stringify({moves:p.movs,hp:p.hp,ids:p.golpesIds,cool:p.recargas}),before);
});

test('scene handlers snapshot the active Pokémon before flushing saves',()=>{
 for(const name of ['atravessar','irParaCena']){const code=fn(name);assert(code.indexOf('guardarEstadoAtivo();')<code.indexOf('await Conta.enviarAgora()'));assert(code.indexOf('await Conta.enviarAgora()')<code.indexOf('location.replace('));}
});

test('Ember consumes PP, zero PP blocks it, and damaging-move type immunity remains zero damage',()=>{
 const p={movs:[{id:'tackle',pp:1,ppMax:35},{id:'ember',pp:1,ppMax:25}]};assert(Ind.gastarPP(p,'ember'));assert.equal(p.movs[1].pp,0);assert.equal(Ind.gastarPP(p,'ember'),false);assert.equal(Ind.temPP(p,'ember'),false);assert.equal(Ind.semPP(p),false);Ind.gastarPP(p,'tackle');assert.equal(Ind.semPP(p),true);
 const defender={dex:19,lv:7,hp:40},attacker={dex:155,lv:7};let result;
 vm.runInNewContext(fn('golpear')+';result=golpear(attacker,defender,g)',{attacker,defender,g:{tipo:'Fire',cat:'especial',poder:40},INTRO:false,RAID:false,TORNEIO:false,DIRETOR:false,jogo:{pika:attacker},porDex:new Map([[155,{types:['Fire']}],[19,{types:['Normal']}]]),Mundo:{estaAtivo:()=>false},Ind:{statDe:()=>20},DB:{chart:{}},Conhecimento:{evento(){}},R:{efetividade:()=>0},aplicarGolpe(){},set result(v){result=v;}});
 assert.equal(result,0);assert.equal(defender.hp,40);
});


test('two potions become one after a successful use; full HP and unknown targets consume nothing',async()=>{
 const p=cyndaquil(),c={rev:0,save:{time:[p],itens:{2001:2},dinheiro:2500,bolas:{},insignias:[]}},catalogo=await data('menus_dados');
 const r=usarItemLocal(c,{item:2001,uid:p.uid,estado:{hp:9,movs:[{id:'tackle',pp:20},{id:'firespin',pp:7}]}},catalogo,dados);
 assert(!r.erro);assert.equal(c.save.itens[2001],1);assert.equal(p.hp,29);assert.equal(c.rev,1);assert.equal(JSON.parse(JSON.stringify(c)).save.itens[2001],1);
 p.hp=p.maxHp;const before=JSON.stringify(c);assert(usarItemLocal(c,{item:2001,uid:p.uid},catalogo,dados).erro);assert.equal(JSON.stringify(c),before);assert(usarItemLocal(c,{item:2001,uid:'unowned'},catalogo,dados).erro);assert.equal(JSON.stringify(c),before);
});


test('pinning, replacing and clearing shortcut 7 writes only preferences and never consumes bag items',()=>{
 const items={2001:2,2002:1},before=JSON.stringify(items),writes=[],jogo={ash:{},atalhos:[null,null,null,null,null]};
 const scope={jogo,ATALHOS_N:5,ATALHOS_TECLAS:['5','6','7','8','9'],gravarLS:(k,v)=>writes.push([k,JSON.parse(JSON.stringify(v))]),pintarAtalhos(){},flutuar(){}};
 vm.createContext(scope);vm.runInContext(fn('definirAtalho'),scope);
 for(const item of [{tipo:'item',id:2001,nome:'Poção'},{tipo:'item',id:2002,nome:'SuperPoção'},null]){scope.item=item;vm.runInContext('definirAtalho(2,item)',scope);assert.equal(jogo.atalhos[2],item);assert.equal(JSON.stringify(items),before);}
 assert(writes.every(([key])=>key==='atalhos'));assert.equal(writes.length,3);
});
