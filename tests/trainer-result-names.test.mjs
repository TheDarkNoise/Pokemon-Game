import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
globalThis.document={documentElement:{setAttribute(){},classList:{add(){}}}};
globalThis.fetch=async u=>{try{return{ok:true,json:async()=>JSON.parse(await read('public/'+String(u).replace(/^\.?\//,'')))}}catch{return{ok:false}}};
const I=await import('../i18n.mjs');await I.carregar('en');
const trainers=JSON.parse(await read('public/data/treinadores.json'));
const html=await read('index.html'),source=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('function renivelarTreinador('))[2],ast=parseAst(source);
function all(n,p,out=[]){if(!n||typeof n!=='object')return out;if(p(n))out.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')for(const c of Array.isArray(v)?v:[v])all(c,p,out);return out;}
const extract=n=>source.slice(n.start,n.end),calls=all(ast,n=>n.type==='CallExpression'&&n.callee.object?.name==='Chat'&&n.callee.property?.name==='sistema');
function notice(fragment,fields){const n=calls.find(n=>extract(n).includes(fragment));assert(n,fragment);let out;vm.runInNewContext(extract(n),{...fields,Chat:{sistema:s=>out=I.t(s)}});return out;}

test('trainer-class translation covers all 60 source records without translating personal names or modifying data',async()=>{
 const before=JSON.stringify(trainers);assert.equal(Object.keys(trainers).length,60);
 for(const [pt,en]of [['Aluno - Kenji','Student - Kenji'],['Campista-Keiji','Camper-Keiji'],['Menina de Pique Nique-Saya','Picnicker-Saya'],['Jovem-Minato','Youngster-Minato'],['Menino de Shorts - Hugo','Youngster - Hugo'],['Gêmeas - Rina','Twins - Rina'],['Montanhista - Naruo','Hiker - Naruo'],['Alpinista - Kōsaku','Hiker - Kōsaku'],['Irmãos Lutadores - Aki','Fighting Brothers - Aki'],['Campista - Moeda','Camper - Moeda'],['Moeda','Moeda'],['Cancelar','Cancelar']])assert.equal(I.nomeTreinador(pt),en);
 for(const t of Object.values(trainers)){
  const en=I.nomeTreinador(t.nome);assert(!/^(Aluno|Campista|Menina de Pique Nique|Jovem|Menino de Shorts|Gêmeas|Montanhista|Alpinista|Irmãos Lutadores)/.test(en),en);
  assert.equal(en.slice(en.indexOf('-')),t.nome.slice(t.nome.indexOf('-')));
 }
 assert.equal(JSON.stringify(trainers),before);assert.equal(I.nomeTreinador(null),null);
 await I.carregar('pt');for(const t of Object.values(trainers))assert.equal(I.nomeTreinador(t.nome),t.nome);await I.carregar('en');
});

test('actual trainer scaling keeps all non-display data and level rules intact for all 60 trainers',()=>{
 const fn=all(ast,n=>n.type==='FunctionDeclaration'&&n.id.name==='renivelarTreinador')[0];assert(fn);
 for(const info of Object.values(trainers))for(const lv of [0,23]){
  const before=JSON.stringify(info),result=vm.runInNewContext(extract(fn)+';renivelarTreinador(info,77)',{info,I18n:I,nivelTreinador:(area,count)=>{assert.equal(area,77);assert.equal(count,info.time.length);return lv}});
  assert.equal(result.nome,I.nomeTreinador(info.nome));
  assert.deepEqual(JSON.parse(JSON.stringify({...result,nome:info.nome})),{...info,time:lv?info.time.map(m=>({...m,lv})):info.time});assert.equal(JSON.stringify(info),before);
 }
});

test('actual server battle-info adapter translates only the display class and retains Pokémon IDs and levels',()=>{
 const n=all(ast,n=>n.type==='AssignmentExpression'&&n.left.property?.name==='info'&&extract(n).includes('serv.nomeInimigo'))[0];assert(n);
 for(const name of ['Aluno - Moeda','Moeda']){
  const serv={nomeInimigo:name,dele:[{dex:25,lv:12},{dex:19,lv:9}]},before=JSON.stringify(serv),jogo={turno:{}},npc={treino:{dinheiro:500,time:[]}};
  vm.runInNewContext(extract(n),{serv,jogo,n:npc,I18n:I});
  assert.equal(jogo.turno.info.nome,name==='Moeda'?'Moeda':'Student - Moeda');assert.equal(jogo.turno.info.dinheiro,500);
  assert.deepEqual(JSON.parse(JSON.stringify(jogo.turno.info.time)),[{dex:25,lv:12,glb:'pm0025_00'},{dex:19,lv:9,glb:'pm0019_00'}]);assert.equal(JSON.stringify(serv),before);
 }
});

test('actual Champion and Elite result combinations preserve both trainer names, rewards and release counts',()=>{
 for(const coins of [0,500])for(const released of [0,2]){
  const E={nome:'Moeda'},r={soltou:released,premio:{dinheiro:coins}};
  let expected='🏆 You defeated Moeda and became the Champion of Kanto! Your Pokémon obey up to Lv 100';if(released)expected+=' and stored XP was released (2 Pokémon)';expected+='.';if(coins)expected+=' +500 Coins';
  assert.equal(notice("'🏆 Você venceu ' + E.nome",{E,r}),expected);
 }
 for(const moedas of [0,500])for(const next of [false,true]){
  const E={nome:'Moeda',ordem:2},r={proximo:next?{nome:'Pedra'}:null};let expected='⚔ Moeda was defeated (2/5)';if(moedas)expected+=' — +500 Coins';expected+='. '+(next?'Pedra awaits in the next room — your party stays as it is.':'Continue without stopping to heal.');
  assert.equal(notice("E.nome + ' caiu ('",{E,r,moedas}),expected);
 }
 assert.equal(notice("'Você perdeu para ' + E.nome",{E:{nome:'Moeda'}}),'You lost to Moeda: the Elite run was reset. Heal your party and return through the first room.');
});

test('actual gym, trainer, rematch-payment and fainted-party notices preserve personal names and numeric values',()=>{
 const g={lider:'Moeda',insignia:{nome:'Boulder Badge'},cooldownMin:[30],resetMoedas:500};
 assert.equal(notice("'🏅 Você venceu ' + g.lider",{g,ins:[1],ganho:1000}),'🏅 You defeated Moeda and earned the Boulder Badge! (1/8 in Kanto · Pokémon obey up to a higher level) +1000 Coins');
 for(const perda of [0,250]){
  const expected='You lost to Moeda'+(perda?' and lost 250 Coins':'')+'. The leader accepts another challenge in 30 min (or pay 500 Coins to try now).';assert.equal(notice("'Você perdeu para ' + g.lider",{g,perda,k:0}),expected);
 }
 assert.equal(notice("'🏆 Você venceu ' + t.nome",{t:{nome:'Moeda'},g:200}),'🏆 You defeated Moeda and earned 200 Coins!');
 assert.equal(notice("'Você desistiu da batalha contra '",{t:{nome:'Moeda'}}),'You gave up the battle against Moeda.');
 assert.equal(notice("'Você pagou ' + g.resetMoedas",{g}),'You paid 500 Coins to challenge Moeda again.');
 assert.equal(I.t('Moeda desmaiou — Pedra entra no lugar.'),'Moeda fainted — Pedra takes its place.');
});

test('actual trainer nameplates and dialogue headers preserve personal names while ordinary NPC labels still translate',()=>{
 const plates=all(ast,n=>n.type==='CallExpression'&&n.callee.name==='rotuloSprite'&&(extract(n).includes('I18n.nomeTreinador')||extract(n).includes("+ e.nome")));assert.equal(plates.length,5);
 for(const n of plates){let args;vm.runInNewContext(extract(n),{I18n:I,e:{nome:'Camper - Moeda'},info:{nome:'Campista - Moeda'},n:{nome:'Moeda'},venceu:false,E:{nome:'Moeda'},g:{lider:'Moeda',nome:'Gym'},t:{nome:'Moeda'},rotuloSprite:(...a)=>args=a});assert(args[0].includes('Moeda'));assert.equal(args[5],false);}
 const label=all(ast,n=>n.type==='AssignmentExpression'&&n.left.object?.name==='bN'&&n.left.property?.name==='textContent')[0];assert(label);
 for(const dono of [{papel:'treinador'},{ginasio:{}},{elite:{}}]){const bN={};vm.runInNewContext(extract(label),{dono,quem:'Campista - Moeda',bN,I18n:I});assert.equal(bN.textContent,'Camper - Moeda');}
 const bN={};vm.runInNewContext(extract(label),{dono:{papel:'cura'},quem:'Centro Pokémon',bN,I18n:I});assert.equal(bN.textContent,'Pokémon Center');
});
