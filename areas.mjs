/** Preserve original map-name city/landmark rules after stored names become English. */
const originais = {
  "Celadon City": "Cidade Celadon",
  "Cerulean City": "Cidade Cerulean",
  "Cinnabar Island": "Ilha Cinnabar",
  "Five Island": "Ilha Cinco",
  "Four Island": "Ilha Quatro",
  "Fuchsia City": "Cidade Fuchsia",
  "Indigo League Pokémon Center": "Liga ÍndigoCentro de Pokémon",
  "Lavender Town": "Cidade Lavender",
  "One Island": "Ilha Um",
  "One Island-Pokémon Center": "Ilha um-Centro de Pokémon",
  "Outcast Island": "Ilha Solitária",
  "Pallet Town": "Cidade Pallet",
  "Pewter City": "Cidade Pewter",
  "Poké Mart - Cinnabar": "Loja da Cidade Cinnabar",
  "Saffron City": "Cidade Saffron",
  "Seafoam Islands – Floor 1": "Ilhas Seaform Piso 1",
  "Seafoam Islands – Floor 2": "Ilhas Seaform Piso 2",
  "Seafoam Islands – Floor 3": "Ilhas Seaform Piso 3",
  "Seafoam Islands – Floor 4": "Ilhas Seaform Piso 4",
  "Seafoam Islands – Floor 5": "Ilhas Seaform Piso 5",
  "Seven Island": "Ilha Sete",
  "Six Island": "Ilha Seis",
  "Three Island": "Ilha Três",
  "Two Island": "Ilha Dois",
  "Vermilion City": "Cidade Vermilion",
  "Viridian City": "Cidade Viridian"
};
const fonte = nome => Object.hasOwn(originais, nome) ? originais[nome] : nome;
export const ehCidade = nome => /^Cidade/.test(fonte(nome));
export const ehCidadeOuIlha = nome => /Cidade|Ilha/.test(fonte(nome));
export const ehLocalidade = nome => /Cidade|Ilha|Liga/.test(fonte(nome));
