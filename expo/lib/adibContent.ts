/**
 * Pure content helpers for an encyclopedia writer (adib) entry — shared by the
 * mobile detail screen and the premium web profile so both derive the exact
 * same facts, biography blocks and article sections from one place.
 */
import type { AdibEntry } from "@/types/community";

interface FactDefinition {
  label: string;
  quickKeys: string[];
  fallback: (adib: AdibEntry) => unknown;
}

const FACTS: FactDefinition[] = [
  { label: "Ismi", quickKeys: ["Ismi", "full_name", "name"], fallback: (a) => a.fullName },
  { label: "Taxallusi", quickKeys: ["Taxallusi", "pen_name", "penName"], fallback: (a) => a.penName },
  { label: "AdabiyotX taxallusi", quickKeys: ["AdabiyotX taxallusi", "adabiyotx_username"], fallback: (a) => (a.adabiyotxUsername ? `@${a.adabiyotxUsername.replace(/^@+/, "")}` : null) },
  { label: "Tug'ilgan sana", quickKeys: ["Tug'ilgan sana", "birth_date"], fallback: (a) => a.birthDate },
  { label: "Tug'ilgan yili", quickKeys: ["Tug'ilgan yili", "birth_year"], fallback: (a) => a.birthYear },
  { label: "Tug'ilgan joyi", quickKeys: ["Tug'ilgan joyi", "birth_place"], fallback: (a) => a.birthPlace },
  { label: "Mutaxassisligi", quickKeys: ["Mutaxassisligi", "specialty"], fallback: (a) => a.specialty },
  { label: "Kasbi", quickKeys: ["Kasbi", "profession"], fallback: (a) => a.profession },
  { label: "Millati", quickKeys: ["Millati", "nationality"], fallback: (a) => a.nationality },
  { label: "Partiyaviyligi", quickKeys: ["Partiyaviyligi", "party_affiliation"], fallback: (a) => a.partyAffiliation },
  { label: "Tillar bilishi", quickKeys: ["Tillar bilishi", "languages"], fallback: (a) => a.languages },
];

export const ARTICLE_SECTIONS: { key: string; title: string }[] = [
  { key: "early_life", title: "Erta hayoti va oilasi" },
  { key: "education", title: "Ta'limi" },
  { key: "activity", title: "Faoliyati" },
  { key: "achievements", title: "Yutuqlari" },
  { key: "creative_works", title: "Ijodiy ishlari yoki loyihalari" },
  { key: "values", title: "Qarashlari va qadriyatlari" },
  { key: "future_plans", title: "Kelajakdagi rejalari" },
  { key: "additional", title: "Qo'shimcha ma'lumot" },
];

export interface AdibFact {
  label: string;
  value: string;
}

export type AdibBiographyBlock = { kind: "heading"; text: string } | { kind: "text"; text: string };

export interface AdibArticleSection {
  key: string;
  title: string;
  paragraphs: string[];
}

function normalizeFactKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[''ʻʼ`]/g, "'");
}

export function displayValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items.join(" | ") : null;
  }
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

export function factsFor(adib: AdibEntry): AdibFact[] {
  const quickFacts = new Map(
    Object.entries(adib.quickFacts).map(([key, value]) => [normalizeFactKey(key), value])
  );

  return FACTS.flatMap((definition) => {
    const quickValue = definition.quickKeys
      .map((key) => quickFacts.get(normalizeFactKey(key)))
      .find((value) => displayValue(value) != null);
    const value = displayValue(quickValue) ?? displayValue(definition.fallback(adib));
    return value ? [{ label: definition.label, value }] : [];
  });
}

function decodeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };
  return text.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (match) => entities[match] ?? match);
}

function htmlToReadableText(html: string): string {
  return decodeHtml(
    html
      .replace(/<h[1-6][^>]*>/gi, "\n## ")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(li|p|div|section|article)>/gi, "\n\n")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Biography split into heading / paragraph blocks, markdown emphasis stripped. */
export function biographyBlocks(adib: AdibEntry): AdibBiographyBlock[] {
  const source = adib.biographyHtml
    ? htmlToReadableText(adib.biographyHtml)
    : adib.biographyMarkdown?.trim() || adib.shortDescription?.trim() || "";
  if (!source) return [];

  return source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map<AdibBiographyBlock>((block) => {
      const heading = block.match(/^#{1,6}\s+(.+)$/s);
      if (heading) return { kind: "heading", text: heading[1] };
      const cleaned = block
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      return { kind: "text", text: cleaned };
    });
}

function sectionParagraphs(value: unknown): string[] {
  const text = displayValue(value);
  if (!text) return [];
  return text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
}

/** The long-form article sections that actually have content, in order. */
export function articleSectionsFor(adib: AdibEntry): AdibArticleSection[] {
  const normalized = new Map(
    Object.entries(adib.sections).map(([key, value]) => [key.trim().toLowerCase(), value])
  );
  return ARTICLE_SECTIONS.flatMap((item) => {
    const paragraphs = sectionParagraphs(normalized.get(item.key));
    return paragraphs.length ? [{ ...item, paragraphs }] : [];
  });
}
