/**
 * Corrige mojibake restant dans procedures.js (UTF-8 mal interprété).
 */
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const dest = path.join(__dirname, "../js/data/procedures.js");
let t = fs.readFileSync(dest, "utf8");

const EMOJI_MANUAL = {
  "\u00f0\u0178\u0161\u201d": "🚨",
  "âš–ï¸": "⚖️",
  "ðŸ”’": "🔒",
  "ðŸ“‹": "📋",
  "ðŸ‘¥": "👥",
  "ðŸŽ’": "🎒",
  "ðŸ”": "🔍",
};

function fixEmojiField(s) {
  if (!s) return s;
  if (Object.prototype.hasOwnProperty.call(EMOJI_MANUAL, s)) return EMOJI_MANUAL[s];
  try {
    const b = iconv.encode(s, "cp1252");
    let out = b.toString("utf8");
    if (/\uFFFD/.test(out)) {
      out = out.replace(/\uFFFD/g, "");
    }
    return out;
  } catch {
    return s;
  }
}

t = t.replace(/\bem:'((?:\\.|[^'\\])*)'/g, (m, val) => {
  const u = val.replace(/\\(.)/g, "$1");
  return `em:'${fixEmojiField(u).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
});
t = t.replace(/"em": "((?:\\.|[^"\\])*)"/g, (m, val) => {
  const u = val.replace(/\\(.)/g, "$1");
  return `"em": "${fixEmojiField(u).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
});

/* ⚠️ (â + š + nbsp) */
t = t.replace(/\u00e2\u0161\u00a0/g, "⚠️");

const fixes = [
  [/DÃ‰LITS/g, "DÉLITS"],
  [/DÃ‰LIT/g, "DÉLIT"],
  [/DÃ‰FINITIVE/g, "DÉFINITIVE"],
  [/OBLIGÃ‰/g, "OBLIGÉ"],
  [/OBSOLÃˆTE/g, "OBSOLÈTE"],
  [/ALTÃ‰RATION/g, "ALTÉRATION"],
  [/IRRÃ‰SISTIBLE/g, "IRRÉSISTIBLE"],
  [/PROPORTIONNÃ‰E/g, "PROPORTIONNÉE"],
  [/NÃ‰CESSAIRE/g, "NÉCESSAIRE"],
  [/EXONÃ‰RATION/g, "EXONÉRATION"],
  [/ATTÃ‰NUATION/g, "ATTÉNUATION"],
  [/IMMÃ‰DIAT/g, "IMMÉDIAT"],
  [/IMMÃ‰DIATE/g, "IMMÉDIATE"],
  [/IRRÃ‰FRAGABLE/g, "IRRÉFRAGABLE"],
  [/Ã‰coutes/g, "Écoutes"],
  [/Ã‰tat/g, "État"],
  [/Ã‰mission/g, "Émission"],
  [/Ã‰tats/g, "États"],
  [/Ã‰changes/g, "Échanges"],
  [/Ã‰valuation/g, "Évaluation"],
  [/Ã‰crit/g, "Écrit"],
  [/Ã€ /g, "À "],
  [/Ã€'/g, "À'"],
  [/EXÃ‰CUTION/g, "EXÉCUTION"],
  [/AMÃ‰NAGEMENTS/g, "AMÉNAGEMENTS"],
  [/ARRÃŠT/g, "ARRÊT"],
  [/EUROPÃ‰EN/g, "EUROPÉEN"],
  [/CONTRÃ”LE/g, "CONTRÔLE"],
  [/cÅ“ur/g, "cœur"],
  [/â‚¬/g, "€"],
  [/â€¦/g, "…"],
  [/â€"/g, "—"],
  [/â€"/g, "–"],
];

for (const [a, b] of fixes) t = t.replace(a, b);

fs.writeFileSync(dest, t, "utf8");
console.log("Written", dest);
