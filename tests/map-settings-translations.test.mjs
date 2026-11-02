import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
const layout=JSON.parse(await readFile(new URL('../ui/hud_layout.json',import.meta.url),'utf8'));
function texts(n,out=[]){if(!n||typeof n!=='object')return out;for(const [k,v] of Object.entries(n)){if(['texto','exemplo'].includes(k)&&typeof v==='string')out.push(I.t(v));else if(v&&typeof v==='object')texts(v,out);}return out;}
test('shipped map, quest and settings layouts display English in desktop and landscape orientations',()=>{
 for(const orientation of ['pc','deitado']){
  const all=texts(layout.popups[orientation]);
  for(const label of ['General','Controls','Account','Music','Accessibility','Change password','Main','Side quests'])assert(all.includes(label),orientation+': '+label);
 }
 assert.equal(I.t('MAPA '),'MAP ');
 assert.equal(I.t('Clique numa área pra ver os Pokémon dela'),'Click an area to see its Pokémon');
 assert.equal(I.t('Toque numa área pra ver os Pokémon dela'),'Tap an area to see its Pokémon');
});
test('quest tracker renders English reward labels, locations and item names without changing quest data',async()=>{
 const source=await readFile(new URL('../missoes.mjs',import.meta.url),'utf8'),ast=parseAst(source);
 const extract=name=>{let n=ast.body.find(n=>(n.declaration||n).id?.name===name);n=n?.declaration||n;assert(n,name);return source.slice(n.start,n.end);};
 const step={texto:'Escolha um dos três iniciais na mesa do laboratório do Oak.',onde:'(Laboratório do Oak)',tipo:'inicial'},mission={nome:'Capítulo 1 · Cidade Pallet',passos:[step],recompensa:{moedas:500,exp:100,itens:{2001:5}}};
 const before=JSON.stringify(mission),context={tr:I.t,ativa:()=>mission,passoAtual:()=>step,progresso:()=>0,estado:{passo:0},ctx:{nomeItem:()=> 'Pokébola'},esc:s=>String(s)};
 const html=vm.runInNewContext(extract('textoRecompensa')+';'+extract('textoTracker')+';textoTracker()',context);
 assert.match(html,/Chapter 1 · Pallet Town/);assert.match(html,/Oak’s Lab/);assert.match(html,/Reward:.*500 coins.*100 XP.*Poké Ball ×5/);assert.equal(JSON.stringify(mission),before);
});
test('the actual minimap display assignment translates source area names',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('importmap'));
 const matches=[];
 function walk(n,s){if(!n||typeof n!=='object')return;if(n.type==='AssignmentExpression'&&n.left?.object?.name==='mmA'&&n.left?.property?.name==='textContent')matches.push(s.slice(n.start,n.end));for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(x=>walk(x,s)):walk(v,s);}
 for(const m of scripts)walk(parseAst(m[2]),m[2]);assert.equal(matches.length,1);
 const mmA={textContent:''};vm.runInNewContext(matches[0],{mmA,nomeAreaAtual:()=> 'Cidade Pallet',tr:I.t});assert.equal(mmA.textContent,'Pallet Town');
});
test('dynamic menu labels preserve counts and Portuguese mode preserves source labels',async()=>{
 assert.equal(I.t('Membros — 23 de 50'),'Members — 23 of 50');assert.equal(I.t('anúncios: 3 de 8'),'listings: 3 of 8');
 assert.equal(I.t('vendedor: Brock'),'seller: Brock');assert.equal(I.t('Capítulo 2 · Cidade Viridian'),'Chapter 2 · Viridian City');assert.equal(I.t('Pikachu'),'Pikachu');
 await I.carregar('pt');assert.equal(I.t('Capítulo 2 · Cidade Viridian'),'Capítulo 2 · Cidade Viridian');assert.equal(I.t('Conta'),'Conta');await I.carregar('en');
});
