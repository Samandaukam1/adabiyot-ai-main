/** Published Adiblar ensiklopediyasi entry returned by the public RPCs. */
export interface AdibEntry {
  id: string;
  fullName: string;
  penName: string | null;
  adabiyotxUsername: string | null;
  telegramUsername: string | null;
  photoUrl: string | null;
  coverUrl: string | null;
  roles: string[];
  shortDescription: string | null;
  biographyMarkdown: string | null;
  biographyHtml: string | null;
  birthDate: string | null;
  birthYear: string | null;
  birthPlace: string | null;
  nationality: string | null;
  profession: string | null;
  specialty: string | null;
  partyAffiliation: string | null;
  languages: string[];
  quickFacts: Record<string, unknown>;
  sections: Record<string, unknown>;
  socialLinks: Record<string, unknown>;
  publishedAt: string | null;
  sortOrder: number;
}

/** Loosely-typed raw row so we can defensively map varying view column names. */
type RawRow = Record<string, unknown>;

function str(row: RawRow, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function strList(row: RawRow, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = row[k];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    if (typeof v === "string" && v.trim()) {
      return v
        .split(/\n|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function object(row: RawRow, ...keys: string[]): Record<string, unknown> {
  for (const k of keys) {
    const value = row[k];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Keep the mapper tolerant of legacy non-JSON text values.
      }
    }
  }
  return {};
}

function number(row: RawRow, ...keys: string[]): number {
  for (const k of keys) {
    const value = row[k];
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function mapAdibEntry(row: RawRow): AdibEntry {
  return {
    id: str(row, "id", "adib_id", "slug") ?? "",
    fullName: str(row, "full_name", "name", "title") ?? "Noma'lum adib",
    penName: str(row, "pen_name", "penname", "taxallus", "alias"),
    adabiyotxUsername: str(row, "adabiyotx_username", "username"),
    telegramUsername: str(row, "telegram_username"),
    photoUrl: str(row, "photo_url", "avatar_url", "image_url", "photo", "avatar"),
    coverUrl: str(row, "cover_url"),
    roles: strList(row, "roles", "role_labels"),
    shortDescription: str(row, "short_description", "summary", "subtitle", "tagline"),
    biographyMarkdown: str(row, "biography_markdown", "biography", "bio"),
    biographyHtml: str(row, "biography_html"),
    birthDate: str(row, "birth_date"),
    birthYear: str(row, "birth_year", "born", "tugilgan_yil"),
    birthPlace: str(row, "birth_place"),
    nationality: str(row, "nationality"),
    profession: str(row, "profession"),
    specialty: str(row, "specialty"),
    partyAffiliation: str(row, "party_affiliation"),
    languages: strList(row, "languages"),
    quickFacts: object(row, "quick_facts"),
    sections: object(row, "sections"),
    socialLinks: object(row, "social_links"),
    publishedAt: str(row, "published_at"),
    sortOrder: number(row, "sort_order"),
  };
}

export type TopMaterialKind =
  | "book"
  | "poem"
  | "article"
  | "story"
  | "script"
  | "tale"
  | "guide"
  | "novel"
  | "monologue"
  | "reel"
  | "material";

export interface TopMaterial {
  id: string;
  title: string;
  authorName: string;
  cover: string | null;
  kind: TopMaterialKind;
  readsCount: number;
  likesCount: number;
  commentsCount: number;
  publishedAt: string | null;
}

const KIND_ALIASES: Record<string, TopMaterialKind> = {
  book: "book",
  kitob: "book",
  poem: "poem",
  sher: "poem",
  "she'r": "poem",
  article: "article",
  maqola: "article",
  story: "story",
  hikoya: "story",
  script: "script",
  screenplay: "script",
  ssenariy: "script",
  tale: "tale",
  ertak: "tale",
  guide: "guide",
  qollanma: "guide",
  novel: "novel",
  roman: "novel",
  monologue: "monologue",
  monolog: "monologue",
  reel: "reel",
};

export function normalizeKind(raw: string | null): TopMaterialKind {
  if (!raw) return "material";
  const key = raw.toLowerCase().replace(/['`]/g, "");
  return KIND_ALIASES[key] ?? "material";
}

function num(row: RawRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

export function mapTopMaterial(row: RawRow): TopMaterial {
  return {
    id: str(row, "id", "material_id", "content_id") ?? Math.random().toString(36).slice(2),
    title: str(row, "title", "name") ?? "Nomsiz material",
    authorName: str(row, "author", "author_name", "writer") ?? "Noma'lum muallif",
    cover: str(row, "cover_url", "cover", "image_url", "thumbnail_url", "thumbnail"),
    kind: normalizeKind(str(row, "content_type", "type", "material_type", "kind")),
    readsCount: num(row, "reads_count", "read_count", "views_count", "views"),
    likesCount: num(row, "likes_count", "like_count", "likes"),
    commentsCount: num(row, "comments_count", "comment_count", "comments"),
    publishedAt: str(row, "published_at", "created_at", "publish_date"),
  };
}

export const TOP_KIND_LABELS: Record<TopMaterialKind, string> = {
  book: "Kitob",
  poem: "She'r",
  article: "Maqola",
  story: "Hikoya",
  script: "Ssenariy",
  tale: "Ertak",
  guide: "Qo'llanma",
  novel: "Roman",
  monologue: "Monolog",
  reel: "Reel",
  material: "Material",
};
