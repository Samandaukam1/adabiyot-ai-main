/**
 * React-query hooks over the DB-backed Janr / Kategoriya taxonomy.
 * See lib/taxonomy.ts for the schema notes.
 */
import { useQuery } from "@tanstack/react-query";

import {
  fetchContentCategories,
  fetchContentGenres,
  type ContentCategory,
  type ContentGenre,
  type ContentGroup,
} from "@/lib/taxonomy";

const TAXONOMY_STALE_MS = 10 * 60_000; // taxonomy changes rarely

export function useContentGenres() {
  const query = useQuery<ContentGenre[]>({
    queryKey: ["taxonomy", "genres"],
    queryFn: fetchContentGenres,
    staleTime: TAXONOMY_STALE_MS,
    retry: 1,
  });

  return {
    genres: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? "Janrlarni yuklashda xatolik yuz berdi." : null,
    refetch: query.refetch,
  };
}

export function useContentCategories(group: ContentGroup = "book") {
  const query = useQuery<ContentCategory[]>({
    queryKey: ["taxonomy", "categories", group],
    queryFn: () => fetchContentCategories(group),
    staleTime: TAXONOMY_STALE_MS,
    retry: 1,
  });

  return {
    categories: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? "Kategoriyalarni yuklashda xatolik yuz berdi." : null,
    refetch: query.refetch,
  };
}
