import {fallbackDaEspecie, hpDe} from './individuo.mjs';

export function prepararEstadoLocal(p, {especies, learnset, golpes}) {
  const especie = especies.find(s => s.n === +p.dex);
  if (!especie) return;
  p.maxHp = hpDe(especie, p);
  if (!Number.isFinite(p.hp)) p.hp = p.maxHp;
  p.hp = Math.max(0, Math.min(p.hp, p.maxHp));
  const iniciais = [...new Set((learnset.learnset?.[p.dex] || []).filter(([,n]) => n <= p.lv).map(([id]) => id))].slice(-4);
  for (const id of fallbackDaEspecie(+p.dex, especie, golpes)) { if (iniciais.length >= 2) break; if (!iniciais.includes(id)) iniciais.push(id); }
  if (!Array.isArray(p.movs) || !p.movs.length) p.movs = iniciais.map(id => ({id, pp: learnset.pp?.[id] ?? 20, ppMax: learnset.pp?.[id] ?? 20}));
  // Repair the old one-move starter record without replacing existing moves or refilling spent PP.
  if (p.inicial && p.movs.length < 2) for (const id of iniciais) {
    if (p.movs.length >= 2) break;
    if (!p.movs.some(m => m.id === id)) p.movs.push({id, pp: p.ppEsq?.[id] ?? learnset.pp?.[id] ?? 20, ppMax: learnset.pp?.[id] ?? 20});
  }
  return iniciais;
}

/** Local combat runs on the client. Accept owned-mon damage/PP use and legal move choices,
 * never client levels, IVs, species, money, HP increases or PP refills. */
export function aplicarEstadoLocal(p, recebido, dados) {
  const iniciais = prepararEstadoLocal(p, dados); if (!iniciais) return;
  if (Number.isFinite(recebido.hp)) p.hp = Math.min(p.hp, Math.max(0, Math.round(recebido.hp)));
  if (!Array.isArray(recebido.movs) || recebido.movs.length < 1 || recebido.movs.length > 4) return;
  const permitidos = new Set([...iniciais, ...p.movs.map(m=>m.id), ...(dados.learnset.learnset?.[p.dex] || []).filter(([,n])=>n<=p.lv).map(([id])=>id)]);
  if (new Set(recebido.movs.map(m=>m?.id)).size !== recebido.movs.length || recebido.movs.some(m=>!m || !permitidos.has(m.id) || !dados.golpes[m.id] || !Number.isFinite(m.pp))) return;
  const anteriores = new Map(p.movs.map(m=>[m.id,m]));
  const memoria = {...p.ppEsq};
  for (const m of p.movs) if (!recebido.movs.some(n=>n.id===m.id)) memoria[m.id] = m.pp ?? m.ppMax;
  p.movs = recebido.movs.map(m=>{const ppMax=dados.learnset.pp?.[m.id] ?? 20; const limite=anteriores.get(m.id)?.pp ?? memoria[m.id] ?? ppMax; return {id:m.id, pp:Math.max(0,Math.min(m.pp,limite,ppMax)),ppMax};});
  for (const m of p.movs) delete memoria[m.id];
  p.ppEsq = memoria;
  if (Array.isArray(p.aprender)) p.aprender = p.aprender.filter(id=>!p.movs.some(m=>m.id===id));
}
