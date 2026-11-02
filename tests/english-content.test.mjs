import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Exercise the production translator with the shipped local dictionaries.
globalThis.document = { documentElement: { setAttribute() {}, classList: { add() {} } } };
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  try {
    const file = new URL('../public/' + String(url).replace(/^\.\//, '').split('?')[0], import.meta.url);
    const text = await readFile(file, 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  } catch { return { ok: false }; }
};
const I18n = await import('../i18n.mjs');

test('location, quest and cosmetic labels use the shipped English lookup', async () => {
  await I18n.carregar('en');
  for (const [source, expected] of [
    ['Ilhas Seaform Piso 4', 'Seafoam Islands – Floor 4'],
    ['Caverna Celeste Piso 2', 'Cerulean Cave – Floor 2'],
    ['Monte das Brasas-Caverna Direita Piso -1', 'Mt. Ember – Right Cave – Floor -1'],
    ['Responder ao Professor Carvalho', 'Answer Professor Oak'],
    ['mochila 11', 'Backpack 11'],
    ['Conjunto Cibernético', 'Cyber Outfit'],
    ['Fashion 52001 · inicial do jogo', 'Fashion 52001 · starter outfit'],
    ['cores livres: pele, cabelo, vestido, olhos', 'custom colors: skin, hair, dress, eyes']
  ]) assert.equal(I18n.t(source), expected);
});

test('evolution instructions retain their item and species names', async () => {
  await I18n.carregar('en');
  assert.equal(I18n.t('troca segurando Deep Sea Scale'), 'trade holding Deep Sea Scale');
  assert.equal(I18n.t('usar Malicious Armor'), 'use Malicious Armor');
  assert.equal(I18n.t('regra especial: three defeated bisharp'), 'special rule: defeat three Bisharp');
  assert.equal(I18n.t('troca segurando Pedra Rei — ou usar o item direto'), 'trade holding King’s Rock — or use the item directly');
});

test('raid notices preserve dynamic names and the party/storage distinction', async () => {
  await I18n.carregar('en');
  assert.equal(I18n.t('Indo pra raid do Mew…'), 'Joining the Mew raid…');
  assert.equal(I18n.t('✨ O seu Mew is SHINY!'), '✨ Your Mew is SHINY!');
  assert.equal(I18n.t('O Mew entrou no seu time (ou na caixa, se o time estiver cheio).'), 'Mew joined your party (or storage, if your party is full).');
  for (const value of ['Mew', 'Abra', 'Boy_012', 'menino', 'roupa2', '/g']) assert.equal(I18n.t(value), value);
  await I18n.carregar('pt');
  assert.equal(I18n.t('Conjunto Cibernético'), 'Conjunto Cibernético');
  globalThis.fetch = originalFetch;
});
