// Name search over the CORE university registry: any language, script or abbreviation.
// Pure functions, no I/O — runs the same in Deno (Supabase) and Node (tests, local server).

const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // Uzbek, Kazakh, Kyrgyz, Tajik letters
  ў: "o", қ: "k", ғ: "g", ҳ: "h", ә: "a", ө: "o", ү: "u", ұ: "u", і: "i", ң: "n", һ: "h",
  ӣ: "i", ӯ: "u", ҷ: "j", ҫ: "s",
};

/** Lowercase, drop diacritics and apostrophes (O‘zbekiston → ozbekiston), keep letters/digits. */
export function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻʼ'’‘`´"«»“”]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Latin skeleton: transliterate Cyrillic and fold spelling variants (Samarqand = Самарканд). */
export function skel(s) {
  let out = "";
  for (const ch of norm(s)) out += CYR[ch] ?? ch;
  return out
    .replace(/kh|x/g, "h")
    .replace(/q/g, "k")
    .replace(/w/g, "v")
    .replace(/yo|yu|ya|ye/g, (m) => m[1])
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1");
}

export function hasCyrillic(s) {
  return /[Ѐ-ӿ]/.test(String(s ?? ""));
}

/** Plain Cyrillic → Latin transliteration for people's names (Алексеев → Alekseev). */
export function translit(s) {
  let out = "";
  for (const ch of String(s ?? "")) {
    const low = ch.toLowerCase();
    const t = CYR[low];
    if (t === undefined) out += ch;
    else out += ch === low ? t : t.charAt(0).toUpperCase() + t.slice(1);
  }
  return out;
}

// Words that do not form abbreviations, and the "named after …" tails that are dropped first.
const SKIP = new Set(["и", "of", "the", "and", "in", "at", "for", "va", "da", "де", "le", "la"]);
const NAMED = /\s(имени|им|named|ба номи)\s.*$/;
const NAMED_PREFIX = /^.*\s(nomidagi|номидаги|атындағы|атындагы)\s/;

/** Abbreviations generated from a name: СГУ, СамГУ, SamDU, NUU, TDTU … (normalized, no spaces). */
export function abbreviations(name) {
  const out = new Set();
  let n = " " + norm(name) + " ";
  n = n.replace(NAMED, " ").replace(NAMED_PREFIX, " ").trim();
  const words = n.split(" ").filter((w) => w && !SKIP.has(w));
  if (words.length < 2) return [];
  const initials = words.map((w) => w[0]).join("");
  out.add(initials);
  // Soviet/Uzbek style: first syllable of the place + initials of the rest (СамГУ, ТашГТУ, KazNU).
  for (const len of [3, 4]) {
    if (words[0].length > len) out.add(words[0].slice(0, len) + words.slice(1).map((w) => w[0]).join(""));
  }
  return [...out].filter((a) => a.length >= 2);
}

const COUNTRY = {
  UZ: ["uzbekistan", "узбекистан", "ozbekiston", "uz"],
  KZ: ["kazakhstan", "казахстан", "kazakstan", "kz"],
  KG: ["kyrgyzstan", "киргизия", "кыргызстан", "kyrgyz", "kg"],
  TJ: ["tajikistan", "таджикистан", "tojikiston", "tj"],
};

export function countryCode(q) {
  if (!q) return null;
  const s = norm(q);
  for (const [code, names] of Object.entries(COUNTRY)) if (names.includes(s)) return code;
  return null;
}

/** Build an in-memory index from the public registry plus extra names and curated aliases. */
export function buildIndex(universities, extraNames = {}, curated = {}) {
  return universities.map((u) => {
    const extra = extraNames[u.id] || {};
    const names = new Set(
      [u.name, u.name_national, u.name_ru, u.name_en, ...Object.values(extra.names || {}), ...(extra.aliases || [])]
        .filter(Boolean),
    );
    const acronyms = new Set(
      [...String(u.acronyms || "").split(";"), ...(extra.acronyms || []), ...(curated[u.id] || [])]
        .map((a) => a.trim())
        .filter(Boolean),
    );
    const generated = new Set();
    for (const nm of names) for (const a of abbreviations(nm)) generated.add(a);
    const exactAcr = new Set([...acronyms].map((a) => norm(a).replace(/ /g, "")));
    const nameNorms = [...names].map(norm);
    const nameSkels = [...names].map(skel);
    // Curated aliases that are words ("Назарбаев университет") also count as names.
    for (const a of acronyms) if (a.includes(" ")) { nameNorms.push(norm(a)); nameSkels.push(skel(a)); }
    return {
      u,
      names: [...names],
      acronyms: [...acronyms],
      exactAcr,
      genAcr: generated,
      nameNorms,
      nameSkels,
      tokens: new Set(nameSkels.join(" ").split(" ").filter(Boolean)),
      city: skel(u.city),
      ids: [u.id, u.ror, u.wikidata, u.openalex].filter(Boolean).map((x) => String(x).toLowerCase()),
      domains: (extra.domains || [u.website]).filter(Boolean).map((d) => String(d).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")),
      popularity: u.works_count || 0,
    };
  });
}

// Colloquial Russian/Uzbek short forms expanded before word matching.
const W = (src) => new RegExp(`(?<![\\p{L}])(?:${src})(?![\\p{L}])`, "gu"); // \b does not see Cyrillic letters
const EXPAND = [
  [W("госуниверситет\\p{L}*"), "государственный университет"],
  [W("гос"), "государственный"],
  [W("мед"), "медицинский"],
  [W("пед"), "педагогический"],
  [W("уни|uni|univer\\p{L}*"), "university"],
];
function expand(n) {
  let s = " " + n + " ";
  for (const [re, to] of EXPAND) s = s.replace(re, to);
  return s.trim();
}

/** Score one entry against a query. Returns {score, why} or null. */
function scoreEntry(e, q) {
  const raw = q.trim().toLowerCase().replace(/^https?:\/\/(www\.)?(ror\.org\/|openalex\.org\/|wikidata\.org\/wiki\/)?/, "");
  if (e.ids.includes(raw)) return { score: 1000, why: "id" };
  if (e.domains.some((d) => d && (raw === d || raw.replace(/\/.*$/, "") === d))) return { score: 950, why: "website" };
  const n = norm(q);
  const compact = n.replace(/ /g, "");
  if (!n) return null;
  if (e.exactAcr.has(compact)) return { score: 900, why: "abbreviation" };
  if (e.genAcr.has(compact) && compact.length >= 3) return { score: 850, why: "abbreviation (generated)" };
  if (e.nameNorms.includes(n)) return { score: 800, why: "exact name" };
  const s = skel(q);
  if (e.nameSkels.includes(s)) return { score: 790, why: "exact name (transliterated)" };
  if (e.nameSkels.some((x) => x.startsWith(s + " ") || x.startsWith(s))) return { score: 600, why: "name prefix" };
  // Token match: every query token is a prefix of some name token (or the city).
  const qt = skel(expand(n)).split(" ").filter((t) => t.length >= 2);
  if (!qt.length) return null;
  const stems = qt.map((t) => (t.length > 5 ? t.slice(0, Math.max(5, t.length - 3)) : t)); // самаркандский ~ samarkand
  let hit = 0;
  for (const st of stems) if ([...e.tokens].some((w) => w.startsWith(st)) || (e.city && e.city.startsWith(st))) hit++;
  if (!hit) return null;
  const frac = hit / qt.length;
  if (frac < 0.5) return null;
  // Prefer names with few extra words: "Самаркандский госуниверситет" → СамГУ, not its institutes.
  let cover = 0;
  for (const nm of e.nameSkels) {
    const words = nm.split(" ").filter(Boolean);
    const matched = words.filter((w) => stems.some((st) => w.startsWith(st))).length;
    cover = Math.max(cover, matched / words.length);
  }
  return { score: Math.round(200 + 300 * frac + 80 * cover), why: frac === 1 ? "all words" : "some words" };
}

/** Search the index. Options: country (code or name), city, limit. */
export function searchUniversities(index, query, { country, city, limit = 10 } = {}) {
  const cc = country ? countryCode(country) || String(country).toUpperCase() : null;
  const cs = city ? skel(city) : null;
  const hits = [];
  for (const e of index) {
    if (cc && e.u.country !== cc) continue;
    if (cs && !(e.city && (e.city.startsWith(cs) || cs.startsWith(e.city)))) continue;
    const r = query && query.trim() ? scoreEntry(e, query) : { score: 100, why: "filter" };
    if (r) hits.push({ e, ...r });
  }
  // Among equal match quality the bigger research university comes first (СамГУ before branches).
  hits.sort((a, b) => b.score - a.score || b.e.popularity - a.e.popularity);
  return hits.slice(0, limit);
}
