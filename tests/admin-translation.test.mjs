import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
const sources = Object.fromEntries(await Promise.all(['admin/admin.mjs','admin/camadas.mjs','admin/jogadores.mjs','servidor.mjs'].map(async f=>[f,await readFile(new URL('../'+f,import.meta.url),'utf8')])));
function find(file,predicate){const source=sources[file];let found;function walk(n){if(!n||typeof n!=='object'||found)return;if(predicate(n)){found=n;return;}for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);}walk(parseAst(source));assert(found,'Missing source fixture in '+file);return source.slice(found.start,found.end);}
const fn=(file,name)=>find(file,n=>n.type==='FunctionDeclaration'&&n.id.name===name);
const initial=(file,name)=>find(file,n=>n.type==='VariableDeclarator'&&n.id.name===name).split('=').slice(1).join('=');
const plain=v=>JSON.parse(JSON.stringify(v));

test('player bag editor sends the money field accepted by the server',()=>{
 let sent;
 const money={value:'1250'},item={dataset:{item:'2001'},querySelector:()=>({value:'2'})};
 const document={querySelectorAll:s=>s.includes('data-bola')?[{dataset:{bola:'1001'},value:'5'}]:[{dataset:{ins:'101'}}]};
 const context={$:id=>id==='j-dinheiro'?money:{querySelectorAll:()=>[item]},document,det:{conta:{online:false}},acao:(op,body)=>{sent={op,body};}};
 const handler=find('admin/jogadores.mjs',n=>n.type==='AssignmentExpression'&&n.left.property?.name==='onclick'&&n.left.object.arguments?.[0]?.value==='j-bolsa-ok');
 vm.runInNewContext(handler.slice(handler.indexOf('=')+1).trim().replace(/^/,'(')+')()',context);
 assert.equal(sent.op,'bolsa');assert.equal(sent.body.dinheiro,1250);assert(!('money'in sent.body));
 const cleaned=vm.runInNewContext(fn('servidor.mjs','limparBolsa')+';limparBolsa(body)',{body:sent.body,itemExiste:()=>true});
 assert.deepEqual(plain(cleaned.bolsa),{dinheiro:1250,itens:{2001:2},bolas:{1001:5},insignias:[101]});
});

test('grass painting remains selectable, marks the grass layer and saves its canonical payload',async()=>{
 const file='admin/camadas.mjs',d={grama:[],agua:[],spawn:[]};const calls=[];
 const context={indice:null,avisouSemArea:false,FLIPX:-1,dados:()=>d,t2w:(x,z)=>[x,z],areaEm:()=>1201,toast(){},atualizarContagem(){},redesenhar(){},aoMudar(){},glbSujos:new Set(),portasSujas:new Set(),mapa:()=> 'kanto',avisarJogo(){},api:async(...a)=>{calls.push(a);return{ok:true};}};
 const setup='const TIPO_TILE='+initial(file,'TIPO_TILE')+';const sujo='+initial(file,'sujo')+';const pincel='+initial(file,'pincel')+';const marcar=k=>{sujo[k]=true;};'+find(file,n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='celula'))+';';
 const program=setup+fn(file,'cfgGrama')+fn(file,'tileNovo')+fn(file,'aplicarPincel')+fn(file,'salvar')+';aplicarPincel(0,0); if(!TIPO_TILE.grama)throw Error("grass not selectable");salvar();';
 await vm.runInNewContext(program,context);
 assert.equal(d.grama.length,9);assert(!('grass'in d));assert(d.grama.every(t=>t.tipo===41&&t.a===1201));
 assert.equal(calls.length,1);assert.equal(calls[0][0],'/admin/mapa-camadas');assert.equal(calls[0][1],'POST');
 assert.deepEqual(plain(calls[0][2]),{mapa:'kanto',grama:plain(d.grama)});
});

test('area saving sends boxes under the field required by the server',async()=>{
 let request;
 const data={caixas:[{a:1201,x:0,z:0,sx:10,sz:10}],nomes:{1201:'Route 1'},grama:[{a:1201}],agua:[{a:1201}]};
 const noop=()=>{};
 await vm.runInNewContext(fn('admin/admin.mjs','salvarAreas')+';salvarAreas()',{
  nomesMudados:new Set([1201]),dadosMapa:data,mapaAtual:'kanto',tilesMudados:true,nomesCena:{},areasOriginais:new Set(),sujoAreas:true,
  api:async(...a)=>{request=a;return{ok:true,areas:1,caixas:1};},toast:noop,avisarJogo:noop,atualizarSujoMapa:noop,renderListaAreas:noop,atualizarCamposArea:noop,renderHabitats:noop,desenhar:noop,
 });
 assert.equal(request[0],'/admin/mapa-areas');assert.equal(request[1],'POST');
 assert.deepEqual(plain(request[2]),{mapa:'kanto',caixas:data.caixas,nomes:{1201:'Route 1'},tilesArea:{grama:[1201],agua:[1201]}});
 assert(!('boxes'in request[2]));
});
