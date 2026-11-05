/** Apply a purchase using server-owned catalogue prices and quantities. */
export function comprarNaLoja(conta, pedido, catalogo) {
  if (!conta?.save || typeof conta.save !== 'object') return { erro: 'Sign in and start your adventure before buying items.' };
  const item = Number(pedido.item), quantidade = pedido.qtd == null ? 1 : Number(pedido.qtd);
  if (!Number.isSafeInteger(item) || item < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 999) return { erro: 'Invalid purchase quantity or item.' };
  const estoque = catalogo?.lojas?.[String(pedido.loja)];
  const produto = Array.isArray(estoque) && estoque.find(p => Number(p.item) === item);
  const registro = catalogo?.itens?.[item];
  if (!produto || !registro) return { erro: 'This item is not sold in this shop.' };
  const preco = Number(produto.preco), unidades = Number(produto.n ?? 1), moeda = Number(produto.moeda ?? 1);
  const custo = preco * quantidade, total = unidades * quantidade;
  if (!Number.isSafeInteger(preco) || preco < 0 || !Number.isSafeInteger(unidades) || unidades < 1 || !Number.isSafeInteger(moeda) || moeda < 1 || !Number.isSafeInteger(custo) || !Number.isSafeInteger(total)) return { erro: 'This shop has an invalid price or quantity.' };
  const save = conta.save, saldo = moeda === 1 ? (save.dinheiro ?? 50000) : (save.itens?.[moeda] ?? 0);
  if (!Number.isSafeInteger(saldo) || saldo < custo) return { erro: 'Not enough currency for this purchase.' };
  const destino = registro.t === 7 ? 'bolas' : 'itens';
  const existente = save[destino]?.[item] ?? 0;
  if (!Number.isSafeInteger(existente) || existente < 0 || !Number.isSafeInteger(existente + total)) return { erro: 'The bag cannot hold this purchase.' };
  const itens = { ...(save.itens || {}) }, bolas = { ...(save.bolas || {}) };
  let dinheiro = save.dinheiro ?? 50000;
  if (moeda === 1) dinheiro -= custo;
  else { itens[moeda] = saldo - custo; if (!itens[moeda]) delete itens[moeda]; }
  const bolsa = destino === 'bolas' ? bolas : itens;
  bolsa[item] = (bolsa[item] || 0) + total;
  Object.assign(save, { dinheiro, itens, bolas });
  conta.rev = (conta.rev || 0) + 1;
  return { bolsa: { dinheiro, itens, bolas, insignias: save.insignias || [] }, item, n: total };
}
