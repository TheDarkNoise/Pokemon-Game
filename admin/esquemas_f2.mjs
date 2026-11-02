/* Esquemas da Fase 2 do painel (conteúdo do jogo): insígnias, curvas de EXP, iniciais, montarias, golpes, missões, evoluções,
 * espécies e learnset. Entram no ESQUEMAS do admin/esquemas.mjs (mesmo formato e mesmas regras — ver o cabeçalho de lá), então o
 * servidor valida por eles e só grava o que está aqui. Dois ganchos a mais:
 *   tela     = a edição é numa tela própria (admin/conteudo.mjs, botão #lado [data-vista=tela]); o "Arquivos de dados" leva pra ela
 *   colecao  = (dados, { validarCampo, validarRegistro, generica }) → { ok, v } | { ok: false, erro } — valida o conteúdo inteiro
 *              quando ele NÃO é feito de registros (mapa de números, pares [golpe, nível], capítulos → missões → passos), ou
 *              quando precisa de uma regra que cruza registros (`generica` = a validação normal do esquema).
 * Fonte de verdade das missões: data/missoes.json (o jogo em missoes.mjs e o servidor em MISSOES). O menus_dados.missoes/passos
 * é o dump do jogo original, que ninguém lê — o painel não edita. */

const ok = v => ({ ok: true, v }), falha = erro => ({ ok: false, erro });
const ehObj = v => v && typeof v === 'object' && !Array.isArray(v);
const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const RE_ARQUIVO = /^[\w-]{1,60}$/;
const RE_GLB_MON = /^pm\d{4}_\d\d$/;
const RE_GOLPE = /^[a-z0-9]{1,40}$/;
const RE_DEX = /^\d{1,4}$/;
/** Chaves desconhecidas passam direto (igual ao validarRegistro): o arquivo pode ter campo que o painel ainda não edita. */
const extras = (o, conhecidas) => Object.fromEntries(Object.entries(o).filter(([k]) => !conhecidas.includes(k) && /^\w{1,40}$/.test(k)));

export const TIPOS = { Normal: 'Normal', Fighting: 'Fighting', Flying: 'Flying', Poison: 'Poison', Ground: 'Ground', Rock: 'Rock', Bug: 'Bug',
  Ghost: 'Ghost', Steel: 'Steel', Fire: 'Fire', Water: 'Water', Grass: 'Grass', Electric: 'Electric', Psychic: 'Psychic', Ice: 'Ice',
  Dragon: 'Dragon', Dark: 'Dark', Fairy: 'Fairy' };
const OPC_TIPOS = Object.entries(TIPOS).map(([v, rotulo]) => ({ v, rotulo }));
export const CURVAS = { slow: 'Slow', medium: 'Medium', fast: 'Fast', 'medium-slow': 'Medium Slow', 'slow-then-very-fast': 'Erratic', 'fast-then-very-slow': 'Fluctuating' };

/** Mapa { id: número } (alturas, sexos, tamanhos): cada valor validado por um campo `num`. */
const mapaDeNumeros = (reId, campo, ajudaId) => (d, { validarCampo }) => {
  if (!ehObj(d)) return falha('esperava um objeto { id: número }');
  const out = {};
  for (const [id, v] of Object.entries(d)) {
    if (!reId.test(id)) return falha(`id inválido: ${id}` + (ajudaId ? ` (${ajudaId})` : ''));
    const r = validarCampo(campo, v);
    if (!r.ok) return falha(`[${id}] ${r.erro}`);
    out[id] = r.v;
  }
  return ok(out);
};
const mapaDeTextos = (reId, max) => d => {
  if (!ehObj(d)) return falha('esperava um objeto { id: texto }');
  const out = {};
  for (const [id, v] of Object.entries(d)) {
    if (!reId.test(id)) return falha(`id inválido: ${id}`);
    if (typeof v !== 'string' || v.length > max) return falha(`[${id}] texto de até ${max} letras`);
    out[id] = v;
  }
  return ok(out);
};

// ── Quests: capítulos → missões → passos (os tipos que o missoes.mjs e o servidor conhecem) ──────────────────────────────
export const TIPOS_PASSO = {
  falar:    'Talk to an NPC',
  ir:       'Go to an area',
  inicial:  'Choose a starter',
  capturar: 'Catch Pokémon',
  derrotar: 'Defeat (wild Pokémon or trainer)',
  nivel:    'Have a Pokémon at level',
  curar:    'Heal the party (Nurse Joy)',
  insignia: 'Have N badges',
  entregar: 'Deliver an item to an NPC',
  item:     'Have an item in the bag',
};
const listaInt = (v, min, max, tam = 50) => Array.isArray(v) && v.length >= 1 && v.length <= tam && v.every(n => inteiro(n, min, max));
const falas = v => Array.isArray(v) && v.length <= 12 && v.every(s => typeof s === 'string' && s.length <= 400);
function validarPasso(p) {
  if (!ehObj(p)) return 'passo inválido';
  if (!TIPOS_PASSO[p.tipo]) return `tipo de passo desconhecido: ${p.tipo}`;
  if (typeof p.texto !== 'string' || !p.texto.trim() || p.texto.length > 200) return 'missing step text (up to 200 characters) — this is what the player reads in the tracker';
  if (p.onde != null && (typeof p.onde !== 'string' || p.onde.length > 120)) return '"onde": texto de até 120 letras';
  if (p.fala != null && !falas(p.fala)) return '"fala": até 12 linhas de texto';
  const cfg = v => v == null || inteiro(v, 1, 999999999) || listaInt(v, 1, 999999999, 20);
  if (!cfg(p.cfg)) return '"cfg": o número do NPC (ou uma lista)';
  if (p.cfgs != null && !listaInt(p.cfgs, 1, 999999999, 20)) return '"cfgs": lista de números de NPC';
  if (p.n != null && !inteiro(p.n, 1, 9999)) return '"n": quantidade de 1 a 9999';
  if (p.area != null && !inteiro(p.area, 1, 99999999)) return '"area": o número da área';
  if (p.dex != null && !listaInt(p.dex, 1, 2000, 200)) return '"dex": lista de números da Pokédex';
  if (p.item != null && !inteiro(p.item, 1, 999999999)) return '"item": o número do item';
  if (p.cena != null && !inteiro(p.cena, 1, 99999999)) return '"cena": o número da cena';
  for (const k of ['selvagem', 'treinador']) if (p[k] != null && typeof p[k] !== 'boolean') return `"${k}": sim ou não`;
  switch (p.tipo) {
    case 'falar': if (p.cfg == null && p.cfgs == null) return 'falar: diga com qual NPC (cfg)'; break;
    case 'entregar': if (p.cfg == null || p.item == null) return 'entregar: precisa do NPC (cfg) e do item'; break;
    case 'item': if (p.item == null) return 'item: diga qual item'; break;
    case 'ir': if (p.area == null) return 'ir: diga qual área'; break;
    case 'nivel': if (!inteiro(p.lv, 1, 100)) return 'level: "lv" from 1 to 100'; break;
    case 'insignia': if (!inteiro(p.n, 1, 99)) return 'insígnia: "n" de 1 a 99'; break;
  }
  return null;
}
function validarRecompensa(r) {
  if (!ehObj(r)) return 'recompensa inválida';
  for (const k of ['dinheiro', 'exp']) if (r[k] != null && !inteiro(r[k], 0, 1e9)) return `recompensa: "${k}" inteiro de 0 a 1 bilhão`;
  for (const k of ['itens', 'bolas']) if (r[k] != null) {
    if (!ehObj(r[k]) || Object.keys(r[k]).length > 50) return `recompensa: "${k}" = { "id do item": quantidade }`;
    for (const [id, n] of Object.entries(r[k])) if (!/^\d{1,9}$/.test(id) || !inteiro(n, 1, 999999)) return `recompensa ${k}: item ${id} × ${n} inválido`;
  }
  return null;
}
function validarCapitulos(d) {
  if (!Array.isArray(d)) return falha('esperava a lista de capítulos');
  if (d.length > 200) return falha('capítulos demais');
  const caps = new Set(), mis = new Set(), out = [];
  for (const [ci, c] of d.entries()) {
    const onde = `[capítulo ${ci + 1}]`;
    if (!ehObj(c)) return falha(onde + ' inválido');
    if (!inteiro(c.id, 1, 99999) || caps.has(c.id)) return falha(onde + ' "id" vazio ou repetido');
    caps.add(c.id);
    if (typeof c.nome !== 'string' || !c.nome.trim() || c.nome.length > 80) return falha(onde + ' falta o nome (até 80 letras)');
    if (!Array.isArray(c.missoes) || c.missoes.length > 200) return falha(onde + ' "missoes" precisa ser uma lista');
    const missoes = [];
    for (const [mi, m] of c.missoes.entries()) {
      const om = `${onde} [missão ${mi + 1}]`;
      if (!ehObj(m)) return falha(om + ' inválida');
      if (!inteiro(m.id, 1, 999999999) || mis.has(m.id)) return falha(om + ' "id" vazio ou repetido (o id é único no jogo inteiro: o save guarda ele)');
      mis.add(m.id);
      if (typeof m.nome !== 'string' || !m.nome.trim() || m.nome.length > 100) return falha(om + ' falta o nome (até 100 letras)');
      if (m.des != null && (typeof m.des !== 'string' || m.des.length > 400)) return falha(om + ' descrição de até 400 letras');
      if (!Array.isArray(m.passos) || !m.passos.length || m.passos.length > 40) return falha(om + ' precisa de 1 a 40 passos');
      const passos = [];
      for (const [pi, p] of m.passos.entries()) {
        const e = validarPasso(p);
        if (e) return falha(`${om} [passo ${pi + 1}] ${e}`);
        passos.push(JSON.parse(JSON.stringify(p)));
      }
      if (m.recompensa != null) { const e = validarRecompensa(m.recompensa); if (e) return falha(om + ' ' + e); }
      missoes.push({ ...extras(m, ['id', 'nome', 'des', 'passos', 'recompensa']), id: m.id, nome: m.nome, ...(m.des != null ? { des: m.des } : {}), passos,
        ...(m.recompensa != null ? { recompensa: JSON.parse(JSON.stringify(m.recompensa)) } : {}) });
    }
    out.push({ ...extras(c, ['id', 'nome', 'missoes']), id: c.id, nome: c.nome, missoes });
  }
  if (JSON.stringify(out).length > 3e6) return falha('missões grandes demais');
  return ok(out);
}

// ── Learnset: { dex: [[golpe, nível], …] } ───────────────────────────────────────────────────────────────────────────────
function validarLearnset(d) {
  if (!ehObj(d)) return falha('esperava { "nº da dex": [["golpe", nível], …] }');
  const out = {};
  for (const [dex, l] of Object.entries(d)) {
    if (!RE_DEX.test(dex)) return falha(`nº da dex inválido: ${dex}`);
    if (!Array.isArray(l) || l.length > 120) return falha(`[${dex}] precisa ser uma lista (até 120 golpes)`);
    for (const [i, par] of l.entries())
      if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== 'string' || !RE_GOLPE.test(par[0]) || !inteiro(par[1], 1, 120))
        return falha(`[${dex}] golpe ${i + 1}: use ["id do golpe", nível de 1 a 120]`);
    out[dex] = l.map(([g, n]) => [g, n]).sort((a, b) => a[1] - b[1]);   // o jogo pega "os últimos 4 até o nível": a ordem é por nível
  }
  return ok(out);
}

const regraEvolucao = r => {
  if (r.gatilho === 'item' && !r.item && !r.itemName) return 'usar item: diga qual item (ou só o nome, se ainda não existe no jogo)';
  if (r.item === 0 && !r.itemName) return 'item que ainda não existe (0): escreva o nome dele, é o que o jogador lê';
  if (r.segurando === 0 && !r.segurandoName) return 'item segurado que ainda não existe (0): escreva o nome dele';
  if (r.golpe != null && !r.golpeName) return 'conhecer golpe: preencha também o nome do golpe (é o que o jogador lê)';
  return null;
};

export const ESQUEMAS_F2 = {
  insignias: {
    titulo: 'Badges', arquivo: 'menus_dados', caminho: 'insignias', forma: 'lista', id: 'id',
    descricao: 'Name and icon for each badge. The game shows generation 1 (Kanto) badges in Trainer; the badge each gym awards is set on the Gyms screen.',
    previa: '/admin/previa_insignia.mjs',
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'num', int: true, min: 1, max: 9999999, col: true, obrigatorio: true, ajuda: 'Player saves store this number: do not change it for an existing badge.' },
      { k: 'n', rotulo: 'Name', tipo: 'texto', max: 60, col: true, obrigatorio: true },
      { k: 'i', rotulo: 'Ícone', tipo: 'texto', max: 60, col: true, validar: s => RE_ARQUIVO.test(s) ? null : 'nome do arquivo, sem .png', ajuda: 'File ui/icones/<ícone>.png (Kanto badges use dghz_1 … dghz_8).' },
      { k: 'gen', rotulo: 'Generation (region)', tipo: 'num', int: true, min: 1, max: 9, col: true, obrigatorio: true, ajuda: '1 = Kanto (the only region displayed for now).' },
    ],
  },
  exp_curvas: {
    titulo: 'EXP curves', arquivo: 'exp', caminho: 'curvas', forma: 'objeto',
    descricao: 'Total EXP required to reach each level for the 6 official growth curves. Each species uses one of them (Species → EXP).',
    validar: r => {
      for (const [k, c] of Object.entries(r)) {
        if (!CURVAS[k]) continue;
        if (c[0] !== 0 || c[1] !== 0) return `${CURVAS[k]}: os dois primeiros números (índice 0 e Lv 1) são 0`;
        for (let i = 2; i < c.length; i++) if (c[i] < c[i - 1]) return `${CURVAS[k]}: Lv ${i} (${c[i]}) é menor que o Lv ${i - 1} (${c[i - 1]}) — a EXP só cresce`;
      }
      return null;
    },
    campos: Object.entries(CURVAS).map(([k, nome]) => ({ k, rotulo: `${nome} (${k})`, tipo: 'numeros', tam: 101, int: true, min: 0, max: 100000000, obrigatorio: true,
      ajuda: '101 comma-separated numbers: index 0, Lv 1 … Lv 100 (total EXP at the start of the level).' })),
  },
  iniciais: {
    titulo: 'Starters', arquivo: 'iniciais', forma: 'lista', id: 'dex',
    descricao: 'Pokémon offered by Oak’s lab, by generation. The game displays these, and the server only accepts one of them.',
    colecao: (d, { generica }) => {
      const r = generica(d); if (!r.ok) return r;
      if (!r.v.some(x => x.gen === 1)) return falha('precisa de pelo menos um inicial da geração 1 (a mesa do Oak e o pop-up da Amanda usam a geração 1)');
      return r;
    },
    campos: [
      { k: 'gen', rotulo: 'Generation', tipo: 'num', int: true, min: 1, max: 9, col: true, obrigatorio: true, ajuda: 'One tab per generation when choosing a starter; generation 1 is used at Oak’s table.' },
      { k: 'dex', rotulo: 'Nº (dex)', tipo: 'num', int: true, min: 1, max: 2000, col: true, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'glb', rotulo: 'Modelo', tipo: 'texto', max: 20, col: true, obrigatorio: true, validar: s => RE_GLB_MON.test(s) ? null : 'Pokémon model, e.g.: pm0001_00', ajuda: 'Arquivo cenario/mon/<modelo>.glb.' },
      { k: 'tipos', rotulo: 'Tipos', tipo: 'linhas', obrigatorio: true, resumo: v => (v || []).map(t => TIPOS[t] || t).join(' / '),
        validar: v => v.length >= 1 && v.length <= 2 && v.every(t => TIPOS[t]) ? null : 'one or two, one per line, in English: ' + Object.keys(TIPOS).join(', ') },
    ],
  },
  montarias: {
    titulo: 'Mounts', arquivo: 'montarias', forma: 'lista', id: 'glb',
    descricao: 'Rideable Pokémon (M key and shortcuts 5–9): trainer pose, size, speed and terrain.',
    campos: [
      { k: 'glb', rotulo: 'Modelo', tipo: 'texto', max: 20, col: true, obrigatorio: true, validar: s => RE_GLB_MON.test(s) ? null : 'Pokémon model, e.g.: pm0249_00' },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'livre', rotulo: 'Liberada pra todos', tipo: 'bool', col: true, ajuda: 'Unchecked = staff only (until the mount shop is available). Guests can ride all mounts.' },
      { k: 'meio', rotulo: 'Anda por', tipo: 'opcao', col: true, obrigatorio: true, opcoes: [{ v: 'terra', rotulo: 'Ground' }, { v: 'agua', rotulo: 'Água (entra pela beira)' }, { v: 'anfibia', rotulo: 'Land and water' }] },
      { k: 'voa', rotulo: 'Voa', tipo: 'bool', col: true, ajuda: 'Flies over everything (crosses water through the air).' },
      { k: 'escala', rotulo: 'Tamanho montada (×)', tipo: 'num', min: 0.1, max: 5, col: true, obrigatorio: true, ajuda: 'Fator do modelo com o treinador em cima (Lugia 0,6).' },
      { k: 'vel', rotulo: 'Velocidade', tipo: 'num', int: true, min: 1000, max: 200000, col: true, obrigatorio: true, ajuda: 'In 1/10000 of walking speed: 25000 = 2.5× (Charizard), 37500 = 3.75× (Lugia).' },
      { k: 'poseIdle', rotulo: 'Pose do treinador parado', tipo: 'opcao', obrigatorio: true, opcoes: ['RideIdle', 'RideIdle1', 'RideIdle2', 'RideIdle3', 'RideIdle4', 'RideIdle5'].map(v => ({ v })) },
      { k: 'poseRun', rotulo: 'Pose do treinador andando', tipo: 'opcao', obrigatorio: true, opcoes: ['Ride', 'Ride1', 'Ride2', 'Ride3', 'Ride4', 'Ride5'].map(v => ({ v })) },
    ],
  },
  golpes: {
    titulo: 'Moves', arquivo: 'golpes', forma: 'mapa', idValido: RE_GOLPE, idAjuda: 'lowercase letters and digits, e.g. thunderbolt',
    descricao: 'Moves with 3D effects: power, type, PP, range, cooldown and effect/sound/animation. Use the Learnset screen to set which species learns each move.',
    campos: [
      { k: 'nome', rotulo: 'Name (English)', tipo: 'texto', max: 40, col: true, obrigatorio: true },
      { k: 'nomePt', rotulo: 'Name in Portuguese', tipo: 'texto', max: 60, col: true },
      { k: 'tipo', rotulo: 'Tipo', tipo: 'opcao', col: true, obrigatorio: true, opcoes: OPC_TIPOS },
      { k: 'cat', rotulo: 'Categoria', tipo: 'opcao', col: true, obrigatorio: true, opcoes: [{ v: 'fisico', rotulo: 'Physical' }, { v: 'especial', rotulo: 'Especial' }, { v: 'status', rotulo: 'Status' }] },
      { k: 'poder', rotulo: 'Poder', tipo: 'num', int: true, min: 0, max: 300, col: true, obrigatorio: true },
      { k: 'pp', rotulo: 'PP', tipo: 'num', int: true, min: 1, max: 99, col: true, ajuda: 'Vazio = o do learnset.json antigo (ou 20).' },
      { k: 'precisao', rotulo: 'Accuracy (%)', tipo: 'num', int: true, min: 0, max: 100 },
      { k: 'alcance', rotulo: 'Alcance (m)', tipo: 'num', min: 0, max: 40, obrigatorio: true, ajuda: '1.3 = melee; 6–8 = ranged; 0 = self.' },
      { k: 'recarga', rotulo: 'Recarga (s)', tipo: 'num', min: 0, max: 60, obrigatorio: true },
      { k: 'atraso', rotulo: 'Hit delay (s)', tipo: 'num', min: 0, max: 5, obrigatorio: true, ajuda: 'Animation time before the move hits (projectile travel time is added).' },
      { k: 'prioridade', rotulo: 'Prioridade', tipo: 'num', int: true, min: -7, max: 7 },
      { k: 'efeito', rotulo: 'Efeito 3D (id)', tipo: 'texto', max: 8, obrigatorio: true, validar: s => /^\d{5}$/.test(s) ? null : '5 digits, e.g. 00085', ajuda: 'O prefab do efeito do jogo original (00085_Hit…).' },
      { k: 'anim', rotulo: 'Pokémon animation', tipo: 'opcao', obrigatorio: true, opcoes: [{ v: 'Attack', rotulo: 'Attack (golpe)' }, { v: 'Cast', rotulo: 'Cast (launch)' }, { v: 'Buff', rotulo: 'Buff (em si)' }] },
      { k: 'som', rotulo: 'Som do golpe', tipo: 'texto', max: 40, validar: s => /^[\w .-]{1,40}$/.test(s) ? null : 'nome do som' },
      { k: 'somAcerto', rotulo: 'Som do acerto', tipo: 'texto', max: 40, validar: s => /^[\w .-]{1,40}$/.test(s) ? null : 'nome do som' },
      { k: 'contato', rotulo: 'Contato (investida corpo a corpo)', tipo: 'bool' },
      { k: 'inicio', rotulo: 'Starting phase on the attacker (Start)', tipo: 'bool' },
      { k: 'voo', rotulo: 'Projectile flying to the target (Fly)', tipo: 'bool' },
      { k: 'ataque', rotulo: 'Fase de ataque no atacante (Atk)', tipo: 'bool' },
      { k: 'proprio', rotulo: 'Usa em si mesmo', tipo: 'bool' },
      { k: 'acerto', rotulo: 'Tem efeito de acerto (Hit)', tipo: 'bool' },
      { k: 'descricao', rotulo: 'Description', tipo: 'texto', max: 400, area: true },
    ],
  },
  learnset: {
    titulo: 'Learnset', arquivo: 'learnset', caminho: 'learnset', forma: 'mapa', tela: 'learnset', naLista: true,
    descricao: 'Which moves each species learns and at what level (dedicated screen).',
    colecao: validarLearnset,
    campos: [],
  },
  missoes: {
    titulo: 'Quests', arquivo: 'missoes', caminho: 'capitulos', forma: 'lista', tela: 'missoes', naLista: true,
    descricao: 'Story chapters, quests, steps and rewards (dedicated screen).',
    colecao: validarCapitulos,
    campos: [],
  },
  evolucoes: {
    titulo: 'Evolutions', arquivo: 'evolucoes', caminho: 'por', forma: 'mapa', registroLista: true, tela: 'evolucoes', naLista: true, idValido: RE_DEX, idAjuda: 'o nº da dex',
    descricao: 'How each species evolves (dedicated screen).',
    validar: regraEvolucao,
    campos: [
      { k: 'para', rotulo: 'Evolui para (nº)', tipo: 'num', int: true, min: 1, max: 2000, obrigatorio: true },
      { k: 'nome', rotulo: 'Evolution name', tipo: 'texto', max: 40, obrigatorio: true },
      { k: 'gatilho', rotulo: 'Como', tipo: 'opcao', obrigatorio: true, opcoes: [
        { v: 'nivel', rotulo: 'Level up' }, { v: 'item', rotulo: 'Use an item (stone)' }, { v: 'troca', rotulo: 'Trade (or use item)' },
        { v: 'muda', rotulo: 'Alongside another evolution (Shedinja)' }, { v: 'outro', rotulo: 'Special (not possible here)' }] },
      { k: 'texto', rotulo: 'Player-facing text', tipo: 'texto', max: 160, obrigatorio: true, ajuda: 'What the card shows, e.g. "Lv 16" or "use Water Stone".' },
      { k: 'nivel', rotulo: 'Minimum level', tipo: 'num', int: true, min: 1, max: 100 },
      { k: 'amizade', rotulo: 'Minimum friendship', tipo: 'num', int: true, min: 0, max: 255, ajuda: '160 = high friendship (game default).' },
      { k: 'horario', rotulo: 'Time of day', tipo: 'opcao', opcoes: [{ v: 'dia', rotulo: 'Daytime only (06:00–17:59)' }, { v: 'noite', rotulo: 'Nighttime only' }] },
      { k: 'item', rotulo: 'Item used', tipo: 'num', int: true, min: 0, max: 999999999, item: true, ajuda: 'Stone, cord or trade item. 0 = not yet available (the player sees the name below).' },
      { k: 'itemName', rotulo: 'Name do item usado', tipo: 'texto', max: 60 },
      { k: 'segurando', rotulo: 'Segurando o item', tipo: 'num', int: true, min: 0, max: 999999999, item: true, ajuda: '0 = not yet available in the game.' },
      { k: 'segurandoName', rotulo: 'Name do item segurado', tipo: 'texto', max: 60 },
      { k: 'golpe', rotulo: 'Conhecendo o golpe (id)', tipo: 'num', int: true, min: 1, max: 99999, ajuda: 'Pokédex move ID (dex_extra), e.g. 10246 = Ancient Power.' },
      { k: 'golpeName', rotulo: 'Name do golpe', tipo: 'texto', max: 60 },
      { k: 'tipoGolpe', rotulo: 'Conhecendo um golpe do tipo', tipo: 'opcao', opcoes: OPC_TIPOS },
      { k: 'noTime', rotulo: 'With this Pokémon in the party (number)', tipo: 'num', int: true, min: 1, max: 2000 },
      { k: 'tipoNoTime', rotulo: 'With a Pokémon of this type in the party', tipo: 'opcao', opcoes: OPC_TIPOS },
      { k: 'genero', rotulo: 'One gender only', tipo: 'opcao', opcoes: [{ v: 'm', rotulo: '♂ male' }, { v: 'f', rotulo: '♀ female' }], ajuda: 'Informational: the game does not check this yet.' },
      { k: 'stats', rotulo: 'Atk × Def (Tyrogue)', tipo: 'opcao', opcoes: [{ v: 1, rotulo: 'Atk > Def' }, { v: 0, rotulo: 'Atk = Def' }, { v: -1, rotulo: 'Atk < Def' }], ajuda: 'Informational: the game does not check this yet.' },
      { k: 'extra', rotulo: 'Regra especial (texto livre)', tipo: 'texto', max: 60 },
    ],
  },
  evolucoes_itens: {
    titulo: 'Evolution Items', arquivo: 'evolucoes', caminho: 'itens', forma: 'mapa', tela: 'evolucoes', idValido: /^\d{1,9}$/, idAjuda: 'o id do item',
    descricao: 'Items the game allows for Pokémon evolution (the Evolutions screen maintains this list automatically).',
    campos: [
      { k: 'id', rotulo: 'ID', tipo: 'num', int: true, min: 1, max: 999999999, obrigatorio: true },
      { k: 'n', rotulo: 'Name', tipo: 'texto', max: 200, obrigatorio: true },
      { k: 'd', rotulo: 'Description', tipo: 'texto', max: 3000 },
      { k: 't', rotulo: 'Tipo', tipo: 'num', int: true, min: 0, max: 99 },
      { k: 'i', rotulo: 'Ícone', tipo: 'texto', max: 60 },
      { k: 'q', rotulo: 'Qualidade', tipo: 'num', int: true, min: 0, max: 10 },
    ],
  },
  // ── Species (tela própria: admin/conteudo.mjs junta tudo por nº da dex e grava em cada arquivo o que mudou) ─────────────
  especies: {
    titulo: 'Species', arquivo: 'especies', forma: 'mapa', tela: 'especies', naLista: true, idValido: RE_DEX, idAjuda: 'o nº da dex',
    descricao: 'Model names, size, height, gender, description and EXP for each species (dedicated screen). This file stores adjustments absent from the original game data (currently field size).',
    campos: [
      { k: 'escala', rotulo: 'Field size adjustment (×)', tipo: 'num', min: 0.1, max: 5, ajuda: 'Multiplies the size derived from height (proportional scale, the default mode). 1 = no adjustment.' },
    ],
  },
  alturas: {
    titulo: 'Heights', arquivo: 'alturas', forma: 'mapa', tela: 'especies', descricao: 'Actual height of each species (m).',
    colecao: mapaDeNumeros(RE_DEX, { tipo: 'num', min: 0.01, max: 200 }, 'o nº da dex'), campos: [],
  },
  sexos: {
    titulo: 'Gender', arquivo: 'sexos', forma: 'mapa', tela: 'especies', descricao: 'Male percentage for each species (-1 = genderless).',
    colecao: mapaDeNumeros(RE_DEX, { tipo: 'num', min: -1, max: 100 }, 'o nº da dex'), campos: [],
  },
  tamanhos: {
    titulo: 'Sizes (game mode)', arquivo: 'tamanhos', forma: 'mapa', tela: 'especies', descricao: 'Original game MapSize per model (only in "jogo" size mode).',
    colecao: mapaDeNumeros(/^pm\d{4}(_\d\d){0,2}$/, { tipo: 'num', min: 0.01, max: 50 }, 'pm0025 ou pm0025_61'), campos: [],
  },
  descricoes_pt: {
    titulo: 'Pokédex descriptions (pt)', arquivo: 'idioma/dex_pt', forma: 'mapa', tela: 'especies', descricao: 'Pokédex entry text in Portuguese.',
    colecao: mapaDeTextos(/^\d{1,5}$/, 6000), campos: [],
  },
  dex_extra: {
    titulo: 'Pokédex (extra data)', arquivo: 'dex_extra', caminho: 'especies', forma: 'mapa', tela: 'especies', idValido: RE_DEX,
    descricao: 'Extra Pokédex data (displayed gender and height, moves by level, etc.).',
    campos: [
      { k: 'm', rotulo: '% machos', tipo: 'num', min: -1, max: 100 },
      { k: 'f', rotulo: '% female', tipo: 'num', min: -1, max: 100 },
      { k: 'a', rotulo: 'Altura (m)', tipo: 'num', min: 0.01, max: 200 },
    ],
  },
  elenco: {
    titulo: 'Roster (models)', arquivo: 'elenco', forma: 'lista', id: 'glb', tela: 'especies',
    descricao: 'Every 3D Pokémon model in the game (forms, Mega Evolutions, Gigantamax).',
    campos: [
      { k: 'n', rotulo: 'Nº (dex)', tipo: 'num', int: true, min: 1, max: 2000, obrigatorio: true },
      { k: 'nome', rotulo: 'Name', tipo: 'texto', max: 40, obrigatorio: true },
      { k: 'glb', rotulo: 'Modelo', tipo: 'texto', max: 30, obrigatorio: true, validar: s => /^pm\d{4}[\w-]{0,20}$/.test(s) ? null : 'ex.: pm0025_00' },
      { k: 'nota', rotulo: 'Forma', tipo: 'texto', max: 40 },
      { k: 'altura', rotulo: 'Altura do modelo (m)', tipo: 'num', min: 0, max: 200 },
    ],
  },
  exp_especies: {
    titulo: 'EXP by species', arquivo: 'exp', caminho: 'especies', forma: 'mapa', tela: 'especies', idValido: RE_DEX,
    descricao: 'EXP curve, base EXP (awarded when defeated) and base friendship for each species.',
    campos: [
      { k: 'c', rotulo: 'Curva de EXP', tipo: 'opcao', obrigatorio: true, opcoes: Object.entries(CURVAS).map(([v, rotulo]) => ({ v, rotulo })) },
      { k: 'b', rotulo: 'EXP base', tipo: 'num', int: true, min: 1, max: 1000, obrigatorio: true },
      { k: 'a', rotulo: 'Amizade base', tipo: 'num', int: true, min: 0, max: 255, obrigatorio: true },
    ],
  },
};
