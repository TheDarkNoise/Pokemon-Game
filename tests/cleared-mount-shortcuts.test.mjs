import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const ATALHOS_N ='),end=html.indexOf('function definirAtalho(',start),init=html.slice(start,end);
assert(start>=0&&end>start);
const fn=html.slice(end,html.indexOf('\nfunction abrirSeletorAtalho',end));
function boot(saved,enabled=['pm0059_00','pm0131_00']){const writes=[],jogo={ash:{}};const context={MONTARIAS_LIVRES:new Set(enabled),jogo,CONTA:{modo:'conta'},lerLS:()=>saved,gravarLS:(key,value)=>writes.push([key,JSON.parse(JSON.stringify(value))]),pintarAtalhos(){},flutuar(){}};vm.createContext(context);vm.runInContext(init+fn,context);return{jogo,writes,context};}

test('actual page initialization preserves saved cleared slots, including an empty array',()=>{
 for(const saved of [[],[null,null,null,null,null]]){const r=boot(saved);assert.deepEqual(JSON.parse(JSON.stringify(r.jogo.atalhos)),[null,null,null,null,null]);assert.equal(r.writes.length,0);}
});

test('clear both starter mounts and change maps repeatedly: neither mount returns',()=>{
 const first=boot(null);assert.deepEqual(Array.from(first.jogo.atalhos.filter(Boolean),m=>m.glb),['pm0059_00','pm0131_00']);
 vm.runInContext('definirAtalho(0,null);definirAtalho(1,null)',first.context);
 let saved=JSON.parse(JSON.stringify(first.jogo.atalhos));
 for(let i=0;i<3;i++){const next=boot(saved);assert.equal(next.jogo.atalhos.filter(Boolean).length,0);assert.equal(next.writes.length,0);saved=JSON.parse(JSON.stringify(next.jogo.atalhos));}
});

test('saved potion shortcut remains in slot 7 without adding mounts to other empty slots',()=>{
 const potion={tipo:'item',id:2001,nome:'Poção'},saved=[null,null,potion,null,null],before=JSON.stringify(saved),r=boot(saved);
 assert.deepEqual(JSON.parse(JSON.stringify(r.jogo.atalhos)),saved);assert.equal(r.writes.length,0);assert.equal(JSON.stringify(saved),before);
});


test('fresh accounts receive only mounts explicitly enabled by admin',()=>{
 for(const enabled of [[],['pm0059_00'],['pm0131_00'],['pm0059_00','pm0131_00']]){
  const first=boot(null,enabled);assert.deepEqual(Array.from(first.jogo.atalhos.filter(Boolean),m=>m.glb),enabled);
 }
});

test('current mount catalogue wins over stale website data and unavailable settings grant no mounts',async()=>{
 const start=html.indexOf('const MONTARIAS_ARQ ='),end=html.indexOf('/** Quanto',start);
 const availabilityStart=html.indexOf('const MONTARIAS_LIVRES ='),availabilityEnd=html.indexOf('const podeMontar',availabilityStart);
 const run=async(result,ok=true)=>{let requested;const scope={Conta:{baseHttp:()=>'/servidor'},location:{search:''},URLSearchParams,MONTARIAS_PADRAO:[],fetch:async(url,options)=>{requested={url,options};return{ok,json:async()=>result}}};vm.createContext(scope);const free=await vm.runInContext('(async()=>{'+html.slice(start,end)+html.slice(availabilityStart,availabilityEnd)+'return [...MONTARIAS_LIVRES]})()',scope);assert.equal(requested.url,'/servidor/montarias');assert.equal(requested.options.cache,'no-store');return Array.from(free);};
 assert.deepEqual(await run([{glb:'pm0059_00',livre:false},{glb:'pm0131_00',livre:false}]),[]);
 assert.deepEqual(await run([{glb:'pm0131_00',livre:true}]),['pm0131_00']);
 assert.deepEqual(await run([]),[]);assert.deepEqual(await run(null,false),[]);
});

test('public mount endpoint reads changed admin data on each call without altering it',async()=>{
 const server=await readFile(new URL('../servidor.mjs',import.meta.url),'utf8'),start=server.indexOf("  if (req.method === 'GET' && rota === '/montarias')"),end=server.indexOf('  // ── Upload',start);
 let catalogue=[{glb:'pm0059_00',livre:true}],headers={};const ctx={req:{method:'GET'},rota:'/montarias',res:{setHeader:(k,v)=>headers[k]=v},fs:{readFileSync:()=>JSON.stringify(catalogue)},nodePath:{join:()=>'/data/montarias.json'},DADOS_PUB:'/data',json:(status,data)=>({status,data})};vm.createContext(ctx);
 const run=()=>vm.runInContext('(function(){'+server.slice(start,end)+'})()',ctx);
 assert.equal(run().data[0].livre,true);catalogue[0].livre=false;assert.equal(run().data[0].livre,false);assert.equal(headers['Cache-Control'],'no-store');assert.equal(catalogue[0].livre,false);
 catalogue=[];assert.equal(run().status,200);catalogue=null;assert.equal(run().status,503);
});
