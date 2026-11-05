import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const source=await readFile(new URL('../menus.mjs',import.meta.url),'utf8');let choice;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee.object?.name==='Popup'&&n.callee.property?.name==='imagem'&&n.arguments[1]?.value==='mapa')choice=source.slice(n.arguments[2].start,n.arguments[2].end);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);}
walk(parseAst(source));assert(choice);
function png(buffer){
 assert(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);assert.equal(buffer[24],8);assert.equal(buffer[25],6);assert.equal(buffer[28],0);
 const data=[];let at=8;
 while(at<buffer.length){const n=buffer.readUInt32BE(at),type=buffer.toString('ascii',at+4,at+8);assert(at+12+n<=buffer.length);if(type==='IDAT')data.push(buffer.subarray(at+8,at+8+n));at+=n+12;if(type==='IEND')break;}
 const pixels=inflateSync(Buffer.concat(data));assert.equal(pixels.length,(width*4+1)*height);assert(pixels[4]<=16,'top-left corner must remain transparent within edge-antialiasing tolerance');return {width,height};
}
test('the actual map image selection uses English artwork only for English',async()=>{
 for(const lang of ['en','pt','es']){
  const path=vm.runInNewContext(choice,{I18n:{idioma:()=>lang}});assert.equal(path,'./ui/figma/backgrounds/mapa-kanto'+(lang==='en'?'-en':'')+'.png');await readFile(new URL('../'+path,import.meta.url));
 }
});
test('localized map is a complete RGBA PNG with matching map proportions and transparent corners',async()=>{
 const original=png(await readFile(new URL('../ui/figma/backgrounds/mapa-kanto.png',import.meta.url))),english=png(await readFile(new URL('../ui/figma/backgrounds/mapa-kanto-en.png',import.meta.url)));
 assert.equal(english.height,original.height);assert(Math.abs(english.width-original.width)<=1);assert(Math.abs(english.width/english.height-original.width/original.height)<0.002);
});
test('the original Portuguese map artwork remains byte-for-byte unchanged',async()=>{
 const original=await readFile(new URL('../ui/figma/backgrounds/mapa-kanto.png',import.meta.url));
 assert.equal(createHash('sha256').update(original).digest('hex'),'6f3d92e45fc5ed2053c6b0b8281f9a6119dc6e693d6dc7bd4879b8c9c670af1b');
});
