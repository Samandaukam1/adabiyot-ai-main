/**
 * "Janrlar" — the admin panel's Janr field (public.content_genres), and the
 * published books tagged with each one.
 */
import React, { useCallback, useMemo } from "react";

import TaxonomyBrowseScreen, {
  type TaxonomyEntry,
} from "@/components/TaxonomyBrowseScreen";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { useContentGenres } from "@/hooks/useTaxonomy";
import { booksInGenre, withGenreCounts, type ContentGenre } from "@/lib/taxonomy";

export default function GenresScreen() {
  const { genres, loading: genresLoading, error: genresError } = useContentGenres();
  const { books, loading: booksLoading, error: booksError } = usePublishedBooks();

  // Keep the source genre alongside the flattened entry so the detail view can
  // filter on the FK, not just the display name.
  const genreBySlug = useMemo(() => {
    const map = new Map<string, ContentGenre>();
    genres.forEach((g) => map.set(g.slug || g.name, g));
    return map;
  }, [genres]);

  const entries = useMemo<TaxonomyEntry[]>(
    () =>
      withGenreCounts(genres, books).map(({ item, count }) => ({
        id: item.id,
        name: item.name,
        slug: item.slug || item.name,
        count,
      })),
    [genres, books]
  );

  const booksFor = useCallback(
    (entry: TaxonomyEntry) => {
      const genre = genreBySlug.get(entry.slug);
      return genre ? booksInGenre(books, genre) : [];
    },
    [genreBySlug, books]
  );

  return (
    <TaxonomyBrowseScreen
      title="Janrlar"
      subtitle="O'zingizga mos adabiy yo'nalishni tanlang"
      searchPlaceholder="Janr nomini qidiring"
      icon="bookshelf"
      entries={entries}
      loading={genresLoading || booksLoading}
      error={genresError ?? (booksError ? "Kitoblarni yuklashda xatolik yuz berdi." : null)}
      booksFor={booksFor}
      emptyListText="Hozircha janrlar mavjud emas."
      emptyDetailText="Bu janrda hozircha kitoblar mavjud emas."
      backToListLabel="Janrlarga qaytish"
    />
  );
}
