import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const ATALHOS_N ='),end=html.indexOf('function definirAtalho(',start),init=html.slice(start,end);
assert(start>=0&&end>start);
const fn=html.slice(end,html.indexOf('\nfunction abrirSeletorAtalho',end));
function boot(saved){const writes=[],jogo={ash:{}};const context={jogo,CONTA:{modo:'conta'},lerLS:()=>saved,gravarLS:(key,value)=>writes.push([key,JSON.parse(JSON.stringify(value))]),pintarAtalhos(){},flutuar(){}};vm.createContext(context);vm.runInContext(init+fn,context);return{jogo,writes,context};}

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
