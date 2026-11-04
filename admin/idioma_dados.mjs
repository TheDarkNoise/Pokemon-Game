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
