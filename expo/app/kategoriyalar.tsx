/**
 * "Kategoriyalar" — the admin panel's Kategoriya field
 * (public.content_categories, content_group = 'book'), and the published books
 * tagged with each one.
 */
import React, { useCallback, useMemo } from "react";

import TaxonomyBrowseScreen, {
  type TaxonomyEntry,
} from "@/components/TaxonomyBrowseScreen";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { useContentCategories } from "@/hooks/useTaxonomy";
import {
  booksInCategory,
  withCategoryCounts,
  type ContentCategory,
} from "@/lib/taxonomy";

export default function CategoriesScreen() {
  const { categories, loading: catsLoading, error: catsError } = useContentCategories("book");
  const { books, loading: booksLoading, error: booksError } = usePublishedBooks();

  const categoryBySlug = useMemo(() => {
    const map = new Map<string, ContentCategory>();
    categories.forEach((cat) => map.set(cat.slug || cat.name, cat));
    return map;
  }, [categories]);

  const entries = useMemo<TaxonomyEntry[]>(
    () =>
      withCategoryCounts(categories, books).map(({ item, count }) => ({
        id: item.id,
        name: item.name,
        slug: item.slug || item.name,
        count,
      })),
    [categories, books]
  );

  const booksFor = useCallback(
    (entry: TaxonomyEntry) => {
      const category = categoryBySlug.get(entry.slug);
      return category ? booksInCategory(books, category) : [];
    },
    [categoryBySlug, books]
  );

  return (
    <TaxonomyBrowseScreen
      title="Kategoriyalar"
      subtitle="Kitoblarni mavzu va turkumlar bo'yicha ko'ring"
      searchPlaceholder="Kategoriya nomini qidiring"
      icon="shape-outline"
      entries={entries}
      loading={catsLoading || booksLoading}
      error={catsError ?? (booksError ? "Kitoblarni yuklashda xatolik yuz berdi." : null)}
      booksFor={booksFor}
      emptyListText="Hozircha kategoriyalar mavjud emas."
      emptyDetailText="Bu kategoriyada hozircha kitoblar mavjud emas."
      backToListLabel="Kategoriyalarga qaytish"
    />
  );
}
