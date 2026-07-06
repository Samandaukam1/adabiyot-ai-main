import { Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getBook } from "@/mocks/content";
import { normalizeKind } from "@/types/community";

/** Route helpers — keep navigation centralised so every caller stays in sync. */
function goPoem(id: string) {
  router.push({ pathname: "/poem/[id]", params: { id } });
}
function goBook(id: string) {
  router.push({ pathname: "/book/[id]", params: { id } });
}
function goArticle(id: string) {
  router.push({ pathname: "/article/[id]", params: { id } });
}
function goScreenplay(id: string) {
  router.push({ pathname: "/screenplay/[id]", params: { id } });
}

function looksLikePoem(row: Record<string, any> | null | undefined): boolean {
  if (!row) return false;
  const genre = String(row.genre ?? "").toLowerCase();
  const mode = String(row.content_mode ?? "").toLowerCase();
  return genre.includes("she'r") || genre.includes("sher") || mode === "poem";
}

/**
 * Resolves a piece of literature to its REAL detail page and navigates there.
 *
 * The stored `attached_content_id` is not always the canonical books/poems id
 * (legacy posts, search-index quirks), so we verify it against the database:
 *   1. fast path — look the id up directly in poems then books
 *   2. fallback — if the id isn't found, resolve by title (+ type hint)
 * Only when nothing matches do we surface "Adabiyot topilmadi".
 *
 * Articles & screenplays are mock-only in this app, so those route straight to
 * their (mock-backed) detail pages by id.
 */
export async function openContentPreview(
  contentType: string | null | undefined,
  contentId: string | null | undefined,
  opts?: { title?: string | null }
): Promise<boolean> {
  const id = contentId ? String(contentId).trim() : "";
  const title = opts?.title?.trim() || "";
  const kind = normalizeKind(contentType ?? null);

  // Mock-only content types — route directly to their detail pages by id.
  if (kind === "article" || kind === "guide") {
    if (id) {
      goArticle(id);
      return true;
    }
    return notFound(title);
  }
  if (kind === "script") {
    if (id) {
      goScreenplay(id);
      return true;
    }
    return notFound(title);
  }

  // Bundled mock book/poem — the detail page resolves it locally.
  if (id && getBook(id)) {
    if (kind === "poem" || kind === "tale") goPoem(id);
    else goBook(id);
    return true;
  }

  // ── Database-backed resolution (books + poems) ───────────────────────────
  // 1) Fast path: look the id up directly.
  if (id) {
    const [poemById, bookById] = await Promise.all([
      (supabase as any)
        .from("poems")
        .select("id")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle(),
      (supabase as any)
        .from("books")
        .select("id, genre, content_mode")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle(),
    ]);

    if (poemById?.data?.id) {
      goPoem(String(poemById.data.id));
      return true;
    }
    if (bookById?.data?.id) {
      if (looksLikePoem(bookById.data)) goPoem(String(bookById.data.id));
      else goBook(String(bookById.data.id));
      return true;
    }
  }

  // 2) Fallback: the stored id is stale/wrong — resolve by title instead.
  if (title) {
    // Prefer poems when the type hint says so, otherwise try books first.
    const preferPoem = kind === "poem" || kind === "tale";
    const order = preferPoem ? (["poems", "books"] as const) : (["books", "poems"] as const);

    for (const table of order) {
      const sel = table === "books" ? "id, genre, content_mode" : "id";
      const { data } = await (supabase as any)
        .from(table)
        .select(sel)
        .eq("status", "published")
        .ilike("title", title)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        if (table === "poems" || looksLikePoem(data)) goPoem(String(data.id));
        else goBook(String(data.id));
        return true;
      }
    }
  }

  return notFound(title);
}

function notFound(title: string): boolean {
  Alert.alert("Adabiyot topilmadi", title ? `"${title}" topilmadi.` : undefined);
  return false;
}
