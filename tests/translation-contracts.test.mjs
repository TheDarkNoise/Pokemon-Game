import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ESQUEMAS, validarColecao } from '../admin/esquemas.mjs';

test('admin schemas use the field names consumed by the game and editors', () => {
  const keys = name => ESQUEMAS[name].campos.map(c => c.k);
  assert(keys('config_jogo').includes('maxBolasNoAr'));
  assert(!keys('config_jogo').includes('maxBallsNoAr'));
  assert.equal(ESQUEMAS.lojas.usaItens, true);
  assert(keys('ginasios').includes('resetMoedas'));
  assert(!keys('ginasios').includes('resetCurrencys'));
  for (const key of ['itemNome', 'segurandoNome', 'golpeNome']) {
    assert(keys('evolucoes').includes(key), `Missing canonical field: ${key}`);
  }
  for (const key of ['itemName', 'segurandoName', 'golpeName']) {
    assert(!keys('evolucoes').includes(key), `Translated internal field: ${key}`);
  }
});

test('all shipped evolution rules validate and preserve their display-name fields', async () => {
  const { por } = JSON.parse(await readFile(new URL('../public/data/evolucoes.json', import.meta.url), 'utf8'));
  const result = validarColecao(ESQUEMAS.evolucoes, por);
  assert.equal(result.ok, true, result.erro);
  for (const [dex, rules] of Object.entries(por)) {
    for (const [i, rule] of rules.entries()) {
      for (const key of ['itemNome', 'segurandoNome', 'golpeNome']) {
        if (rule[key] != null) assert.equal(result.v[dex][i][key], rule[key]);
      }
    }
  }
});

test('evolution rules accept canonical names and still reject missing names', () => {
  const validate = rule => validarColecao(ESQUEMAS.evolucoes, {
    1: [{ para: 2, nome: 'Ivysaur', texto: 'Special evolution', ...rule }],
  });
  assert.equal(validate({ gatilho: 'item', item: 0, itemNome: 'Future Stone' }).ok, true);
  assert.equal(validate({ gatilho: 'nivel', segurando: 0, segurandoNome: 'Future Item' }).ok, true);
  assert.equal(validate({ gatilho: 'nivel', golpe: 10246, golpeNome: 'Ancient Power' }).ok, true);
  assert.equal(validate({ gatilho: 'item', item: 0 }).ok, false);
  assert.equal(validate({ gatilho: 'nivel', segurando: 0 }).ok, false);
  assert.equal(validate({ gatilho: 'nivel', golpe: 10246 }).ok, false);
});
