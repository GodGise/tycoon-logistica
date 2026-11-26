// Elenca i testi del gioco che non sono ancora nel dizionario inglese (js/lingua-en.js).
// Uso: npm i acorn acorn-walk && node scripts/testi-mancanti.js
// Le parti variabili dei template (${...}) diventano {}. Alcune voci sono codice o nomi propri: si ignorano.
const fs = require('fs'), path = require('path'), acorn = require('acorn'), walk = require('acorn-walk');
const dir = path.join(__dirname, '..', 'js');
const en = fs.readFileSync(path.join(dir, 'lingua-en.js'), 'utf8');
const EN = JSON.parse(en.slice(en.indexOf('Object.assign(EN, ') + 18, en.lastIndexOf('}') + 1));
const testi = new Set();
const aggiungi = x => { x = x.replace(/\s+/g, ' ').trim(); if (/[A-Za-zàèéìòù]{3}/.test(x) && !/^[a-z0-9\-_.]+$/.test(x) && !/[{};=<>#]|=>/.test(x.replace(/\{\}/g, ''))) testi.add(x); };
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('lingua'))) {
  const ast = acorn.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { ecmaVersion: 'latest' });
  walk.full(ast, n => {
    if (n.type === 'Literal' && typeof n.value === 'string') n.value.replace(/<[^>]*>/g, '\u0001').split('\u0001').forEach(aggiungi);
    if (n.type === 'TemplateLiteral') n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? '\u0002' : '')).join('')
      .replace(/<[^>]*>/g, '\u0001').split('\u0001').forEach(p => aggiungi(p.replace(/\u0002/g, '{}')));
  });
}
const mancanti = [...testi].filter(t => !(t in EN));
console.log(mancanti.join('\n')); console.error(mancanti.length + ' testi senza traduzione (controlla quali sono davvero testo a schermo)');
