/**
 * Reconstruit js/data/chapters.js depuis la source brute (chapters.github-raw.js.txt) :
 * - emojis dans icon/em : octets Windows-1252 → UTF-8 (iconv-lite)
 * - restes : correctifs manuels + remplacements Ã‰ → É, etc.
 */
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const root = path.join(__dirname, "..");
const src = process.argv[2] || path.join(__dirname, "chapters.github-raw.js.txt");
const dest = path.join(root, "js/data/chapters.js");

let t = fs.readFileSync(src, "utf8");

/** Séquences où cp1252→utf8 laisse U+FFFD ou est incorrecte (fichier source partiellement altéré). */
const EMOJI_MANUAL = {
  /** Police siren U+1F6A8 (mojibake se termine par U+201D au lieu d'octet UTF-8). */
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
};

function fixEmojiField(s) {
  if (!s) return s;
  if (Object.prototype.hasOwnProperty.call(EMOJI_MANUAL, s)) return EMOJI_MANUAL[s];
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

t = t.replace(/\b(icon|em):'((?:\\.|[^'\\])*)'/g, (m, field, val) => {
  const unescaped = val.replace(/\\(.)/g, "$1");
  const fixed = fixEmojiField(unescaped);
  const reescaped = fixed.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `${field}:'${reescaped}'`;
});

const utf8fixes = [
  [/DÃ‰LITS/g, "DÉLITS"],
  [/DÃ‰LIT/g, "DÉLIT"],
  [/DÃ‰FINITIVE/g, "DÉFINITIVE"],
  [/Ã‰tat/g, "État"],
  [/Ã‰LITS/g, "ÉLITS"],
  [/Ã‰MISE/g, "ÉMISE"],
  [/Ã‰coutes/g, "Écoutes"],
  [/Ã‰chelle/g, "Échelle"],
  [/Ã‰léments/g, "Éléments"],
  [/Ã‰lément/g, "Élément"],
  [/Ã‰tat de/g, "État de"],
  [/Ã‰loignement/g, "Éloignement"],
  [/Ã‰trangers/g, "Étrangers"],
  [/Ã‰lectronique/g, "Électronique"],
  [/REMET Ã€ ZÃ‰RO/g, "REMET À ZÉRO"],
  [/SUPPRIMÃ‰E/g, "SUPPRIMÉE"],
  [/\u00c3\u2030/g, "É"],
  [/IMMÃ‰DIATEMENT/g, "IMMÉDIATEMENT"],
  [/IMMÃ‰DIAT/g, "IMMÉDIAT"],
  [/IMMÃ‰DIATE/g, "IMMÉDIATE"],
  [/APPRÃ‰HENSION/g, "APPRÉHENSION"],
  [/ENQUÃŠTE/g, "ENQUÊTE"],
  [/OBSOLÃˆTE/g, "OBSOLÈTE"],
  [/ALTÃ‰RATION/g, "ALTÉRATION"],
  [/PRÃ‰MÃ‰DITATION/g, "PRÉMÉDITATION"],
  [/PÃ‰NÃ‰TRATION/g, "PÉNÉTRATION"],
  [/CONFIÃ‰/g, "CONFIÉ"],
  [/DÃ‰TOURNÃ‰/g, "DÉTOURNÉ"],
  [/PRÃ‰ALABLE/g, "PRÉALABLE"],
  [/IMPUNITÃ‰/g, "IMPUNITÉ"],
  [/DÃ‰LICTUEL/g, "DÉLICTUEL"],
  [/CONTRÃ”LES/g, "CONTRÔLES"],
  [/IDENTITÃ‰/g, "IDENTITÉ"],
  [/cÅ“ur/g, "cœur"],
  [/Ã‚ge/g, "Âge"],
  [/4Ã—24h/g, "4×24h"],
  [/6Ã—24h/g, "6×24h"],
  [/â‚¬/g, "€"],
  [/â€"/g, "—"],
  [/â€"/g, "–"],
  [/CONTRÃ”LES D'IDENTITÃ‰/g, "CONTRÔLES D'IDENTITÉ"],
];

for (const [a, b] of utf8fixes) t = t.replace(a, b);

fs.writeFileSync(dest, t, "utf8");
console.log("Written", dest, "chars", t.length);
