import {prepararEstadoLocal} from './servidor_estado_local.mjs';
import {hpDe} from './individuo.mjs';

/** Local-world server: the client reports a defeated opponent, never an XP amount or a new level.
 * Shared-world battles already award their own XP and must not use this route. */
export function experienciaLocal(conta, evento, {exp, especies, learnset, golpes, tetoNivel, expMult = 1}) {
  const id = evento?.id;
  if (typeof id !== 'string' || !/^[\w-]{8,100}$/.test(id)) return {erro: 'Invalid battle receipt.'};
  if ((conta.experienciaLocalIds || []).includes(id)) return {ok: true, repetido: true};
  const p = conta.save?.time?.find(p => p.uid != null && String(p.uid) === String(evento.uid));
  const dex = evento?.derrotado?.dex, lv = evento?.derrotado?.lv;
  if (!p || !Number.isInteger(dex) || !exp.especies?.[dex] || !Number.isInteger(lv) || lv < 1 || lv > 100) return {erro: 'Invalid local battle.'};
  const curva = exp.curvas[exp.especies[p.dex]?.c || 'medium'];
  if (!curva || !Number.isInteger(p.lv) || p.lv < 1 || p.lv > 100) return {erro: 'Invalid Pokémon progression.'};
  const limites = Array.isArray(tetoNivel) && tetoNivel.length === 9 ? tetoNivel : [20,26,32,38,46,52,58,62,70];
  const teto = conta.save.eliteVencida ? 100 : limites[Math.min(8, (conta.save.insignias || []).length)];
  const b = exp.especies[dex].b || 60;
  const base = b * lv / 5 * ((2 * lv + 10) / (lv + p.lv + 10)) ** 2.5 + 1;
  const ganho = Math.max(1, Math.round(Math.max(1, Math.floor(base * (evento.derrotado.chefe === true ? 3 : 1))) * expMult));
  const antes = p.lv, S = especies.find(s => s.n === +p.dex);
  p.exp = (Number.isFinite(p.exp) ? p.exp : curva[p.lv]) + ganho;
  if (teto < 100) {
    const max = p.lv > teto ? p.exp - ganho : curva[teto + 1] - 1;
    const sobra = Math.max(0, p.exp - max); p.exp -= sobra;
    p.expReserva = (p.expReserva || 0) + sobra;
  }
  prepararEstadoLocal(p, {especies,learnset,golpes});
  while (p.lv < 100 && p.exp >= curva[p.lv + 1]) {
    const maxAntes = S ? hpDe(S, p) : p.maxHp;
    p.lv++; p.amizade = Math.min(255, (p.amizade ?? exp.especies[p.dex]?.a ?? 70) + 2);
    if (S) { p.maxHp = hpDe(S, p); p.hp = Math.min(p.maxHp, (p.hp ?? maxAntes) + Math.max(0, p.maxHp - maxAntes)); }
    for (const [id, nivel] of learnset.learnset?.[p.dex] || []) {
      if (nivel !== p.lv || !golpes[id] || p.movs.some(m => m.id === id) || p.aprender?.includes(id)) continue;
      if (p.movs.length < 4) p.movs.push({id, pp: learnset.pp?.[id] ?? 20, ppMax: learnset.pp?.[id] ?? 20});
      else p.aprender = [...(p.aprender || []), id];
    }
  }
  conta.experienciaLocalIds = [...(conta.experienciaLocalIds || []), id].slice(-1024);
  conta.rev = (conta.rev || 0) + 1;
  return {ok: true, ganho, lv: p.lv, subiu: p.lv - antes};
}
