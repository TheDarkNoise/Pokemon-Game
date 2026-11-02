import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
const gyms=JSON.parse(await readFile(new URL('../public/data/ginasios.json',import.meta.url),'utf8'));
const trainers=JSON.parse(await readFile(new URL('../public/data/treinadores.json',import.meta.url),'utf8'));
const classes={'Alpinista':'Hiker','Aluno':'Student','Campista':'Camper','Gêmeas':'Twins','Irmãos Lutadores':'Fighting Brothers','Jovem':'Youngster','Menina de Pique Nique':'Picnicker','Menino de Shorts':'Youngster','Montanhista':'Hiker','Mentor':'Mentor','Team Rocket':'Team Rocket'};
const expressions=[];const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function walk(n,s){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee.name==='rotuloSprite')expressions.push(s.slice(n.arguments[0].start,n.arguments[0].end));for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(x=>walk(x,s)):walk(v,s);}
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('importmap'))walk(parseAst(m[2]),m[2]);
test('all shipped trainer classes and battle dialogue translate while personal names and raw data stay intact',()=>{
 const before=JSON.stringify(trainers);let lines=0;
 for(const [id,t] of Object.entries(trainers)){
  const [type,...rest]=t.nome.split('-');const nick=rest.join('-').trim();assert(classes[type.trim()],id);
  assert.equal(I.t(t.nome),classes[type.trim()]+' - '+nick,id);
  for(const key of ['fala','vitoria','derrota'])for(const line of t[key]||[]){assert.notEqual(I.t(line),line,id+': '+line);lines++;}
 }
 assert.equal(Object.keys(trainers).length,60);assert.equal(lines,240);assert.equal(JSON.stringify(trainers),before);
});
test('actual trainer nameplate expressions translate before adding battle and victory markers',()=>{
 const selected=expressions.filter(s=>/I18n\.t\((?:info\.nome|t\.nome)/.test(s));assert.equal(selected.length,3);
 for(const trainer of Object.values(trainers))for(const expr of selected)for(const venceu of [false,true]){
  const out=vm.runInNewContext(expr,{I18n:I,info:trainer,t:trainer,n:{nome:trainer.nome},venceu});
  assert.match(out,/^[✔⚔] /);assert.equal(out.slice(2),I.t(trainer.nome));
 }
});
test('gym and Elite nameplate expressions translate each label independently',()=>{
 const fixtures={I18n:I,tem:false,g:Object.values(gyms)[0],M:{nome:'Lance',titulo:'Campeão'},E:{nome:'Red'}};
 const selected=expressions.filter(s=>s.includes('I18n.t(g.nome)')||s.includes('I18n.t(M.titulo')||s.includes("I18n.t('ex-Campeão')"));assert.equal(selected.length,4);
 for(const expr of selected){const out=vm.runInNewContext(expr,fixtures);assert(!out.includes('ex-Campeão'));assert(!out.includes('Ginásio'));assert(!out.includes('Campeão'));}
});

test('source area-name aliases translate without changing numeric area identifiers',async()=>{
 const map=JSON.parse(await readFile(new URL('../public/data/mapa_kanto_pontos.json',import.meta.url),'utf8'));
 assert.equal(I.t(map.nomes['1104']),'Cerulean City');assert.equal(I.t(map.nomes['1106']),'Lavender Town');assert(map.areas['1104']);assert(map.areas['1106']);
 assert.equal(I.t('Quarto do Lorelei'),'Lorelei’s Room');
});
