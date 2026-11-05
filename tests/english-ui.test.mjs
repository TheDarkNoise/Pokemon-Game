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

test('English battle notices keep player names, species, numbers and punctuation', async () => {
  await I18n.carregar('en');
  assert.equal(I18n.t('Outro treinador já jogou a bola nesse Pikachu.'), 'Another trainer has already thrown a ball at that Pikachu.');
  assert.equal(I18n.t('Você pagou 500 Moedas pra desafiar Brock de novo.'), 'You paid 500 Coins to challenge Brock again.');
  assert.equal(I18n.t('⚠ A captura não foi registrada no servidor (timeout): Pikachu não entrou no time.'), '⚠ The catch was not recorded on the server (timeout): Pikachu did not join your party.');
  assert.equal(I18n.t('Pikachu foi pra caixa (time cheio).'), 'Pikachu was sent to storage (party full).');
});

test('Elite Four messages distinguish rewards, next opponent and completion', async () => {
  await I18n.carregar('en');
  assert.equal(I18n.t('⚔ Lorelei caiu (1/5) — +500 Moedas. Bruno espera no quarto seguinte — e o seu time continua como está.'), '⚔ Lorelei was defeated (1/5) — +500 Coins. Bruno awaits in the next room — your party stays as it is.');
  assert.equal(I18n.t('🏆 Você venceu Blue e é o Campeão de Kanto! Os seus Pokémon obedecem até o Lv 100. +2000 Moedas'), '🏆 You defeated Blue and became the Champion of Kanto! Your Pokémon obey up to Lv 100. +2000 Coins');
  assert.equal(I18n.t('🏆 Você venceu Blue e é o Campeão de Kanto! Os seus Pokémon obedecem até o Lv 100.'), '🏆 You defeated Blue and became the Champion of Kanto! Your Pokémon obey up to Lv 100.');
});

test('nested knowledge descriptions and account errors translate through production lookup', async () => {
  await I18n.carregar('en');
  assert.equal(I18n.t('📖 Bulbasaur: conhecimento nível 1 (Avistado) — a ficha mostra os tipos e onde vive'), '📖 Bulbasaur: knowledge level 1 (Seen) — the entry shows types and habitat');
  assert.equal(I18n.t('Usuário ou senha incorretos.'), 'Incorrect username or password.');
  assert.equal(I18n.t('🔇 Você foi silenciado até 12:30. Motivo: spam'), '🔇 You are muted until 12:30. Reason: spam');
});

test('Portuguese remains the source language and unrecognized names stay intact', async () => {
  await I18n.carregar('pt');
  assert.equal(I18n.t('Você chegou em Pallet.'), 'Você chegou em Pallet.');
  await I18n.carregar('en');
  for (const value of ['Abra', 'Pikachu', 'Dad_42', 'Son_7', 'pm0025_00', '/raid anunciar']) assert.equal(I18n.t(value), value);
  assert.equal(I18n.t('Você chegou em Pallet.'), 'You arrived in Pallet.');
  globalThis.fetch = originalFetch;
});
