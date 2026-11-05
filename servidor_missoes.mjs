import {concederExperiencia} from './servidor_experiencia.mjs';

/** Pay only completed quests from the server catalogue, once per account. */
export function pagarRecompensaMissao(conta, missao, dados) {
 const save=conta?.save,id=missao?.id;
 if(!save || !save.missoes?.feitas?.some(x=>String(x)===String(id))) return {erro:'Quest is not completed.'};
 if(save.recompensasPagas?.some(x=>String(x)===String(id))) return {repetido:true};
 const r=missao.recompensa || {}, next=structuredClone(conta),s=next.save;
 const inteiro=n=>Number.isSafeInteger(n)&&n>=0;
 if(!inteiro(r.dinheiro??0)||!inteiro(r.exp??0)) return {erro:'Invalid quest reward.'};
 s.dinheiro=(s.dinheiro??50000)+(r.dinheiro??0);s.itens||={};s.bolas||={};
 for(const [id,n] of Object.entries(r.itens||{})){
  if(!/^\d+$/.test(id)||!inteiro(n))return {erro:'Invalid quest item reward.'};
  const bag=+id>=1001&&+id<=1009?s.bolas:s.itens;bag[id]=(bag[id]||0)+n;
 }
 for(const [id,n] of Object.entries(r.bolas||{})){
  if(!/^100[1-9]$/.test(id)||!inteiro(n))return {erro:'Invalid quest ball reward.'};
  s.bolas[id]=(s.bolas[id]||0)+n;
 }
 let xp=null;
 if(r.exp){
  const p=s.time?.find(p=>String(p.uid)===String(s.seguidorUid))||s.time?.[0];
  if(!p)return {erro:'A party Pokémon is required for the quest XP.'};
  xp=concederExperiencia(next,p,r.exp,dados);if(xp.erro)return xp;
 }
 s.recompensasPagas=[...(s.recompensasPagas||[]),id];
 next.rev=(next.rev||0)+1;conta.save=s;conta.rev=next.rev;
 return {ok:true,bolsa:{dinheiro:s.dinheiro,itens:s.itens,bolas:s.bolas},vidas:s.time,xp};
}
