/**
 * Uzbek-Latin text validation for the Maqollar Marafoni proverb form.
 *
 * Proverbs must be written 100% in the Uzbek Latin alphabet — no Cyrillic, no
 * mixed scripts, no other languages. These helpers are pure/deterministic.
 */

const CYRILLIC_RE = /[Ѐ-ӿ]/;
const LATIN_LETTER_RE = /[a-zA-Z]/;

// Allowed: Uzbek Latin letters (incl. o', g'), apostrophe variants, common
// punctuation, digits and whitespace.
const ALLOWED_RE =
  /^[a-zA-Z0-9\s.,!?;:()\-—«»"'’‘ʻʼ…]+$/u;

/** True if the text contains any Cyrillic character. */
export function hasCyrillic(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

/** True if the text contains at least one Latin letter. */
export function hasLatinLetter(text: string): boolean {
  return LATIN_LETTER_RE.test(text);
}

/**
 * True if, of all the letters in the text, the overwhelming majority are Latin
 * (so a stray accented letter is tolerated but a different-script word is not).
 */
export function isMostlyUzbekLatin(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;
  const latin = text.match(/[a-zA-Z]/g)?.length ?? 0;
  return latin / letters.length >= 0.85;
}

/**
 * Validate a proverb string. Returns an Uzbek error message, or null if valid.
 */
export function validateProverbLatin(text: string): string | null {
  const t = (text ?? "").trim();
  if (!t) return "Maqol matnini kiriting";
  if (t.replace(/\s+/g, " ").length < 8) return "Maqol juda qisqa. To'liqroq yozing.";

  const cyr = hasCyrillic(t);
  const lat = hasLatinLetter(t);

  if (cyr && lat) return "Maqolda lotin va kirill aralashib ketgan. Faqat lotin alifbosida yozing.";
  if (cyr) return "Maqol kirill alifbosida yozilgan. Iltimos, 100% o'zbek lotin alifbosida yozing.";
  if (!lat) return "Maqol o'zbek lotin alifbosida yozilishi kerak.";
  if (!isMostlyUzbekLatin(t)) return "Maqol o'zbek tilida yozilishi kerak.";
  // A lot of foreign symbols (not part of Uzbek Latin) → likely another script/lang.
  if (!ALLOWED_RE.test(t)) return "Maqol o'zbek tilida yozilishi kerak.";

  return null;
}
