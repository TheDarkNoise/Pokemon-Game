import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {parseAst} from 'rollup/parseAst';
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async url=>{try{return{ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/'+String(url).replace(/^\.\//,'').split('?')[0],import.meta.url),'utf8'))};}catch{return{ok:false};}};
const I=await import('../i18n.mjs');await I.carregar('en');
const source=await readFile(new URL('../menus.mjs',import.meta.url),'utf8'),ast=parseAst(source);
const labels=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='CF_DIAG_ROTULOS'));
const formatter=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='cfDiagTexto');assert(labels&&formatter);
const code=source.slice(labels.start,labels.end)+';'+source.slice(formatter.start,formatter.end)+';cfDiagTexto()';
const format=diagnostics=>vm.runInNewContext(code,{ctx:{diagnostico:()=>diagnostics},tr:I.t});
test('diagnostic display translates headings, quality and extension availability without mutating raw data',()=>{
 const raw=Object.freeze({gpu:'NVIDIA test GPU',qualidade:'alta (automática: GPU de software)',sombras:true,extensoes:Object.freeze(['WEBGL_multi_draw: sim','EXT_color_buffer_float: não']),erros:Object.freeze(['nenhum']),tela:'1124×892 @1 (render 1×)'}),before=JSON.stringify(raw),out=format(raw);
 assert.match(out,/Graphics Quality: High \(automatic: software GPU\)/);assert.match(out,/Shadows: true/);assert.match(out,/Extensions: \n  WEBGL_multi_draw: Yes\n  EXT_color_buffer_float: No/);assert.match(out,/Errors: \n  None/);assert.match(out,/Display: 1124×892 @1 \(render 1×\)/);assert.equal(JSON.stringify(raw),before);assert.equal(raw.qualidade,'alta (automática: GPU de software)');
});
test('diagnostic display preserves raw error messages, device identifiers and unknown fields',()=>{
 const out=format({gpu:'Radeon: alta',qualidade:'baixa (forçada)',erros:['falha em arquivo /cenario/kanto.glb'],campoFuturo:['não','URL: /conta/estado']});
 assert.match(out,/GPU: Radeon: alta/);assert.match(out,/Low \(forced\)/);assert(out.includes('falha em arquivo /cenario/kanto.glb'));assert(out.includes('campoFuturo: \n  não\n  URL: /conta/estado'));assert.equal(format(null),'unavailable');
});
test('Portuguese diagnostics retain Portuguese headings and quality descriptions',async()=>{
 await I.carregar('pt');const out=format({qualidade:'alta (forçada)',extensoes:['WEBGL_multi_draw: sim'],erros:['nenhum']});assert.match(out,/Qualidade gráfica: alta \(forçada\)/);assert.match(out,/WEBGL_multi_draw: Sim/);assert.match(out,/Erros: \n  Nenhum/);await I.carregar('en');
});
