import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ehCidade,ehCidadeOuIlha,ehLocalidade} from '../areas.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('fixtures/area-name-migration.json',import.meta.url),'utf8'));
const get=(data,path)=>path.reduce((o,k)=>o[k],data);
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);

test('every shipped area and scene name is stored in English; IDs, geometry and all other fields are unchanged',async()=>{
 assert.equal(manifest.fields.length,592);
 for(const [file,digest] of Object.entries(manifest.files)){
  const data=JSON.parse(await readFile(new URL(file,root),'utf8'));
  for(const field of manifest.fields.filter(r=>r.file===file)){
   assert.equal(get(data,field.path),field.en,file+':'+field.path.join('/'));
   const parent=get(data,field.path.slice(0,-1));parent[field.path.at(-1)]=null;
  }
  assert.equal(createHash('sha256').update(canonical(data)).digest('hex'),digest,file+' changed outside approved name fields');
 }
 const scenes=JSON.parse(await readFile(new URL('public/data/cenas.json',root),'utf8'));
 assert.equal(scenes.cenas.flatMap(c=>c.areas).find(a=>a.id===1192).nome,'Safari Zone');
 assert.equal(scenes.cenas.flatMap(c=>c.areas).find(a=>a.id===1101).nome,'Pallet Town');
});

test('renaming preserves original city spawn exclusions, landmark styling and city counts for every shipped label',()=>{
 for(const {source,en}of manifest.fields.filter(r=>r.kind==='map-area')){
  assert.equal(ehCidade(en),/^Cidade/.test(source),source+' city');
  assert.equal(ehCidadeOuIlha(en),/Cidade|Ilha/.test(source),source+' count');
  assert.equal(ehLocalidade(en),/Cidade|Ilha|Liga/.test(source),source+' landmark');
 }
 assert.equal(ehCidade('My private garden'),false);assert.equal(ehCidade('Cidade personalizada'),true);
});

test('the actual editable area-name field receives the saved English value without changing its area ID',async()=>{
 const vm=await import('node:vm'),{parseAst}=await import('rollup/parseAst');
 const source=await readFile(new URL('admin/admin.mjs',root),'utf8'),ast=parseAst(source);
 function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v]){const hit=find(c,p);if(hit)return hit;}return null;}
 const fn=find(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='atualizarCamposArea');
 const data=JSON.parse(await readFile(new URL('public/data/kanto.json',root),'utf8'));
 const elements={},box=data.caixas.find(c=>c.a===1192);
 vm.runInNewContext(source.slice(fn.start,fn.end)+';atualizarCamposArea()',{$:id=>elements[id]||={},caixaSel:box,dadosMapa:data,areasOriginais:new Set([1192]),document:{activeElement:null},FLIPX:-1,tilesDentro:()=>({dentro:0,grama:[],agua:[]}),nomeArea:a=>data.nomes[a],rotuloArea:a=>data.nomes[a]});
 assert.equal(elements['a-nome'].value,'Safari Zone');assert.equal(elements['a-id'].value,1192);
});
