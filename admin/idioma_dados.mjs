/** Translate authored display fields only. IDs, paths and source records stay untouched. */
const CAMPOS = {
  itens: ['n', 'd'], treinadores: ['nome', 'fala', 'vitoria', 'derrota'],
  npcs: ['nome', 'falas'], bolas: ['nome'],
  ginasios: ['nome', 'cidade', 'fala', 'vitoria', 'derrota', 'insignia'],
  mochilas: ['nome'], skins_treinador: ['nome'], receitas_cor: ['rotulos'],
  insignias: ['n'], golpes: ['descricao'],
};
export function textoDado(valor, traduzir) {
  return Array.isArray(valor) ? valor.map(v => textoDado(v, traduzir))
    : typeof valor === 'string' ? traduzir(valor) : valor;
}
export function campoDado(esquema, chave, valor, traduzir) {
  if (esquema !== 'dialogos' && !CAMPOS[esquema]?.includes(chave)) return valor;
  if (chave === 'rotulos') return Object.fromEntries(Object.entries(valor || {}).map(([k, v]) => [k, textoDado(v, traduzir)]));
  if (chave === 'insignia' && valor && typeof valor === 'object') return { ...valor, nome: textoDado(valor.nome, traduzir) };
  return textoDado(valor, traduzir);
}

export const registroDado = (esquema, registro, traduzir) => Object.fromEntries(Object.entries(registro).map(([k, v]) => [k, campoDado(esquema, k, v, traduzir)]));


/** Recorded action codes are kept intact; this only formats the history column. */
const ACOES = {
  bolsa: 'Bag', time: 'Team', 'deu pokemon': 'Gave Pokémon', cargo: 'Role',
  'novo código de recuperação': 'New recovery code', 'aviso global': 'Global announcement', eventos: 'Events',
  banir: 'Ban', perdoar: 'Remove ban', silenciar: 'Mute', 'tirar silêncio': 'Unmute',
  desconectar: 'Disconnect', recado: 'Message', levar: 'Move player', tp: 'Teleport',
  puxar: 'Bring player', 'ir até': 'Go to player', aviso: 'Announcement',
};
const ACOES_RAID = { anunciar: 'Announce', comecar: 'Start', cancelar: 'Cancel', hp: 'HP', dano: 'Damage', shiny: 'Shiny rate', premio: 'Reward', status: 'Status' };
export function rotuloAcao(acao) {
  if (typeof acao !== 'string') return acao;
  if (acao.endsWith(' (chat)')) { const base = acao.slice(0, -7); return ACOES[base] ? ACOES[base] + ' (chat)' : acao; }
  if (acao.startsWith('raid ')) { const op = acao.slice(5); return ACOES_RAID[op] ? 'Raid: ' + ACOES_RAID[op] : acao; }
  return ACOES[acao] || acao;
}
