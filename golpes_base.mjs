// Shared fallback move IDs; no browser loading or rendering.
export const GOLPES_PIKA = ['thundershock', 'thunderbolt'];      // teclas 1 e 2
// o que cada espécie selvagem usa (por dex); quem não está aqui usa Tackle
export const GOLPES_ESPECIE = {
  19: ['tackle', 'quickattack'], 16: ['gust', 'tackle'], 17: ['gust', 'quickattack'], 25: ['thundershock', 'quickattack'], 1: ['tackle', 'vinewhip'], 4: ['ember'], 7: ['watergun'], 27: ['scratch', 'swift'], 54: ['watergun', 'scratch'], 74: ['tackle', 'rockthrow'], 94: ['lick'], 403: ['tackle', 'bite'], 447: ['quickattack', 'swift'],
  // lendários (seguidor ou chefão)
  144: ['gust', 'blizzard'], 145: ['thunderbolt', 'gust'], 146: ['fireblast', 'gust'], 150: ['psychic', 'hyperbeam'],
  243: ['thunderbolt', 'quickattack'], 244: ['flamethrower', 'fireblast'], 245: ['hydropump', 'watergun'], 249: ['hydropump', 'gust'], 250: ['fireblast', 'gust'],
  382: ['hydropump', 'watergun'], 383: ['earthquake', 'fireblast'], 384: ['hyperbeam', 'gust'], 483: ['hyperbeam', 'flamethrower'], 484: ['hydropump', 'hyperbeam'], 487: ['psychic', 'hyperbeam'], 493: ['hyperbeam', 'psychic'], 130: ['hydropump', 'tackle'], 6: ['flamethrower', 'fireblast'],
};
