import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),menus=await readFile(new URL('../menus.mjs',import.meta.url),'utf8');
const script=html.slice(html.indexOf('<script type="module">')+22,html.lastIndexOf('</script>'));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const found=find(c,p);if(found)return found;}return null;}
const ast=parseAst(script),menuAst=parseAst(menus);
function fn(name,source=script,tree=ast){const n=find(tree,n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(n,name);return source.slice(n.start,n.end);}
const mon=(name,x,state='ocioso',visible=true)=>({name,x,z:0,estado:state,pivo:{visible}});
function targets(list){const scope={jogo:{ash:{x:0,z:0},selvagens:list,alvo:null}};vm.createContext(scope);const n=find(ast,n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='ALCANCE_ALVO'));vm.runInContext(script.slice(n.start,n.end)+fn('emPe')+fn('dePeMaisPerto')+fn('proximoAlvo'),scope);return scope;}

test('Tab cycles nearest standing targets within 8 metres, including boundary, and excludes farther targets',()=>{
 const far=mon('far',8.01),edge=mon('edge',8),near=mon('near',2),middle=mon('middle',5),s=targets([far,edge,middle,near]);
 for(const expected of [near,middle,edge,near]){vm.runInContext('proximoAlvo()',s);assert.equal(s.jogo.alvo,expected);}
 s.jogo.alvo=far;vm.runInContext('proximoAlvo()',s);assert.equal(s.jogo.alvo,near);
 s.jogo.ash.x=30;vm.runInContext('proximoAlvo()',s);assert.equal(s.jogo.alvo,null);
});

test('Tab excludes dead, stored, capturing and hidden Pokémon; fainted capture targets remain a fallback',()=>{
 const fainted=mon('fainted',1,'desmaiado'),standing=mon('standing',7),invalid=['morto','guardado','capturando','koTurno'].map(v=>mon(v,0.5,v)),hidden=mon('hidden',0.1,'ocioso',false),s=targets([fainted,...invalid,hidden,standing]);
 vm.runInContext('proximoAlvo()',s);assert.equal(s.jogo.alvo,standing);s.jogo.selvagens=s.jogo.selvagens.filter(m=>m!==standing);vm.runInContext('proximoAlvo()',s);assert.equal(s.jogo.alvo,fainted);s.jogo.ash=null;vm.runInContext('proximoAlvo()',s);assert.equal(s.jogo.alvo,null);
});

test('automatic next-target selection uses the same nearby distance',()=>{
 const s=targets([mon('far',9),mon('edge',8)]);assert.equal(vm.runInContext('dePeMaisPerto().name',s),'edge');assert.equal(vm.runInContext('dePeMaisPerto(jogo.selvagens[1])',s),null);
});

test('turning Click to move off saves device preference and immediately cancels the walking destination',()=>{
 const saved=new Map(),ash={alvoX:12,alvoZ:8},scope={ctx:{jogo:{ash},gravarLS:(k,v)=>saved.set(k,v)}};vm.createContext(scope);vm.runInContext(fn('definirCliqueParaMover',menus,menuAst),scope);vm.runInContext('definirCliqueParaMover(false)',scope);assert.equal(saved.get('controls.clickToMove'),false);assert.equal(ash.alvoX,null);assert.equal(ash.alvoZ,null);vm.runInContext('definirCliqueParaMover(true)',scope);assert.equal(saved.get('controls.clickToMove'),true);
});

test('actual ground destination handler blocks click and drag movement when disabled, works again when enabled',()=>{
 let enabled=false,rays=0;const scope={lerLS:()=>enabled,jogo:{ash:{y:0,alvoX:null,alvoZ:null}},tela:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})},ponteiro:{set(){}},cam:{},THREE:{Vector3:class{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}},Plane:class{}},raio:{setFromCamera(){rays++},ray:{intersectPlane(_plane,p){p.x=3;p.z=4;return p}}}};vm.createContext(scope);vm.runInContext(fn('cliqueParaMover')+fn('irPara'),scope);scope.ev={clientX:20,clientY:20};vm.runInContext('irPara(ev)',scope);assert.equal(rays,0);assert.equal(scope.jogo.ash.alvoX,null);enabled=true;vm.runInContext('irPara(ev)',scope);assert.equal(rays,1);assert.equal(scope.jogo.ash.alvoX,3);assert.equal(scope.jogo.ash.alvoZ,4);
});

test('disabled mouse walking preserves wild target selection and nearby NPC interactions',()=>{
 const n=find(ast,n=>n.type==='CallExpression'&&n.callee.object?.name==='tela'&&n.callee.property?.name==='addEventListener'&&n.arguments[0]?.value==='pointerdown');assert(n);
 let wild=null,npc=null,talked=0,moved=0;const scope={Fairy:null,Menus:{aberto:()=>false},Troca:{aberta:()=>false},tela:{setPointerCapture(){}},Som:{destravar(){}},jogo:{ativo:true,ash:{x:0,z:0}},falando:false,selvagemSobCursor:()=>wild,npcSobCursor:()=>npc,alcanceDeFala:()=>3,falarCom:()=>talked++,pertoDaMesa:()=>false,cliqueParaMover:()=>false,irPara:()=>moved++,noChao:()=>null};vm.createContext(scope);scope.handler=vm.runInContext('('+script.slice(n.arguments[1].start,n.arguments[1].end)+')',scope);const event={button:0,pointerId:1};scope.handler(event);assert.equal(moved,0);wild=mon('target',1);scope.handler(event);assert.equal(scope.jogo.alvo,wild);wild=null;npc={x:1,z:0};scope.handler(event);assert.equal(talked,1);scope.Fairy={bloqueiaClique:()=>false,npcSob:()=>{throw Error('Automatic NPC walking must be disabled')}};scope.handler(event);assert.equal(talked,2);
});
