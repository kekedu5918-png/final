/**
 * Corrige le mojibake UTF-8 dans js/data/printsheets.js (mélange correct/cassé).
 * Ordre : champs emoji → séquences Ã/Â → tirets & symboles → remplacements ciblés.
 */
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const dest = path.join(__dirname, "../js/data/printsheets.js");
let t = fs.readFileSync(dest, "utf8");
if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);

const EMOJI_MANUAL = {
  "\u00f0\u0178\u0161\u201d": "🚨",
  "â³": "⏳",
  "âš–ï¸": "⚖️",
  "â˜ ï¸": "☠️",
  "â›“ï¸": "⛓️",
  "ðŸ ": "🏠",
  "ðŸ›ï¸": "🏛️",
  "ðŸŒ": "🌍",
  "ðŸ”": "🔍",
  "ðŸŽ™ï¸": "🎙️",
  "ðŸ—ƒï¸": "🗃️",
  "ðŸ•µï¸": "🕵️",
  "ðŸ›¡ï¸": "🛡️",
  "â±ï¸": "⏱️",
};

function fixEmojiField(s) {
  if (!s) return s;
  if (Object.prototype.hasOwnProperty.call(EMOJI_MANUAL, s)) return EMOJI_MANUAL[s];
  /* Déjà en UTF-8 (ré-exécution du script) : pas de marqueurs mojibake */
  if (!s.includes("\u00f0") && !s.includes("\u00e2") && !s.includes("\u00c3")) return s;
  try {
    const b = iconv.encode(s, "cp1252");
    let out = b.toString("utf8");
    if (/\uFFFD/.test(out)) {
      out = out.replace(/\uFFFD/g, "");
      if (/^[\u2696\u2620\u26D3\u2696]$/.test(out) || out === "⚖" || out === "☠") out += "\uFE0F";
    }
    return out;
  } catch {
    return s;
  }
}

t = t.replace(/\bemoji:'((?:\\.|[^'\\])*)'/g, (m, val) => {
  const unescaped = val.replace(/\\(.)/g, "$1");
  const fixed = fixEmojiField(unescaped);
  return `emoji:'${fixed.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
});

function fixC3(s) {
  return s.replace(/\u00c3([\s\S])/g, (m, ch) => {
    const b = iconv.encode(ch, "cp1252");
    if (b.length !== 1) return m;
    const out = Buffer.from([0xc3, b[0]]).toString("utf8");
    return /\uFFFD/.test(out) ? m : out;
  });
}

function fixC2(s) {
  return s.replace(/\u00c2([\s\S])/g, (m, ch) => {
    const b = iconv.encode(ch, "cp1252");
    if (b.length !== 1) return m;
    const out = Buffer.from([0xc2, b[0]]).toString("utf8");
    return /\uFFFD/.test(out) ? m : out;
  });
}

t = fixC3(t);
t = fixC2(t);

/* UTF-8 à 3 octets (tirets, flèches, guillemets, etc.) vus comme 3 caractères cp1252 */
const triples = [
  ["\u00e2\u20ac\u201d", "\u2014"],
  ["\u00e2\u20ac\u201c", "\u2013"],
  ["\u00e2\u2030\u00a4", "\u2264"],
  ["\u00e2\u2030\u00a5", "\u2265"],
  ["\u00e2\u2030\u00a0", "\u2260"],
  ["\u00e2\u2020\u2019", "\u2192"],
  ["\u00e2\u2020\u2018", "\u2190"],
  ["\u00e2\u20ac\u00a6", "\u2026"],
  ["\u00e2\u201a\u00ac", "\u20ac"],
];
for (const [a, b] of triples) t = t.split(a).join(b);

/* Emojis dans HTML (mojibake spécifique, hors champs emoji:'…') */
const htmlEmoji = [
  ["\u00f0\u0178\u201c\u0160", "📊"],
  ["\u00f0\u0178\u201d\u2019", "🔒"],
  ["\u00f0\u0178\u201d\u008d", "🔍"],
  ["\u00e2\u0161\u2013\u00ef\u00b8\u008f", "⚖️"],
  ["\u00e2\u203a\u201c\u00ef\u00b8\u008f", "⛓️"],
  ["\u00f0\u0178\u201c\u009d", "📝"],
  ["\u00e2\u008f\u00b1\u00ef\u00b8\u008f", "⏱️"],
  ["\u00f0\u0178\u008f\u203a\u00ef\u00b8\u008f", "🏛️"],
  ["\u00f0\u0178\u2014\u0192\u00ef\u00b8\u008f", "🗃️"],
  ["\u00f0\u0178\u201c\u201e", "📄"],
];
for (const [a, b] of htmlEmoji) t = t.split(a).join(b);

/* Même séquence que l’entête police (chapitres) : ðŸš¨ */
t = t.split("\u00f0\u0178\u0161\u201d").join("🚨");

/* œ (C5 93) */
t = t.replace(/\u00c5\u201c/g, "œ");
t = t.replace(/\u00c5\u2019/g, "Œ");

/* Rares restes */
const fixes = [
  [/âš ï¸/g, "⚠️"],
  [/âš¡/g, "⚡"],
  [/âœ“/g, "✓"],
  [/â†“/g, "↓"],
  [/NÂ°/g, "N°"],
  [/nÂ°/g, "n°"],
  [/(\d)Â°/g, "$1°"],
  [/manÅ"uvrier/g, "manœuvrier"],
  [/EnquÃªte/g, "Enquête"],
  [/Énrôlement/g, "Enrôlement"],
];

for (const [a, b] of fixes) t = t.replace(a, b);

fs.writeFileSync(dest, t, "utf8");
console.log("Written", dest, "length", t.length);
