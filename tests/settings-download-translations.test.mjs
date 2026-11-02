import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
function walk(n,find){if(!n||typeof n!=='object')return;find(n);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(x=>walk(x,find)):walk(v,find);}
test('settings display labels translate without changing the quality setting values',async()=>{
 const source=await readFile(new URL('../menus.mjs',import.meta.url),'utf8');let declaration;
 walk(parseAst(source),n=>{if(n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='QUALIDADES'))declaration=source.slice(n.start,n.end);});
 const values=vm.runInNewContext(declaration+';QUALIDADES');assert.deepEqual(Array.from(values.ops),['baixa','alta']);assert.deepEqual(Array.from(values.rot,I.t),['Low','High']);
 for(const [s,t] of [['Menor','Smaller'],['Maior','Larger'],['Visual novo (beta)','New look (beta)'],['Ligar','Enable']])assert.equal(I.t(s),t);
});
test('actual chat markup translates the collapse tooltip and retains channel identifiers',async()=>{
 const source=await readFile(new URL('../chat.mjs',import.meta.url),'utf8');let template;
 walk(parseAst(source),n=>{if(n.type==='AssignmentExpression'&&n.left.object?.name==='el'&&n.left.property?.name==='innerHTML'&&source.slice(n.right.start,n.right.end).includes('recolher / abrir'))template=source.slice(n.right.start,n.right.end);});assert(template);
 const html=vm.runInNewContext(template,{ABAS:['local'],CANAIS:{local:{nome:'Local'}},aba:'local',compacto:true,tr:I.t});assert.match(html,/title="collapse \/ expand"/);assert.match(html,/data-aba="local"/);assert.match(html,/>Send<\/button>/);
});
test('download failure dialog translates its detail and preserves the retry state transition',async()=>{
 const source=await readFile(new URL('../index.html',import.meta.url),'utf8');let fn;
 for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(m[1].includes('importmap'))continue;const s=m[2];walk(parseAst(s),n=>{if(n.type==='FunctionDeclaration'&&n.id.name==='bootErroCarga')fn=s.slice(n.start,n.end);});}assert(fn);
 const make=()=>({style:{},children:[],appendChild(n){this.children.push(n)},append(...n){this.children.push(...n)},addEventListener(name,cb){this[name]=cb;}}),boot=make();
 const context=vm.createContext({I18n:I,bootErroEspera:null,bootCaixa:{},bootErroNaTela:false,$:id=>id==='boot'?boot:null,document:{createElement:make}});
 const done=vm.runInContext(fn+";bootErroCarga({url:'/cenario/kanto.glb',recebido:1048576,total:4194304},'Este mapa ainda não foi liberado.',true,'É preciso entrar com a sua conta.')",context);
 const [title,body,button,details]=boot.children[0].children;assert.equal(title.textContent,'You need to sign in.');assert.equal(body.textContent,'This map has not been unlocked yet.');assert.equal(button.textContent,'Retry');assert.equal(details.textContent,'/cenario/kanto.glb · 1.0/4.0 MB already downloaded');assert.equal(boot.style.zIndex,'400');
 button.click();await done;assert.equal(context.bootErroNaTela,false);assert.equal(context.bootErroEspera,null);assert.equal(button.disabled,true);
});
