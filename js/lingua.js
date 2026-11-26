/* Tycoon Logistica – lingua del gioco (italiano / inglese).
   Il gioco è scritto in italiano; in inglese ogni testo che compare a schermo viene tradotto con il dizionario
   di js/lingua-en.js. Le frasi con parti variabili (nomi, numeri) sono scritte con {} al posto delle parti variabili,
   e le parti variabili vengono tradotte a loro volta (es. i nomi delle zone).
   La scelta si fa al primo avvio e si cambia nelle Impostazioni (la pagina si ricarica). */
const CHIAVE_LINGUA = 'tycoon-logistica-lingua';
let LINGUA = (() => { try { return localStorage.getItem(CHIAVE_LINGUA); } catch (e) { return null; } })();
const LOCALE = LINGUA === 'en' ? 'en-GB' : 'it-IT';
document.documentElement.lang = LINGUA === 'en' ? 'en' : 'it';
function inglese() { return LINGUA === 'en'; }
function scegliLingua(l) { try { localStorage.setItem(CHIAVE_LINGUA, l); } catch (e) { /* ignora */ } location.reload(); }

const EN = {};                 // riempito da js/lingua-en.js
let esatti = null, modelli = null;
const cacheTr = new Map(), giaInglese = new Set();   // giaInglese: testi già tradotti, da non ritradurre
function preparaDizionario() {
  esatti = new Map(); modelli = [];
  for (const [k, v] of Object.entries(EN)) {
    if (k.includes('{}')) {
      // i segnaposti dell'inglese ({}, {s}, {-}) sono nello stesso ordine di quelli italiani:
      // dove l'inglese ha {s} la parte italiana è solo la desinenza (o/i/e/a), così il modello non "mangia" la frase
      const tipi = (v.match(/\{[s-]?\}/g) || []);
      const parti = k.split('{}').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      let re = '^' + parti[0];
      for (let i = 1; i < parti.length; i++) re += (tipi[i - 1] === '{s}' ? '([oiea]?)' : '(.*?)') + parti[i];
      const fissi = k.replace(/\{\}|\s/g, '').length;
      if (fissi >= 3) modelli.push({ re: new RegExp(re + '$', 's'), en: v, fissi });   // i modelli quasi vuoti ("{} · {}") prenderebbero qualsiasi frase
    } else esatti.set(k, v);
  }
  modelli.sort((a, b) => b.fissi - a.fissi);   // prima i modelli più specifici
}
// traduce una frase (con gli spazi intorno com'erano)
function tr(s) {
  if (!inglese() || s == null) return s;
  const str = String(s), testo = str.trim();
  if (!testo || !/[a-zàèéìòù]/i.test(testo)) return str;
  if (cacheTr.has(testo)) return str.replace(testo, cacheTr.get(testo));
  if (giaInglese.has(testo)) return str;
  if (!esatti) preparaDizionario();
  let out = esatti.get(testo);
  if (out === undefined) {
    for (const m of modelli) {
      const r = m.re.exec(testo);
      if (!r) continue;
      // le parti variabili vengono tradotte a loro volta; una parte lunga che non si traduce vuol dire che il modello
      // ha "mangiato" una frase intera che non c'entra: si prova il modello successivo
      const vals = r.slice(1).map(v => /[a-zàèéìòù]{2}/i.test(v) ? tr(v) : v);
      if (vals.some((v, j) => v === r[j + 1] && v.length > 30)) continue;
      let i = 0;
      // {} = parte variabile, {s} = plurale italiano (i) → "s" inglese, {-} = parte da saltare
      out = m.en.replace(/\{([s-]?)\}/g, (_, k) => { const v = vals[i], o = r[i + 1] || ''; i++; return k === 's' ? (o === 'i' ? 's' : '') : k === '-' ? '' : (v || ''); });
      break;
    }
  }
  // liste "a · b · c": si traducono i pezzi uno per uno
  if (out === undefined && testo.includes(' · ')) { const t = testo.split(' · ').map(x => tr(x)).join(' · '); if (t !== testo) out = t; }
  if (out === undefined) out = testo;
  if (cacheTr.size > 5000) cacheTr.clear();
  cacheTr.set(testo, out); if (out !== testo) giaInglese.add(out.trim());
  return str.replace(testo, out);
}

// traduce tutto quello che compare nella pagina, anche quando cambia
const ATTRIBUTI = ['placeholder', 'title', 'aria-label'];
function traduciNodo(n) {
  if (n.nodeType === 3) { const p = n.parentNode; if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return; const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; return; }
  if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.nodeName)) return;
  ATTRIBUTI.forEach(a => { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } });
  if (n.nodeName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) n.value = tr(n.value);
  for (const c of n.childNodes) traduciNodo(c);
}
if (inglese()) {
  const avvia = () => {
    traduciNodo(document.body); document.title = tr(document.title);
    new MutationObserver(lista => lista.forEach(m => {
      if (m.type === 'characterData') traduciNodo(m.target);
      else if (m.type === 'attributes') traduciNodo(m.target);
      else m.addedNodes.forEach(traduciNodo);
    })).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', avvia) : avvia();
}

// al primo avvio: quale lingua?
function chiediLingua() {
  if (LINGUA) return;
  const d = document.createElement('div'); d.className = 'scelta-lingua';
  d.innerHTML = `<div class="scelta-lingua-corpo vetro"><img src="img/logo-default.png" alt=""><h2>Scegli la lingua<br><small>Choose your language</small></h2>
    <button class="btn primario" data-l="it">🇮🇹 Italiano</button><button class="btn primario" data-l="en">🇬🇧 English</button>
    <p class="nota">Puoi cambiarla dalle Impostazioni · You can change it in Settings</p></div>`;
  d.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) scegliLingua(b.dataset.l); });
  document.body.appendChild(d);
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', chiediLingua) : chiediLingua();
