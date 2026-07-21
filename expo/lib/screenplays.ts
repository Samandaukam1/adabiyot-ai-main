import { supabase } from "@/lib/supabase";

/**
 * Real Supabase data layer for the Ssenariylar section.
 *
 * Source of truth:
 *   screenplays
 *   screenplay_blocks
 *   screenplay_characters
 *   screenplay_scenes
 *   screenplay_musics
 *   screenplay_gallery
 *   screenplay_reads
 *
 * The readers stay defensive because some deployments still have older table or
 * column names. Parsed blocks are preferred; raw script text is parsed only as a
 * last resort.
 */

export type ScreenplayBlockKind =
  | "act"
  | "section"
  | "heading"
  | "paragraph"
  | "dialogue"
  | "action"
  | "note"
  | "image"
  | "divider";

export type ScreenplayLineType =
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition";

export interface ScreenplayReference {
  id: string;
  type: "character" | "scene" | "music";
  title: string;
  targetId: string | null;
  audioUrl?: string | null;
}

export interface ScreenplayContentBlock {
  id: string;
  type: ScreenplayBlockKind;
  title: string | null;
  anchorId: string | null;
  text: string;
  raw: string;
  displayText: string;
  character: string | null;
  imageUrl: string | null;
  caption: string | null;
  characterRefs: string[];
  sceneRefs: string[];
  musicRefs: string[];
  refs: ScreenplayReference[];
  sortOrder: number;
}

export interface ScreenplayTocItem {
  id: string;
  title: string;
  anchorId: string;
  level: 1 | 2;
  sortOrder: number;
}

export interface ScreenplayLineBlock {
  id: string;
  type: ScreenplayLineType;
  text: string;
}

export interface ScreenplaySceneBlock {
  id: string;
  number: number;
  intExt: string;
  location: string;
  time: string;
  title: string;
  heading: string;
  description: string;
  requirements: string;
  imageUrl: string | null;
  lines: ScreenplayLineBlock[];
}

export interface ScreenplayCharacter {
  id: string;
  name: string;
  role: string;
  age: string;
  description: string;
  actingNote: string;
  imageUrl: string | null;
}

export interface ScreenplayMusicTrack {
  id: string;
  title: string;
  description: string;
  mood: string;
  audioUrl: string | null;
  durationLabel: string;
  usagePlace: string;
}

export interface ScreenplayGalleryImage {
  id: string;
  url: string;
  caption: string;
}

export interface DisplayScreenplay {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorId: string | null;
  genre: string;
  description: string;
  shortDescription: string;
  coverUrl: string | null;
  bannerUrl: string | null;
  ageRating: string;
  durationLabel: string;
  readCount: number;
  price: number;
  isFree: boolean;
  requiresPurchase: boolean;
  publishedAt: string;
  blocks: ScreenplayContentBlock[];
  toc: ScreenplayTocItem[];
  scenes: ScreenplaySceneBlock[];
  characters: ScreenplayCharacter[];
  music: ScreenplayMusicTrack[];
  gallery: ScreenplayGalleryImage[];
  fallbackBody: string;
}

export interface ScreenplayCard {
  id: string;
  slug: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  coverUrl: string | null;
  ageRating: string;
  readCount: number;
  price: number;
  isFree: boolean;
}

const db = supabase as any;
const IMAGE_MARKER_RE = /^\[IMAGE:([^|\]]*)\|([^|\]]*)\|([^\]]*)\]$/;
const UPPER_RE = /^[A-ZÀ-ÖØ-ÞА-ЯЎҚҒҲ0-9 .,'’#\-]+$/u;

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes" || v === "paid";
  }
  return false;
}

function arr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => str(x)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((x) => str(x)).filter(Boolean);
    } catch {
      return value.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

function obj(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function firstStr(row: Record<string, any>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const v = str(row?.[key]);
    if (v) return v;
  }
  return fallback;
}

function pickAuthorName(row: Record<string, any>): string {
  const joined = row?.authors?.full_name ?? row?.author?.full_name;
  return str(joined) || firstStr(row, ["author_name", "author", "creator_name"], "AdabiyotX");
}

function readCountOf(row: Record<string, any>): number {
  return num(row?.reads_count ?? row?.read_count ?? row?.views_count, 0);
}

function priceOf(row: Record<string, any>): { price: number; isFree: boolean; requiresPurchase: boolean } {
  const price = num(row?.price_uzs ?? row?.price ?? row?.amount_uzs, 0);
  const paidFlag =
    bool(row?.is_paid) ||
    bool(row?.is_premium) ||
    bool(row?.requires_payment) ||
    bool(row?.requires_purchase);
  const freeFlag = bool(row?.is_free) || bool(row?.free);
  const requiresPurchase = paidFlag || price > 0;
  return { price, isFree: freeFlag || !requiresPurchase, requiresPurchase };
}

function durationLabelOf(row: Record<string, any>): string {
  const minutes = num(row?.estimated_duration_minutes ?? row?.reading_time_minutes ?? row?.duration_minutes, 0);
  if (minutes <= 0) return "";
  return `${minutes} daqiqa`;
}

function formatSeconds(seconds: number): string {
  if (seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "bolim";
}

function uniqueAnchor(title: string, used: Set<string>): string {
  const base = slug(title);
  let next = base;
  let i = 2;
  while (used.has(next)) {
    next = `${base}-${i}`;
    i += 1;
  }
  used.add(next);
  return next;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkers(text: string): string {
  return text
    .replace(/%%%\s*/g, "")
    .replace(/\^\^\^\s*/g, "")
    .replace(/@@@\s*/g, "")
    .replace(/\$\$\$\s*/g, "")
    .replace(/}}}\s*/g, "")
    .replace(/\(\(\(\s*/g, "")
    .replace(/\)\)\)\s*/g, "")
    .trim();
}

function hasLower(text: string): boolean {
  return /[a-zà-öø-þа-яёўқғҳ]/u.test(text);
}

function classifyLine(raw: string): ScreenplayLineType {
  const line = raw.trim();
  if (!line) return "action";
  if (/^\(.*\)$/.test(line)) return "parenthetical";
  if (/(:|TO\.|OUT\.|IN\.)\s*$/.test(line) && !hasLower(line) && line.length <= 40) {
    return "transition";
  }
  if (line.length <= 40 && !hasLower(line) && UPPER_RE.test(line) && !/[.?!]$/.test(line)) {
    return "character";
  }
  return "action";
}

function parseSceneText(text: string, sceneId: string): ScreenplayLineBlock[] {
  const blocks: ScreenplayLineBlock[] = [];
  const lines = text.split(/\r?\n/);
  let expectDialogue = false;
  let index = 0;

  for (const rawLine of lines) {
    const line = stripMarkers(rawLine);
    if (!line) {
      expectDialogue = false;
      continue;
    }
    let type = classifyLine(line);
    if (type === "action" && expectDialogue) type = "dialogue";
    expectDialogue = type === "character" || type === "parenthetical" || type === "dialogue";
    blocks.push({ id: `${sceneId}-l${index}`, type, text: line });
    index += 1;
  }
  return blocks;
}

function dialogueParts(text: string): { character: string; text: string } | null {
  const m = text.match(/^([^\n:]{1,40}):\s*(.+)$/);
  if (!m) return null;
  const speaker = m[1].trim();
  if (!speaker || /[.!?]$/.test(speaker) || speaker.split(/\s+/).length > 4) return null;
  if (speaker[0] !== speaker[0].toUpperCase()) return null;
  return { character: stripMarkers(speaker), text: stripMarkers(m[2]) };
}

function italicInner(text: string): string | null {
  const m = text.trim().match(/^\*(.+)\*$/);
  return m ? m[1].trim() : null;
}

function blockType(value: unknown): ScreenplayBlockKind {
  const v = str(value).toLowerCase();
  if (
    v === "act" ||
    v === "section" ||
    v === "heading" ||
    v === "paragraph" ||
    v === "dialogue" ||
    v === "action" ||
    v === "note" ||
    v === "image" ||
    v === "divider"
  ) {
    return v;
  }
  return "paragraph";
}

function mapCard(row: Record<string, any>): ScreenplayCard {
  const { price, isFree } = priceOf(row);
  const description = firstStr(row, ["short_description", "description", "excerpt", "summary"]);
  return {
    id: str(row.id),
    slug: firstStr(row, ["slug"], str(row.id)),
    title: firstStr(row, ["title"], "Ssenariy"),
    author: pickAuthorName(row),
    genre: firstStr(row, ["genre", "screenplay_category", "category"], "Ssenariy"),
    description,
    coverUrl: firstStr(row, ["cover_url", "poster_url", "banner_url", "image_url"]) || null,
    ageRating: firstStr(row, ["age_rating"]),
    readCount: readCountOf(row),
    price,
    isFree,
  };
}

function mapScene(row: Record<string, any>, fallbackIndex: number): ScreenplaySceneBlock {
  const id = str(row.id) || `scene-${fallbackIndex}`;
  const number = num(row.scene_number ?? row.scene_order ?? row.sort_order, fallbackIndex) + (row.scene_number ? 0 : 1);
  const intExt = firstStr(row, ["int_ext"], "").toUpperCase();
  const location = firstStr(row, ["location"]);
  const time = firstStr(row, ["time", "time_of_day"]);
  const title = firstStr(row, ["title"], `${number}-sahna`);
  const slugParts = [intExt, location, time].filter(Boolean).join(". ");
  const heading = slugParts ? `${number}-SAHNA · ${slugParts}` : `${number}-SAHNA`;
  const description = firstStr(row, ["description", "scene_text", "text", "body", "content"]);
  return {
    id,
    number,
    intExt,
    location,
    time,
    title,
    heading,
    description: stripMarkers(description),
    requirements: firstStr(row, ["requirements"]),
    imageUrl: firstStr(row, ["image_url", "square_image_url", "cover_url"]) || null,
    lines: description ? parseSceneText(description, id) : [],
  };
}

function mapCharacter(row: Record<string, any>, index: number): ScreenplayCharacter {
  return {
    id: str(row.id) || `char-${index}`,
    name: firstStr(row, ["name"], "Qahramon"),
    role: firstStr(row, ["role"]),
    age: firstStr(row, ["age"]),
    description: firstStr(row, ["description"]),
    actingNote: firstStr(row, ["acting_note", "actor_name"]),
    imageUrl: firstStr(row, ["image_url", "avatar_url", "photo_url"]) || null,
  };
}

function mapMusic(row: Record<string, any>, index: number): ScreenplayMusicTrack {
  return {
    id: str(row.id) || `music-${index}`,
    title: firstStr(row, ["title"], "Fon musiqasi"),
    description: firstStr(row, ["description"]),
    mood: firstStr(row, ["mood"]),
    audioUrl: firstStr(row, ["audio_url", "url", "music_url"]) || null,
    durationLabel: formatSeconds(num(row.duration_seconds, 0)),
    usagePlace: firstStr(row, ["usage_place"]),
  };
}

function mapGallery(row: Record<string, any>, index: number): ScreenplayGalleryImage | null {
  const url = firstStr(row, ["image_url", "url", "photo_url"]);
  if (!url) return null;
  return {
    id: str(row.id) || `gallery-${index}`,
    url,
    caption: firstStr(row, ["caption", "title", "alt"]),
  };
}

function mapBlock(row: Record<string, any>, index: number): ScreenplayContentBlock {
  const content = obj(row.content);
  const type = blockType(row.type);
  const raw =
    firstStr(content, ["raw"]) ||
    firstStr(row, ["raw", "raw_text", "body", "text", "content"]) ||
    firstStr(content, ["text", "displayText", "display_text"]);
  const text =
    firstStr(content, ["text"]) ||
    firstStr(row, ["text", "body"]) ||
    (typeof row.content === "string" ? row.content : "");
  const displayText =
    firstStr(content, ["displayText", "display_text"]) ||
    firstStr(row, ["display_text"]) ||
    stripMarkers(text || raw);
  const imageUrl = firstStr(content, ["url", "image_url"]) || firstStr(row, ["image_url"]) || null;
  return {
    id: str(row.id) || `block-${index}`,
    type,
    title: firstStr(row, ["title"]) || firstStr(content, ["title"]) || null,
    anchorId: firstStr(row, ["anchor_id", "anchorId"]) || null,
    text: stripMarkers(text || displayText),
    raw,
    displayText: stripMarkers(displayText || text || raw),
    character: firstStr(content, ["character"]) || firstStr(row, ["character"]) || null,
    imageUrl,
    caption: firstStr(content, ["caption"]) || firstStr(row, ["caption"]) || null,
    characterRefs: arr(row.character_refs).concat(arr(content?.references?.characters)),
    sceneRefs: arr(row.scene_refs).concat(arr(content?.references?.scenes)),
    musicRefs: arr(row.music_refs).concat(arr(content?.references?.musics)),
    refs: [],
    sortOrder: num(row.sort_order, index),
  };
}

function makeParsedBlock(
  type: ScreenplayBlockKind,
  text: string,
  raw: string,
  sortOrder: number,
  opts: Partial<ScreenplayContentBlock> = {}
): ScreenplayContentBlock {
  return {
    id: opts.id ?? `parsed-block-${sortOrder}`,
    type,
    title: opts.title ?? null,
    anchorId: opts.anchorId ?? null,
    text: stripMarkers(text),
    raw,
    displayText: stripMarkers(opts.displayText ?? text),
    character: opts.character ?? null,
    imageUrl: opts.imageUrl ?? null,
    caption: opts.caption ?? null,
    characterRefs: opts.characterRefs ?? [],
    sceneRefs: opts.sceneRefs ?? [],
    musicRefs: opts.musicRefs ?? [],
    refs: [],
    sortOrder,
  };
}

function parseRawScreenplay(raw: string): {
  title: string;
  description: string;
  blocks: ScreenplayContentBlock[];
  toc: ScreenplayTocItem[];
  characters: ScreenplayCharacter[];
  scenes: ScreenplaySceneBlock[];
  music: ScreenplayMusicTrack[];
} {
  const lines = raw.split(/\r?\n/);
  const anchors = new Set<string>();
  const blocks: ScreenplayContentBlock[] = [];
  const toc: ScreenplayTocItem[] = [];
  const characters: ScreenplayCharacter[] = [];
  const scenes: ScreenplaySceneBlock[] = [];
  const music: ScreenplayMusicTrack[] = [];
  let title = "";
  let description = "";
  let section: "characters" | "scenes" | "musics" | null = null;
  let itemKind: "char" | "scene" | "music" | null = null;
  let itemHead = "";
  let itemLines: string[] = [];
  let para: string[] = [];
  let sortOrder = 0;

  const flushParagraph = () => {
    const text = para.join("\n").trim();
    para = [];
    if (!text) return;
    for (const part of text.split(/\n[ \t]*\n+/).map((p) => p.trim()).filter(Boolean)) {
      const img = part.match(IMAGE_MARKER_RE);
      if (img) {
        blocks.push(makeParsedBlock("image", "", part, sortOrder++, {
          imageUrl: img[1] || null,
          caption: img[2] || null,
        }));
        continue;
      }
      const inner = italicInner(part);
      if (inner) {
        blocks.push(makeParsedBlock("note", inner, part, sortOrder++));
        continue;
      }
      const dlg = dialogueParts(part);
      if (dlg) {
        blocks.push(makeParsedBlock("dialogue", dlg.text, part, sortOrder++, { character: dlg.character }));
        continue;
      }
      if (part === "---" || part === "***" || part === "---") {
        blocks.push(makeParsedBlock("divider", "", part, sortOrder++));
        continue;
      }
      blocks.push(makeParsedBlock("paragraph", part, part, sortOrder++));
    }
  };

  const flushItem = () => {
    if (!itemKind) return;
    const body = itemLines.join("\n").trim();
    if (itemKind === "char") {
      characters.push({
        id: `parsed-char-${characters.length}`,
        name: stripMarkers(itemHead),
        role: "",
        age: "",
        description: stripMarkers(body),
        actingNote: "",
        imageUrl: null,
      });
    } else if (itemKind === "scene") {
      const reqs: string[] = [];
      const desc: string[] = [];
      for (const line of itemLines) {
        const inner = italicInner(line);
        if (inner) reqs.push(inner);
        else desc.push(line);
      }
      const number = scenes.length + 1;
      const id = `parsed-scene-${scenes.length}`;
      scenes.push({
        id,
        number,
        intExt: "",
        location: "",
        time: "",
        title: stripMarkers(itemHead),
        heading: `${number}-SAHNA`,
        description: stripMarkers(desc.join("\n")),
        requirements: reqs.join("\n").trim(),
        imageUrl: null,
        lines: [],
      });
    } else {
      music.push({
        id: `parsed-music-${music.length}`,
        title: stripMarkers(itemHead),
        description: stripMarkers(body),
        mood: "",
        audioUrl: null,
        durationLabel: "",
        usagePlace: "",
      });
    }
    itemKind = null;
    itemHead = "";
    itemLines = [];
  };

  const closeContexts = () => {
    flushParagraph();
    flushItem();
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("%%%")) {
      closeContexts();
      section = null;
      const rest = stripMarkers(t.slice(3));
      if (!title) title = rest;
      else {
        const anchorId = uniqueAnchor(rest || "parda", anchors);
        const id = `parsed-toc-${sortOrder}`;
        blocks.push(makeParsedBlock("act", rest, line, sortOrder, { id, title: rest, anchorId }));
        toc.push({ id, title: rest, anchorId, level: 1, sortOrder });
        sortOrder += 1;
      }
      continue;
    }
    if (t.startsWith("^^^")) {
      closeContexts();
      section = null;
      const rest = stripMarkers(t.slice(3));
      if (title && !description) description = rest;
      else {
        const anchorId = uniqueAnchor(rest || "sahna", anchors);
        const id = `parsed-toc-${sortOrder}`;
        blocks.push(makeParsedBlock("section", rest, line, sortOrder, { id, title: rest, anchorId }));
        toc.push({ id, title: rest, anchorId, level: 2, sortOrder });
        sortOrder += 1;
      }
      continue;
    }
    if (t.startsWith("@@@")) {
      closeContexts();
      section = "characters";
      continue;
    }
    if (t.startsWith("$$$")) {
      closeContexts();
      section = "scenes";
      continue;
    }
    if (t.startsWith("}}}")) {
      closeContexts();
      section = "musics";
      continue;
    }
    if (section === "characters" && t.startsWith("(((")) {
      flushItem();
      itemKind = "char";
      itemHead = t.slice(3).trim();
      continue;
    }
    if (section === "scenes" && t.startsWith(")))")) {
      flushItem();
      itemKind = "scene";
      itemHead = t.slice(3).trim();
      continue;
    }
    if (section === "musics" && t.startsWith(")))")) {
      flushItem();
      itemKind = "music";
      itemHead = t.slice(3).trim();
      continue;
    }
    if (section && itemKind) {
      itemLines.push(line);
      continue;
    }
    if (section === "musics" && t) {
      flushItem();
      itemKind = "music";
      itemHead = t;
      continue;
    }
    if (section && !t) {
      flushItem();
      continue;
    }
    if (section) continue;
    para.push(line);
  }

  closeContexts();
  return { title, description, blocks, toc, characters, scenes, music };
}

function resolveReferences(
  blocks: ScreenplayContentBlock[],
  characters: ScreenplayCharacter[],
  scenes: ScreenplaySceneBlock[],
  music: ScreenplayMusicTrack[]
): ScreenplayContentBlock[] {
  const charMap = new Map(characters.map((c) => [c.name.toLowerCase(), c]));
  const sceneMap = new Map(scenes.map((s) => [s.title.toLowerCase(), s]));
  const musicMap = new Map(music.map((m) => [m.title.toLowerCase(), m]));

  return blocks.map((block) => {
    const raw = block.raw || block.text;
    const displayText = stripMarkers(block.displayText || block.text || raw);
    const characterRefs = new Set(block.characterRefs);
    const sceneRefs = new Set(block.sceneRefs);
    const musicRefs = new Set(block.musicRefs);

    for (const m of raw.matchAll(/\(\(\(\s*([^\n.,!?;:()]+)/g)) {
      const name = stripMarkers(m[1]);
      if (name) characterRefs.add(name);
    }
    for (const m of raw.matchAll(/\)\)\)\s*([^\n.,!?;:()]+)/g)) {
      const name = stripMarkers(m[1]);
      if (name) sceneRefs.add(name);
    }
    for (const character of characters) {
      if (character.name && new RegExp(`\\b${escapeRe(character.name)}\\b`, "i").test(displayText)) {
        characterRefs.add(character.name);
      }
    }
    for (const scene of scenes) {
      if (scene.title && new RegExp(`\\b${escapeRe(scene.title)}\\b`, "i").test(displayText)) {
        sceneRefs.add(scene.title);
      }
    }
    for (const track of music) {
      if (track.title && new RegExp(`\\b${escapeRe(track.title)}\\b`, "i").test(displayText)) {
        musicRefs.add(track.title);
      }
    }

    const refs: ScreenplayReference[] = [];
    for (const title of characterRefs) {
      const target = charMap.get(title.toLowerCase()) ?? null;
      refs.push({ id: `char:${title}`, type: "character", title, targetId: target?.id ?? null });
    }
    for (const title of sceneRefs) {
      const target = sceneMap.get(title.toLowerCase()) ?? null;
      refs.push({ id: `scene:${title}`, type: "scene", title, targetId: target?.id ?? null });
    }
    for (const title of musicRefs) {
      const target = musicMap.get(title.toLowerCase()) ?? null;
      refs.push({ id: `music:${title}`, type: "music", title, targetId: target?.id ?? null, audioUrl: target?.audioUrl ?? null });
    }

    return {
      ...block,
      displayText,
      text: stripMarkers(block.text || displayText),
      characterRefs: Array.from(characterRefs),
      sceneRefs: Array.from(sceneRefs),
      musicRefs: Array.from(musicRefs),
      refs,
    };
  });
}

const SELECT_WITH_AUTHOR = "*, authors(full_name)";
const PUBLISHED_SCREENPLAYS_LIMIT = 120;

async function selectScreenplays(build: (q: any) => any): Promise<any[]> {
  const withJoin = await build(db.from("screenplays").select(SELECT_WITH_AUTHOR));
  if (!withJoin.error && Array.isArray(withJoin.data)) return withJoin.data;
  const plain = await build(db.from("screenplays").select("*"));
  if (!plain.error && Array.isArray(plain.data)) return plain.data;
  if (__DEV__ && plain.error) {
    console.warn("[screenplays] query error:", plain.error.message ?? plain.error);
  }
  return [];
}

/**
 * Try `status = 'published'` ordered by the given column. Returns null when the
 * query itself errors (e.g. the order column is missing) so the caller can fall
 * through — never throws, never poisons the request with a nonexistent column.
 */
async function queryPublished(orderCol: string): Promise<any[] | null> {
  const res = await db
    .from("screenplays")
    .select("*")
    .eq("status", "published")
    .order(orderCol, { ascending: false })
    .limit(PUBLISHED_SCREENPLAYS_LIMIT);
  if (res.error) {
    if (__DEV__) console.log(`[WebScreenplays] status/${orderCol} error:`, res.error?.message ?? res.error);
    return null;
  }
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchPublishedScreenplays(): Promise<ScreenplayCard[]> {
  if (__DEV__) console.log("[WebScreenplays] fetching...");

  // Primary path: status='published'. The old `.or(status,is_published)` 400'd
  // because `is_published` does not exist on the table — which silently emptied
  // the whole section. We query the real `status` column and only client-filter
  // in the last-resort fallback.
  let rows = await queryPublished("published_at");
  if (rows === null) rows = await queryPublished("created_at");

  // Last resort: no filter (some deployments may lack `status`), then keep only
  // rows that look published. This also tolerates a future `is_published` flag.
  if (rows === null || rows.length === 0) {
    const all = await db.from("screenplays").select("*").order("created_at", { ascending: false }).limit(PUBLISHED_SCREENPLAYS_LIMIT);
    if (__DEV__) console.log("[WebScreenplays] fallback count:", all.data?.length, "error:", all.error?.message ?? null);
    if (!all.error && Array.isArray(all.data)) {
      rows = all.data.filter((x: Record<string, any>) => {
        const status = str(x.status).toLowerCase();
        const submission = str(x.submission_status).toLowerCase();
        if (status || submission) return status === "published" || submission === "published";
        // No status column at all → treat is_published / published_at as the signal.
        return x.is_published === true || Boolean(x.published_at);
      });
    }
  }

  const mapped = (rows ?? []).map(mapCard).filter((c) => c.id);
  if (__DEV__) console.log("[WebScreenplays] count:", mapped.length);
  return mapped;
}

async function fetchChildRows(table: string, screenplayId: string): Promise<any[]> {
  const orderCols = ["sort_order", "scene_order", "created_at"];
  for (const col of orderCols) {
    const res = await db
      .from(table)
      .select("*")
      .eq("screenplay_id", screenplayId)
      .order(col, { ascending: true });
    if (!res.error && Array.isArray(res.data)) return res.data;
  }
  const res = await db.from(table).select("*").eq("screenplay_id", screenplayId);
  return !res.error && Array.isArray(res.data) ? res.data : [];
}

async function fetchFirstChildRows(tables: string[], screenplayId: string): Promise<any[]> {
  for (const table of tables) {
    const rows = await fetchChildRows(table, screenplayId);
    if (rows.length > 0) return rows;
  }
  return [];
}

function buildToc(blocks: ScreenplayContentBlock[], existing: ScreenplayTocItem[]): ScreenplayTocItem[] {
  if (existing.length > 0) return existing.sort((a, b) => a.sortOrder - b.sortOrder);
  return blocks
    .filter((b) => (b.type === "act" || b.type === "section" || b.type === "heading") && b.anchorId && (b.title || b.displayText))
    .map((b) => ({
      id: `toc-${b.id}`,
      title: b.title ?? b.displayText,
      anchorId: b.anchorId as string,
      level: b.type === "act" ? 1 : 2,
      sortOrder: b.sortOrder,
    }));
}

export async function fetchScreenplayById(idOrSlug: string): Promise<DisplayScreenplay | null> {
  const byId = await selectScreenplays((q) => q.eq("id", idOrSlug).limit(1));
  let row = byId[0];
  if (!row) {
    const bySlug = await selectScreenplays((q) => q.eq("slug", idOrSlug).limit(1));
    row = bySlug[0];
  }
  if (!row) return null;

  const screenplayId = str(row.id);
  const [blockRows, sceneRows, characterRows, musicRows, galleryRows] = await Promise.all([
    fetchChildRows("screenplay_blocks", screenplayId),
    fetchChildRows("screenplay_scenes", screenplayId),
    fetchChildRows("screenplay_characters", screenplayId),
    fetchFirstChildRows(["screenplay_musics", "screenplay_music"], screenplayId),
    fetchChildRows("screenplay_gallery", screenplayId),
  ]);

  let blocks = blockRows.map((r, i) => mapBlock(r, i)).sort((a, b) => a.sortOrder - b.sortOrder);
  let scenes = sceneRows.map((r, i) => mapScene(r, i)).sort((a, b) => a.number - b.number);
  let characters = characterRows.map((r, i) => mapCharacter(r, i));
  let music = musicRows.map((r, i) => mapMusic(r, i));
  const gallery = galleryRows
    .map((r, i) => mapGallery(r, i))
    .filter((x): x is ScreenplayGalleryImage => !!x);

  const rawBody = firstStr(row, ["raw_script_text", "cleaned_content", "raw_content", "content", "script_text"]);
  const parsed = blocks.length === 0 && rawBody ? parseRawScreenplay(rawBody) : null;
  if (parsed) {
    blocks = parsed.blocks;
    if (characters.length === 0) characters = parsed.characters;
    if (scenes.length === 0) scenes = parsed.scenes;
    if (music.length === 0) music = parsed.music;
  }

  const rowMusicUrl = firstStr(row, ["music_url"]);
  if (rowMusicUrl && music.every((track) => track.audioUrl !== rowMusicUrl)) {
    music = [
      {
        id: "screenplay-main-music",
        title: "Fon musiqasi",
        description: "",
        mood: "",
        audioUrl: rowMusicUrl,
        durationLabel: "",
        usagePlace: "",
      },
      ...music,
    ];
  }

  const galleryFromScenes: ScreenplayGalleryImage[] = scenes
    .filter((s) => s.imageUrl)
    .map((s) => ({ id: `${s.id}-img`, url: s.imageUrl as string, caption: s.title }));
  const allGallery = gallery.length > 0 ? gallery : galleryFromScenes;

  blocks = resolveReferences(blocks, characters, scenes, music);
  const toc = buildToc(blocks, parsed?.toc ?? []);

  if (__DEV__) console.log(
    "[ScreenplayDetail] blocks count:", blocks.length,
    "scenes:", scenes.length,
    "characters:", characters.length,
    "music:", music.length
  );

  const { price, isFree, requiresPurchase } = priceOf(row);
  const description = firstStr(row, ["description"]) || parsed?.description || "";
  const fallbackBody = blocks.length === 0 ? rawBody || (scenes.length === 0 ? description : "") : "";

  return {
    id: screenplayId,
    slug: firstStr(row, ["slug"], screenplayId),
    title: firstStr(row, ["title"], parsed?.title || "Ssenariy"),
    author: pickAuthorName(row),
    authorId: firstStr(row, ["author_id"]) || null,
    genre: firstStr(row, ["genre", "screenplay_category", "category"], "Ssenariy"),
    description,
    shortDescription: firstStr(row, ["short_description"], description),
    coverUrl: firstStr(row, ["cover_url", "poster_url", "image_url"]) || null,
    bannerUrl: firstStr(row, ["banner_url"]) || null,
    ageRating: firstStr(row, ["age_rating"]),
    durationLabel: durationLabelOf(row),
    readCount: readCountOf(row),
    price,
    isFree,
    requiresPurchase,
    publishedAt: firstStr(row, ["published_at", "created_at"]),
    blocks,
    toc,
    scenes,
    characters,
    music: music.filter((m) => m.title || m.audioUrl),
    gallery: allGallery,
    fallbackBody,
  };
}

export async function recordScreenplayRead(input: {
  userId: string | null | undefined;
  screenplayId: string;
  progressPercent: number;
  lastBlockId: string | null;
  completed: boolean;
}): Promise<void> {
  if (!input.userId || !input.screenplayId) return;
  try {
    await db.from("screenplay_reads").upsert(
      {
        user_id: input.userId,
        screenplay_id: input.screenplayId,
        progress_percent: Math.max(0, Math.min(100, Math.round(input.progressPercent))),
        last_block_id: input.lastBlockId,
        completed_at: input.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,screenplay_id" }
    );
  } catch {
    // Missing table / RLS / offline should not interrupt reading.
  }
}
