import {aplicarEstadoLocal, prepararEstadoLocal} from './servidor_estado_local.mjs';

export function usarItemLocal(conta, pedido, catalogo, dados) {
  const id = Number(pedido.item), save = conta?.save;
  if (!save || !Number.isSafeInteger(id) || !catalogo.itens?.[id]) return {erro:'Invalid item.'};
  if (!(Number.isSafeInteger(save.itens?.[id]) && save.itens[id] > 0)) return {erro:'You do not have this item.'};
  const p = save.time?.find(p=>p.uid != null && String(p.uid)===String(pedido.uid));
  if (!p) return {erro:'This Pokémon is not in your party.'};
  const novo = JSON.parse(JSON.stringify(p));
  if (pedido.estado) aplicarEstadoLocal(novo,pedido.estado,dados); else prepararEstadoLocal(novo,dados);
  const pp = {2022:10,2023:Infinity,2024:10,2025:Infinity}[id];
  if (pp) {
    const alvos = id>=2024 ? novo.movs : [...novo.movs].filter(m=>m.pp<m.ppMax).sort((a,b)=>a.pp-b.pp).slice(0,1);
    if (!alvos.some(m=>m.pp<m.ppMax)) return {erro:'PP is already full.'};
    for (const m of alvos) m.pp=Math.min(m.ppMax,m.pp+pp);
  } else if ([2012,2013,2021].includes(id)) {
    if (novo.hp>0) return {erro:'This Pokémon has not fainted.'};
    novo.hp=id===2012 ? Math.ceil(novo.maxHp/2) : novo.maxHp; novo.koAte=0;
  } else {
    // Match the current real-time client's potion strengths; full restores use the actual maximum.
    const cura = {2001:20,2002:60,2003:200,2004:Infinity,2005:Infinity}[id];
    if (!cura) return {erro:'This item effect is not supported yet.'};
    if (novo.hp<=0) return {erro:'Use a Revive on a fainted Pokémon.'};
    if (novo.hp>=novo.maxHp) return {erro:'HP is already full.'};
    novo.hp=Math.min(novo.maxHp,novo.hp+cura); if(id===2005) novo.status=null;
  }
  Object.assign(p,novo);
  save.itens[id]--; if (!save.itens[id]) delete save.itens[id];
  conta.rev=(conta.rev||0)+1;
  return {bolsa:{dinheiro:save.dinheiro,itens:save.itens,bolas:save.bolas,insignias:save.insignias},vidas:[p],rev:conta.rev};
}
