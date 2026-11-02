/** English formatting for admin notices; original wire responses remain unchanged. */
export function criarTradutor(...dicionarios) {
  const exatas = new Map(), padroes = [];
  const mensagens = new Map(dicionarios.flatMap(d => Object.entries(d || {})));
  for (const [chave, valor] of mensagens) {
    if (typeof valor !== 'string' || !chave) continue;
    if (/\{\w+\}/.test(chave)) {
      if (/^\{\w+\}$/.test(chave.trim())) continue;
      let re = '^'; const vars = [];
      for (const parte of chave.split(/(\{\w+\})/)) {
        const v = /^\{(\w+)\}$/.exec(parte);
        if (v) { vars.push(v[1]); re += '([\\s\\S]*?)'; }
        else re += parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      padroes.push({ re: new RegExp(re + '$'), valor, vars, tamanho: chave.length });
    } else exatas.set(chave, valor);
  }
  padroes.sort((a, b) => b.tamanho - a.tamanho);
  function traduzir(texto) {
    if (typeof texto !== 'string' || !texto) return texto;
    const chave = texto.trim();
    if (exatas.has(chave)) return texto.replace(chave, exatas.get(chave));
    for (const p of padroes) {
      const m = p.re.exec(texto);
      if (m) return p.valor.replace(/\{(\w+)\}/g, (original, nome) => {
        const i = p.vars.indexOf(nome);
        return i < 0 ? original : traduzir(m[i + 1]);
      });
    }
    return texto;
  }
  return traduzir;
}

export async function carregarMensagens(fetcher = globalThis.fetch) {
  const ler = async caminho => {
    try { const r = await fetcher(caminho); return r.ok ? await r.json() : {}; }
    catch { return {}; }
  };
  const [ui, painel] = await Promise.all([ler('/data/idioma/ui_en.json'), ler('/data/traducoes.json')]);
  const correcoes = Object.fromEntries((Array.isArray(painel) ? painel : [])
    .filter(r => r && typeof r.pt === 'string' && r.pt.trim() && typeof r.en === 'string' && r.en.trim())
    .map(r => [r.pt.trim(), r.en]));
  return criarTradutor(ui, correcoes);
}
