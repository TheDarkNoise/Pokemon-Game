import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
const root=fileURLToPath(new URL('../',import.meta.url)),cache=new Map();
async function module(file){if(!cache.has(file))cache.set(file,parseAst(await readFile(file,'utf8')));return cache.get(file);}
function bindings(node){if(!node)return[];if(node.type==='Identifier')return[node.name];if(node.type==='ObjectPattern')return node.properties.flatMap(p=>bindings(p.value||p.argument));if(node.type==='ArrayPattern')return node.elements.flatMap(bindings);if(node.type==='AssignmentPattern')return bindings(node.left);return[];}
function resolve(from,specifier){const file=specifier.startsWith('/')?path.join(root,specifier.slice(1)):specifier.startsWith('.')?path.resolve(path.dirname(from),specifier):null;return file&&/\.[cm]?js$/.test(file)&&!file.includes('node_modules')?file:null;}
async function exportsOf(file,seen=new Set()){
 if(seen.has(file))return new Set();seen.add(file);const names=new Set();
 for(const n of (await module(file)).body){if(n.type==='ExportDefaultDeclaration')names.add('default');if(n.type==='ExportNamedDeclaration'){
  for(const s of n.specifiers||[])names.add(s.exported.name||s.exported.value);
  const d=n.declaration;if(d?.id)names.add(d.id.name);for(const v of d?.declarations||[])for(const name of bindings(v.id))names.add(name);
 }if(n.type==='ExportAllDeclaration'){const next=resolve(file,n.source.value);if(next)for(const name of await exportsOf(next,seen))if(name!=='default')names.add(name);}}
 return names;
}
test('all local static admin imports name exports that actually exist',async()=>{
 let checked=0;const errors=[];
 for(const name of await readdir(path.join(root,'admin'))){if(!name.endsWith('.mjs'))continue;const file=path.join(root,'admin',name);
  for(const n of (await module(file)).body){if(n.type!=='ImportDeclaration')continue;const target=resolve(file,n.source.value);if(!target)continue;const names=await exportsOf(target);
   for(const s of n.specifiers){if(s.type==='ImportNamespaceSpecifier')continue;const expected=s.type==='ImportDefaultSpecifier'?'default':(s.imported.name||s.imported.value);checked++;if(!names.has(expected))errors.push(`${name}: ${n.source.value} does not export ${expected}`);}
  }
 }
 assert(checked>30);assert.deepEqual(errors,[]);
});
