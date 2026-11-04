import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const layout=JSON.parse(await read('ui/hud_layout.json')),source=await read('popup.mjs'),ast=parseAst(source);
const fn=ast.body.find(n=>(n.declaration||n).type==='FunctionDeclaration'&&(n.declaration||n).id.name==='encherExemplo').declaration;
const raw=ast.body.flatMap(n=>(n.declaration||n).declarations||[]).find(n=>n.id.name==='EXEMPLOS_BRUTOS');assert(raw);
const execute=ctx=>vm.runInNewContext('const EXEMPLOS_BRUTOS='+source.slice(raw.init.start,raw.init.end)+';'+source.slice(fn.start,fn.end)+';encherExemplo(pop)',ctx);
function tree(def){const node={style:{},dataset:{},textContent:'',children:(def.filhos||[]).map(f=>({f,node:tree(f)})),querySelector(selector){return this.children.find(({f})=>selector.includes('[data-fig="'+(f.nome||'')+'"]'))?.node||null;},querySelectorAll(){return[];}};return node;}
function find(root,p){if(p(root))return root;for(const value of Object.values(root||{}))if(value&&typeof value==='object'){for(const x of Array.isArray(value)?value:[value]){const n=find(x,p);if(n)return n;}}return null;}

test('actual preview filler translates the shipped compact collector label and other authored labels',()=>{
 const summary=find(layout,n=>n.id==='col-conhecimento'&&n.exemplo==='0 Mestre · 3 pontos'),button=find(layout,n=>n.tipo==='txt'&&n.exemplo==='Antídoto');assert(summary);assert(button);
 const def={filhos:[summary,button]},pop=tree(def);pop.__def=def;const before=JSON.stringify(def);
 execute({pop,tr:I.t,Hud:{fill(){},fundoComFolga(){}}});assert.equal(pop.children[0].node.textContent,'0 Master · 3 points');assert.equal(pop.children[1].node.textContent,'Antidote');assert.equal(JSON.stringify(def),before);
});

test('preview translation preserves name examples, existing player text, image paths, padding and fill behavior',()=>{
 const def={filhos:[{nome:'name',tipo:'txt',id:'jogador-nome',exemplo:'Moeda'},{nome:'species',tipo:'txt',id:'pokemon-nome',exemplo:'Cancelar'},{nome:'message',tipo:'txt',id:'ultima-mensagem',exemplo:'bora capturar?'},{nome:'image',tipo:'imgvar',id:'icon',exemplo:'ui/Moeda.png',exemploPad:4},{nome:'fill',tipo:'fill',id:'hp'}]},pop=tree(def);pop.__def=def;pop.children[2].node.textContent='Moeda · encontro às 17h';const calls=[];
 execute({pop,tr:I.t,Hud:{fill:(el,k)=>calls.push(['fill',k]),fundoComFolga:(el,k)=>calls.push(['padding',k])}});
 assert.equal(pop.children[0].node.textContent,'Moeda');assert.equal(pop.children[1].node.textContent,'Cancelar');assert.equal(pop.children[2].node.textContent,'Moeda · encontro às 17h');assert.equal(pop.children[3].node.style.backgroundImage,'url(ui/Moeda.png)');assert.deepEqual(calls,[['padding',4],['fill',0.7]]);
});
