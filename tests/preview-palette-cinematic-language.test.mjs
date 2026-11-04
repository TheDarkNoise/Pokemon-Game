import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const h=find(c,p);if(h)return h;}return null;}
const menus=await read('menus.mjs'),ast=parseAst(menus),fn=name=>{const n=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return menus.slice(n.start,n.end);};
const init=name=>{const n=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name===name);assert(n,name);return menus.slice(n.init.start,n.init.end);};

test('actual admin preview palette shows English labels while callbacks retain canonical window IDs',()=>{
 const buttons=[],calls=[],sections={},close={};let palette;
 const document={createElement:tag=>tag==='button'?{style:{}}:palette={querySelector:s=>s==='.fecha'?close:(sections[s]??={appendChild:b=>buttons.push(b)}),remove(){}},body:{appendChild(){}}};
 const scope={document,ctx:{gm:()=>true,MOBILE:false,jogo:{hudLayout:{popups:{pc:{mercado:{},guilda:{},inicial:{},'banner-evento':{},mochila:{},missoes:{},config:{}}}}}},ehV2:()=>true,Hud:{},tr:I.t,paletaPrevia:null,popPrevia:null,fecharPrevia(){},fechar(){},abrirPrevia:n=>calls.push(['preview',n]),abrir:n=>calls.push(['window',n]),abrirEmBreve:n=>calls.push(['soon',n]),abrirPreviaMochila:()=>calls.push(['full-bag']),Chat:{sistema:()=>assert.fail('unexpected warning')}};
 const result=vm.runInNewContext('const ORDEM_PREVIA='+init('ORDEM_PREVIA')+';const PREVIA_NOMES='+init('PREVIA_NOMES')+';const JANELAS='+init('JANELAS')+';'+fn('previa')+';previa(true)',scope);
 assert.equal(result,true);assert(palette.innerHTML.includes('Game windows'));assert(palette.innerHTML.includes('Mockups with Amanda’s examples'));assert(palette.innerHTML.includes('Coming soon banners by feature'));
 for(const [label,expected]of [['Marketplace',['preview','mercado']],['Guild',['preview','guilda']],['Starter Pokémon',['preview','inicial']],['Event banner',['preview','banner-evento']],['Bag',['window','mochila']],['Quests',['window','missoes']],['Settings',['window','config']],['Full bag',['full-bag']],['Arcade',['soon','fliperama']]]){
  const b=buttons.find(b=>b.textContent===label);assert(b,label);b.onclick();assert.deepEqual(calls.at(-1),expected);
 }
});

test('actual raid cinematic exit and trainer counter translate while retaining exit controls and counts',async()=>{
 const html=await read('index.html'),source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('async function rodarRaid('))[1],a=parseAst(source),raid=find(a,n=>n.type==='FunctionDeclaration'&&n.id.name==='rodarRaid'),code=source.slice(raid.start,raid.end);
 const start=code.indexOf("const sair = document.createElement('button')"),end=code.indexOf('ash.pivo.visible',start);assert(start>=0&&end>start);
 let button,exits=0;const keys=[];
 vm.runInNewContext(code.slice(start,end),{I18n:I,document:{createElement:()=>button={},body:{appendChild:b=>assert.equal(b,button)}},terminarRaid:()=>exits++,window:{addEventListener:(...a)=>keys.push(a)}});
 assert.equal(button.textContent,'Exit ▸');assert.equal(button.id,'raid-sair');button.onclick();keys[0][1]({code:'Escape'});assert.equal(exits,2);
 const counter=find(raid,n=>n.type==='AssignmentExpression'&&n.left.object?.callee?.property?.name==='querySelector'&&n.left.object.arguments[0]?.value==='#rt-jog');assert(counter);
 for(const count of [1,10]){const el={};vm.runInNewContext(source.slice(counter.start,counter.end),{I18n:I,duplas:{length:count},topo:{querySelector:()=>el}});assert.equal(el.textContent,count+' trainers in battle');}
});

test('actual empty-raid fallback translates and keeps an available renderer in control',()=>{
 const fallback={};vm.runInNewContext(fn('rRaid')+';rRaid(corpo)',{corpo:fallback,raidApi:null,tr:I.t,esc:s=>s});assert(fallback.innerHTML.includes('No raid is currently announced.'));
 const handled={innerHTML:'existing raid'};vm.runInNewContext(fn('rRaid')+';rRaid(corpo)',{corpo:handled,raidApi:{simples:()=>true},tr:I.t,esc:s=>s});assert.equal(handled.innerHTML,'existing raid');
});
