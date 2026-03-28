/**
 * annales.js : pré-masque É (U+2030), emojis ; latin1→utf8 ; restauration.
 */
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const root = path.join(__dirname, "..");
const src = path.join(__dirname, "annales.github-raw.js.txt");
const dest = path.join(root, "js/data/annales.js");

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
  "â­": "⭐",
  "â­â­": "⭐⭐",
  "ðŸ‘®": "👮",
  "ðŸ‘®â€â™‚ï¸": "👮‍♂️",
  "ðŸŒŸ": "🌟",
  "ðŸ…": "🏅",
  "ðŸŽ–ï¸": "🎖️",
  "ðŸ†": "🏆",
  "ðŸ”’": "🔒",
  "ðŸ“¢": "📢",
  "ðŸ¤": "🤔",
  "ðŸ‘¨â€âš–ï¸": "👨‍⚖️",
  "ðŸ”Ž": "🔎",
  "ðŸ“±": "📱",
};

function fixEmojiField(s) {
  if (!s) return s;
  if (Object.prototype.hasOwnProperty.call(EMOJI_MANUAL, s)) return EMOJI_MANUAL[s];
  try {
    const b = iconv.encode(s, "cp1252");
    let out = b.toString("utf8");
    if (/\uFFFD/.test(out)) {
      out = out.replace(/\uFFFD/g, "");
      if (/^[\u2696\u2620\u26D3]$/.test(out) || out === "⚖" || out === "☠") out += "\uFE0F";
    }
    return out;
  } catch {
    return s;
  }
}

let t = fs.readFileSync(src, "utf8");
if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);

/* Faux « É » (Ã + ‰) : masque ASCII avant passage latin1 */
t = t.replace(/\u00c3\u2030/g, "__EACUTE_MJ__");

/* Tirets, ≥, ≠, → (UTF-8 vus comme caractères Windows-1252) */
t = t.replace(/\u00e2\u20ac\u201d/g, "__EMDASH__");
t = t.replace(/\u00e2\u20ac\u201c/g, "__ENDASH__");
t = t.replace(/\u00e2\u2030\u00a5/g, "__GE__");
t = t.replace(/\u00e2\u2030\u00a0/g, "__NE__");
t = t.replace(/\u00e2\u2020\u2019/g, "__RA__");
t = t.replace(/\u00c2\u00b7/g, "__MIDDOT__");

const restored = [];
t = t.replace(/\b(icon|em):'((?:\\.|[^'\\])*)'/g, (m, field, val) => {
  const unescaped = val.replace(/\\(.)/g, "$1");
  const fixed = fixEmojiField(unescaped);
  const id = restored.length;
  restored.push(fixed);
  return `${field}:'@@@E${id}@@@'`;
});

t = Buffer.from(t, "latin1").toString("utf8");

t = t.replace(/__EACUTE_MJ__/g, "É");
t = t.replace(/__EMDASH__/g, "\u2014");
t = t.replace(/__ENDASH__/g, "\u2013");
t = t.replace(/__GE__/g, "\u2265");
t = t.replace(/__NE__/g, "\u2260");
t = t.replace(/__RA__/g, "\u2192");
t = t.replace(/__MIDDOT__/g, "\u00b7");

restored.forEach((emoji, i) => {
  const esc = emoji.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  t = t.replace(`@@@E${i}@@@`, esc);
});

fs.writeFileSync(dest, t, "utf8");
console.log("Written", dest);
