/* Esquemas da Fase 3 do painel (cores de NPC, diálogos, traduções, raid e músicas). Entram no ESQUEMAS do esquemas.mjs (`...ESQUEMAS_F3`),
 * então valem as mesmas regras de lá: o navegador monta a tela e o servidor valida/grava com backup pelos mesmos esquemas.
 * Os eventos ao vivo NÃO estão aqui: têm tela própria (admin/eventos.mjs) e rota própria (servidor_eventos.mjs), porque
 * salvar precisa empurrar pros jogadores online. */

const ehObjeto = v => v && typeof v === 'object' && !Array.isArray(v);

// ── Cores de NPC (npc_tintas.json) ─────────────────────────────────────────────────────────────────────────────────────
/** [r, g, b] ou [r, g, b, a], de 0 a 2 (o shader multiplica a textura: acima de 1 clareia). */
const corRGBA = v => (Array.isArray(v) && (v.length === 3 || v.length === 4) && v.every(n => typeof n === 'number' && n >= 0 && n <= 2))
  ? null : "use [r, g, b, a] with values from 0 to 2 (1 = unchanged texture) — or choose a color in the preview above";
export const corHex = v => Array.isArray(v) ? '#' + v.slice(0, 3).map(n => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0')).join('') : '';
const nomePng = s => /^[\w .()-]{1,80}\.png$/i.test(s) ? null : ".png filename (in cenario/npc/mask)";
const canaisNeutros = v => (Array.isArray(v) && v.length <= 3 && v.every(c => ['R', 'G', 'B'].includes(c))) ? null : "list containing \"R\", \"G\" and/or \"B\" — e.g. [\"G\"]";

// ── Textos ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const linhasCurtas = (max = 10, tam = 300) => v => (Array.isArray(v) && v.length >= 1 && v.length <= max && v.every(s => typeof s === 'string' && s.length <= tam))
  ? null : `from 1 to ${max} lines, each up to ${tam} characters`;
const chaves = s => [...String(s || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
/** Tradução: as variáveis {x} da tradução têm que ser as mesmas do texto em português (senão o jogo mostra "{x}" cru). */
const traducaoCasa = r => {
  for (const l of ['en', 'es']) if (r[l] && chaves(r[l]) !== chaves(r.pt)) return `${l.toUpperCase()}: use the same placeholders as the Portuguese text (${chaves(r.pt) ? '{' + chaves(r.pt).split(',').join('}, {') + '}' : "none"})`;
  return null;
};

// ── Músicas (musicas.json): faixa = caminho em som/ sem .ogg ("bg/sound_road1") ──────────────────────────────────────────
const FAIXA = /^(bg|ui)\/[\w-]{1,60}$/;
const faixaOk = s => FAIXA.test(s) ? null : "track in \"bg/sound_road1\" format (file som/bg/sound_road1.ogg)";
const mapaDeFaixas = v => {
  if (!ehObjeto(v)) return "expected { \"id\": \"bg/faixa\" }";
  for (const [k, f] of Object.entries(v)) {
    if (!/^\d{1,9}$/.test(k)) return `invalid ID: ${k} (digits only)`;
    if (typeof f !== 'string' || !FAIXA.test(f)) return `${k}: track in "bg/sound_road1" format`;
  }
  return null;
};
const faixasFixas = ks => v => {
  if (!ehObjeto(v)) return `expected { ${ks.map(k => `"${k}": "bg/…"`).join(', ')} }`;
  for (const [k, f] of Object.entries(v)) if (!ks.includes(k) || typeof f !== 'string' || !FAIXA.test(f)) return `use only ${ks.join(', ')}, each with a track "bg/…"`;
  return null;
};

export const ESQUEMAS_F3 = {
  npc_tintas: {
    titulo: "NPC colors", arquivo: 'npc_tintas', forma: 'mapa', idValido: /^[\w][\w .:()-]{0,79}$/, idAjuda: "model material name (e.g. fc2013_00_nursejoy_hair_col) or \"<modelo>:<material>\"",
    descricao: 'Factory color for each part of NPCs, outfits, and backpacks: the texture is nearly white and color comes from these R/G/B/black mask channels. The preview shows the model (when available in this copy) with the edit.',
    previa: '/admin/previa_tinta.mjs',
    campos: [
      { k: 'ColorR', rotulo: "Red mask channel (R)", tipo: 'json', col: true, validar: corRGBA, resumo: corHex, ajuda: "Without a mask, this is the entire piece’s hue." },
      { k: 'ColorG', rotulo: "Green mask channel (G)", tipo: 'json', col: true, validar: corRGBA, resumo: corHex },
      { k: 'ColorB', rotulo: "Blue mask channel (B)", tipo: 'json', col: true, validar: corRGBA, resumo: corHex },
      { k: 'ColorBlack', rotulo: "Black mask channel (remainder)", tipo: 'json', col: true, validar: corRGBA, resumo: corHex },
      { k: 'mask', rotulo: "Mask", tipo: 'texto', max: 84, col: true, validar: s => s ? nomePng(s) : null, ajuda: "PNG in cenario/npc/mask. Empty = no mask (only channel R colors the base hue)." },
      { k: 'isMask', rotulo: "Coloring", tipo: 'opcao', opcoes: [{ v: 0, rotulo: "Recolor (normal)" }, { v: 1, rotulo: "Do not recolor (texture is already colored)" }] },
      { k: 'neutralizar', rotulo: "Recolor a colored texture (advanced)", tipo: 'json', validar: canaisNeutros,
        ajuda: "Mask channels whose original color is replaced with gray before recoloring — for example, hair that was already colored. E.g. [\"G\"]." },
      { k: 'ganho', rotulo: 'Gray brightness (with "Recolor")', tipo: 'num', min: 0.5, max: 4, ajuda: 'Default 1.6.' },
    ],
  },
  // as falas dos NPCs (npcs_glb.json) são a tela "NPCs (quem é quem)" da Fase 1; a Fase 3 só faz o jogo aberto aplicá-las na hora
  dialogos: {
    titulo: "Game dialogue", arquivo: 'dialogos', forma: 'objeto', recarga: 'vivo',
    descricao: "Dialogue formerly fixed in code (Pallet gate, Professor Oak, starter selection, opening). Empty = original text. {nome} = Pokémon name. Updates apply immediately in an open game.",
    campos: [
      { k: 'oakNome', rotulo: 'Professor name in dialogue', tipo: 'texto', max: 40, ajuda: 'Original: Professor Samuel.' },
      { k: 'portao', rotulo: "Assistant at Pallet gate (without a Pokémon)", tipo: 'linhas', validar: linhasCurtas(6) },
      { k: 'portaoBalao', rotulo: "Speech bubble when the assistant is far away", tipo: 'texto', max: 120 },
      { k: 'portaoChat', rotulo: "Chat line (gate)", tipo: 'texto', max: 200 },
      { k: 'oakJaEscolheu', rotulo: "Oak: starter already chosen", tipo: 'linhas', validar: linhasCurtas(4), ajuda: "Original: You already chose {nome}. Take good care of it!" },
      { k: 'oakEntrega', rotulo: "Oak: starter handoff", tipo: 'linhas', validar: linhasCurtas(6) },
      { k: 'escolhaTitulo', rotulo: "Starter selection: title", tipo: 'texto', max: 80 },
      { k: 'escolhaSub', rotulo: "Starter selection: subtitle", tipo: 'texto', max: 160 },
      { k: 'jaVenceu', rotulo: "Previously defeated trainer (without custom dialogue)", tipo: 'texto', max: 120 },
      { k: 'introLiga', rotulo: "Opening: caption 1", tipo: 'texto', max: 80 },
      { k: 'introRed', rotulo: "Opening: Red’s dialogue", tipo: 'texto', max: 80 },
      { k: 'introMega', rotulo: "Opening: Mega Evolution", tipo: 'texto', max: 80 },
    ],
  },
  traducoes: {
    titulo: "Translations (EN/ES)", arquivo: 'traducoes', forma: 'lista', id: 'pt', recarga: 'vivo',
    descricao: 'The game source text is Portuguese and is translated live into the player’s English/Spanish language. Each row contains the exact Portuguese source text and its translation. {x} matches any segment (for example: "Você chegou em {x}." → "You arrived in {x}."). These entries override the dictionaries in data/idioma/. An open game applies changes immediately.',
    validar: traducaoCasa,
    campos: [
      { k: 'pt', rotulo: "Portuguese (as displayed in the game)", tipo: 'texto', max: 400, col: true, obrigatorio: true, area: true },
      { k: 'en', rotulo: 'English', tipo: 'texto', max: 400, col: true, area: true },
      { k: 'es', rotulo: 'Español', tipo: 'texto', max: 400, col: true, area: true },
      { k: 'nota', rotulo: "Where displayed (note)", tipo: 'texto', max: 80 },
    ],
  },
  musicas: {
    titulo: "Music by area", arquivo: 'musicas', forma: 'objeto', recarga: 'vivo',
    descricao: "Track played in each Kanto area, interior (scene) and battle. A track is a file in som/ without .ogg. The preview lists named areas and plays their tracks; an open game updates immediately.",
    previa: '/admin/previa_musica.mjs',
    campos: [
      { k: 'areas', rotulo: 'Areas (id → track)', tipo: 'json', validar: mapaDeFaixas, ajuda: 'Areas not listed use the default area track.' },
      { k: 'cenas', rotulo: 'Interiors (scene → track)', tipo: 'json', validar: mapaDeFaixas, ajuda: 'Scenes not listed use the default interior track.' },
      { k: 'padrao', rotulo: 'Default', tipo: 'json', validar: faixasFixas(['area', 'interior']), ajuda: '{ "area": "bg/…", "interior": "bg/…" }' },
      { k: 'batalha', rotulo: "Battles", tipo: 'json', validar: faixasFixas(['treinador', 'ginasio', 'elite']), ajuda: '{ "treinador": "bg/…", "ginasio": "bg/…", "elite": "bg/…" }' },
      { k: 'login', rotulo: "Login screen", tipo: 'texto', max: 64, validar: faixaOk },
    ],
  },
  raid: {
    titulo: 'Raid', arquivo: 'raid', forma: 'objeto',
    descricao: "Live raid arena and boss. Arena, queue size, boss name and size affect the game UI. HP, damage, shiny rate and rewards are controlled by servidor_raid.mjs, reloaded on each /raid anunciar; chat /raid commands override only that raid.",
    previa: '/admin/previa_raid.mjs',
    validar: r => r.chefeGlb && r.chefeDex && +r.chefeGlb.slice(2, 6) !== r.chefeDex ? `model ${r.chefeGlb} belongs to species number ${+r.chefeGlb.slice(2, 6)}, rather than${r.chefeDex}` : null,
    campos: [
      { k: 'arena', rotulo: "Arena scene", tipo: 'texto', max: 12, validar: s => /^\d{3,9}$/.test(s) ? null : "scene ID (digits only)", ajuda: "Original: 4120009 (Lorelei’s Room)." },
      { k: 'vagas', rotulo: "Queue slots", tipo: 'num', min: 1, max: 50, int: true, ajuda: 'Original: 10.' },
      { k: 'chefeNome', rotulo: 'Boss name', tipo: 'texto', max: 30, ajuda: 'Original: Mew.' },
      { k: 'chefeDex', rotulo: "Boss species (number)", tipo: 'num', min: 1, max: 2000, int: true, ajuda: 'Original: 151.' },
      { k: 'chefeGlb', rotulo: "Boss model", tipo: 'texto', max: 30, validar: s => /^pm\d{4}(_\d{2})?$/.test(s) ? null : "e.g. pm0151_00", ajuda: 'cenario/mon/<modelo>.glb. Original: pm0151_00.' },
      { k: 'chefeNivel', rotulo: 'Boss level', tipo: 'num', min: 1, max: 100, int: true, ajuda: 'Original: 70.' },
      { k: 'chefeHp', rotulo: 'Boss HP', tipo: 'num', min: 0, max: 10000000, int: true, ajuda: '0 = automatic (based on player count). /raid hp N changes only that raid.' },
      { k: 'chefeDano', rotulo: "Boss damage (×)", tipo: 'num', min: 0, max: 10, ajuda: "1 = normal. /raid dano F affects only that raid." },
      { k: 'taxaShiny', rotulo: "Reward shiny rate (1 in N)", tipo: 'num', min: 1, max: 1000000, int: true, ajuda: "/raid shiny N affects only that raid." },
      { k: 'premio', rotulo: "Reward", tipo: 'opcao', opcoes: [{ v: 'mew', rotulo: "The boss (joins the party)" }, { v: 'sem-mew', rotulo: "Items only (without the boss)" }] },
      { k: 'altura', rotulo: "Boss height in the arena (m)", tipo: 'num', min: 0.5, max: 20, ajuda: "Original: 2.5." },
      { k: 'flutua', rotulo: "Boss floating height (m)", tipo: 'num', min: 0, max: 10, ajuda: 'Original: 1.' },
    ],
  },
};
