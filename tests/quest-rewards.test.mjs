import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pagarRecompensaMissao} from '../servidor_missoes.mjs';
const read=async n=>JSON.parse(await readFile(new URL('../public/'+n,import.meta.url),'utf8'));
const data={exp:await read('data/exp.json'),especies:(await read('pokedex.json')).species,learnset:await read('data/learnset.json'),golpes:await read('data/golpes.json'),tetoNivel:(await read('data/config_jogo.json')).tetoNivel};
const quest=(await read('data/missoes.json')).capitulos[0].missoes[0];
const curve=data.exp.curvas[data.exp.especies[155].c];
const fixture=()=>({rev:2,save:{dinheiro:50000,itens:{2001:2},bolas:{1001:1},missoes:{atual:102,feitas:[101],passo:0,prog:{}},time:[{uid:'a',dex:155,lv:5,exp:curve[5],hp:7,ivs:[15,15,15,15,15,15],movs:[{id:'tackle',pp:0,ppMax:35},{id:'firespin',pp:7,ppMax:15}]}],caixa:[],nome:'Quest test'}});

test('completed quest pays money, potions, Poké Balls and fixed XP together, once',()=>{
 const c=fixture(),r=pagarRecompensaMissao(c,quest,data);assert(r.ok);assert.equal(c.save.dinheiro,50500);assert.equal(c.save.itens[2001],5);assert.equal(c.save.bolas[1001],6);assert.equal(c.save.itens[1001],undefined);assert.equal(c.save.time[0].exp,curve[5]+100);assert.equal(c.save.time[0].movs[0].pp,0);assert.deepEqual(c.save.recompensasPagas,[101]);assert.equal(c.rev,3);
 const saved=JSON.stringify(c);assert(pagarRecompensaMissao(c,{...quest,id:'101'},data).repetido);assert.equal(JSON.stringify(c),saved);
});

test('uncompleted or invalid quests cannot pay partial rewards or change accounts',()=>{
 for(const m of [{...quest,id:999},{...quest,recompensa:{dinheiro:500,itens:{2001:-1},exp:100}},{...quest,recompensa:{dinheiro:500,exp:-1}}]){const c=fixture(),before=JSON.stringify(c);assert(pagarRecompensaMissao(c,m,data).erro);assert.equal(JSON.stringify(c),before);}
});

test('quest XP follows selected party Pokémon, learns Ember at level 10, and respects badge cap',()=>{
 const c=fixture(),p=c.save.time[0];p.lv=9;p.exp=curve[10]-1;c.save.seguidorUid='a';const r=pagarRecompensaMissao(c,quest,data);assert(r.ok);assert.equal(c.save.time[0].lv,10);assert(c.save.time[0].movs.some(m=>m.id==='ember'));assert.equal(c.save.time[0].movs.find(m=>m.id==='tackle').pp,0);
 const capped=fixture();capped.save.time[0].lv=20;capped.save.time[0].exp=curve[21]-1;assert(pagarRecompensaMissao(capped,quest,data).ok);assert.equal(capped.save.time[0].lv,20);assert.equal(capped.save.time[0].expReserva,100);
});

test('missing initial money uses the same 50000 balance as the shop; saved zero stays zero',()=>{
 for(const initial of [undefined,0]){const c=fixture();c.save.dinheiro=initial;assert(pagarRecompensaMissao(c,quest,data).ok);assert.equal(c.save.dinheiro,initial===0?500:50500);}
});
