/** Adib (writer) encyclopedia entry — maps to `mobile_adib_encyclopedia` view. */
export interface AdibEntry {
  id: string;
  fullName: string;
  penName: string | null;
  avatarUrl: string | null;
  shortDescription: string | null;
  biography: string | null;
  education: string | null;
  activity: string | null;
  worksSummary: string | null;
  achievements: string | null;
  quotes: string[];
  sources: string[];
  featured: boolean;
  birthYear: string | null;
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

export function mapAdibEntry(row: RawRow): AdibEntry {
  return {
    id: str(row, "id", "adib_id", "slug") ?? Math.random().toString(36).slice(2),
    fullName: str(row, "full_name", "name", "title") ?? "Noma'lum adib",
    penName: str(row, "pen_name", "penname", "taxallus", "alias"),
    avatarUrl: str(row, "avatar_url", "photo_url", "image_url", "photo", "avatar"),
    shortDescription: str(row, "short_description", "summary", "subtitle", "tagline"),
    biography: str(row, "biography", "bio", "life", "description"),
    education: str(row, "education", "studies"),
    activity: str(row, "activity", "career", "faoliyat"),
    worksSummary: str(row, "works_summary", "works", "asarlar"),
    achievements: str(row, "achievements", "awards", "yutuqlar"),
    quotes: strList(row, "quotes", "famous_quotes", "iqtiboslar"),
    sources: strList(row, "sources", "references", "manbalar"),
    featured: row["featured"] === true || row["is_featured"] === true,
    birthYear: str(row, "birth_year", "born", "tugilgan_yil"),
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
