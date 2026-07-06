import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { resolveProfileAvatarUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { createSozlabPost, updateSozlabPostText } from "@/lib/sozlabPosts";
import { useAuth } from "@/providers/AuthProvider";

export type ReviewContentType =
  | "book"
  | "poem"
  | "article"
  | "script"
  | "story"
  | "tale"
  | "guide"
  | "novel";

export interface ContentReview {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewerName: string | null;
  reviewerAvatarUrl: string | null;
  reviewerVerification: string | null;
  sozlabPostId: string | null;
}

export interface ContentMeta {
  title?: string | null;
  author?: string | null;
  coverUrl?: string | null;
}

function starString(rating: number): string {
  const r = Math.max(0, Math.min(5, rating));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

/**
 * 5-star rating + review for any content item. On submit it upserts one review
 * per (user, content) and mirrors it into So'zLab as a `review` post (created
 * once, then kept in sync) so each rating also appears in the feed.
 */
export function useContentReview(
  contentType: ReviewContentType,
  contentId: string | null | undefined,
  meta: ContentMeta
) {
  const { userId } = useAuth();
  const cid = contentId ? String(contentId) : null;

  const [avgRating, setAvgRating] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [myReview, setMyReview] = useState<ContentReview | null>(null);
  const [reviews, setReviews] = useState<ContentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!cid) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [statsRes, listRes] = await Promise.all([
      (supabase as any)
        .from("content_review_stats")
        .select("*")
        .eq("content_type", contentType)
        .eq("content_id", cid)
        .maybeSingle(),
      (supabase as any)
        .from("mobile_content_reviews")
        .select("*")
        .eq("content_type", contentType)
        .eq("content_id", cid)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const rows: ContentReview[] = Array.isArray(listRes.data)
      ? listRes.data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          rating: r.rating,
          comment: r.comment ?? null,
          createdAt: r.created_at,
          reviewerName: r.reviewer_name ?? null,
          reviewerAvatarUrl: resolveProfileAvatarUrl(r.reviewer_avatar_url),
          reviewerVerification: r.reviewer_verification_type ?? null,
          sozlabPostId: r.sozlab_post_id ?? null,
        }))
      : [];
    setReviews(rows);
    setMyReview(userId ? rows.find((r) => r.userId === userId) ?? null : null);

    // Prefer the stats view; fall back to computing from the loaded reviews so
    // the average + count still render if the view isn't deployed yet.
    const statsCount = Number(statsRes.data?.reviews_count ?? 0);
    if (statsCount > 0) {
      setAvgRating(Number(statsRes.data?.avg_rating ?? 0));
      setRatingsCount(statsCount);
    } else if (rows.length > 0) {
      const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
      setAvgRating(Math.round(avg * 100) / 100);
      setRatingsCount(rows.length);
    } else {
      setAvgRating(0);
      setRatingsCount(0);
    }
    setLoading(false);
  }, [cid, contentType, userId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Returns { ok, needAuth } — caller routes to /auth when needAuth. */
  const submit = useCallback(
    async ({ rating, comment }: { rating: number; comment: string }): Promise<{ ok: boolean; needAuth?: boolean }> => {
      if (!userId) return { ok: false, needAuth: true };
      if (!cid || rating < 1 || submitting) return { ok: false };
      setSubmitting(true);

      const reviewText = comment.trim();
      const nowIso = new Date().toISOString();

      // 1) One review per (user, content).
      const { data: reviewRow, error: reviewErr } = await (supabase as any)
        .from("content_reviews")
        .upsert(
          {
            user_id: userId,
            content_type: contentType,
            content_id: cid,
            content_title: meta.title ?? null,
            content_author: meta.author ?? null,
            content_cover_url: meta.coverUrl ?? null,
            rating,
            comment: reviewText || null,
            updated_at: nowIso,
          },
          { onConflict: "user_id,content_type,content_id" }
        )
        .select("*")
        .single();

      if (reviewErr) {
        setSubmitting(false);
        const msg = reviewErr.message ?? "";
        Alert.alert(
          "Baho saqlanmadi",
          /does not exist|content_reviews|schema cache/i.test(msg)
            ? "Baholash jadvali bazada topilmadi. Supabase SQL migratsiyasini ishga tushiring (content_reviews)."
            : msg
        );
        return { ok: false };
      }

      // 2) Mirror into So'zLab (create once, then keep in sync) using the same
      //    proven insert path the composer uses (moderation_status loop +
      //    modern/legacy schema fallback), so it never fails silently.
      const stars = starString(rating);
      const mirrorBody = reviewText
        ? `${stars}\n${reviewText}`
        : `${stars}\nUshbu asarga ${rating} yulduz baho berdi.`;
      const mirrorTitle = (reviewText || `${meta.title ?? "Asar"} — baho`).slice(0, 80);

      const existingPostId: string | null = reviewRow?.sozlab_post_id ?? null;
      if (existingPostId) {
        await updateSozlabPostText(existingPostId, mirrorTitle, mirrorBody);
      } else {
        const ins = await createSozlabPost({
          userId,
          title: mirrorTitle,
          content: mirrorBody,
          // Prefer a dedicated 'review' type; fall back to 'thought' when the
          // deployment's post_type CHECK constraint doesn't allow 'review'.
          postTypeCandidates: ["review", "thought"],
          attachment: {
            id: cid,
            contentType,
            title: meta.title ?? null,
            cover: meta.coverUrl ?? null,
            author: meta.author ?? null,
          },
        });
        if (!ins.error && ins.data?.id && reviewRow?.id) {
          await (supabase as any)
            .from("content_reviews")
            .update({ sozlab_post_id: ins.data.id })
            .eq("id", reviewRow.id);
        }
      }

      setSubmitting(false);
      await load();
      return { ok: true };
    },
    [userId, cid, contentType, meta.title, meta.author, meta.coverUrl, submitting, load]
  );

  return { avgRating, ratingsCount, myReview, reviews, loading, submitting, submit, refresh: load };
}
