import { supabase } from "@/lib/supabase";

/**
 * Creator ("Ijodkor") application flow — writes a real row to
 * `public.creator_applications` so the request shows up in the admin panel, then
 * marks the profile as `creator_status = 'pending'`. The admin later approves
 * (→ `is_creator = true`, `creator_status = 'approved'`) or rejects it. The app
 * NEVER auto-approves — the badge only appears after admin approval.
 */

/** The user-entered fields of the "Ijodkor bo'lish" form. */
export interface CreatorApplicationInput {
  fullName: string;
  phone: string;
  bio: string;
  reason: string;
  portfolioUrl: string;
  instagramUrl: string;
  telegramUrl: string;
}

export interface CreatorApplicationResult {
  applicationId: string | null;
  notificationError: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Insert a `pending` application for the signed-in user and flip their profile
 * to `creator_status = 'pending'`. Throws on failure (RLS / network) so the UI
 * can surface a friendly message and let the user retry.
 */
export async function submitCreatorApplication(
  userId: string,
  username: string | null,
  input: CreatorApplicationInput
): Promise<CreatorApplicationResult> {
  const { data, error: insertError } = await (supabase as any)
    .from("creator_applications")
    .insert({
      user_id: userId,
      full_name: clean(input.fullName),
      username: clean(username),
      phone: clean(input.phone),
      bio: clean(input.bio),
      reason: clean(input.reason),
      portfolio_url: clean(input.portfolioUrl),
      instagram_url: clean(input.instagramUrl),
      telegram_url: clean(input.telegramUrl),
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("[creator] application insert failed:", insertError.message);
    throw insertError;
  }
  const applicationId: string | null = data?.id ?? null;

  // Reflect the pending state on the profile so gating (button ↔ badge) is
  // consistent across the app the moment the request is sent.
  const { error: updateError } = await (supabase as any)
    .from("profiles")
    .update({ creator_status: "pending" })
    .eq("id", userId);
  if (updateError) {
    console.error("[creator] profile status update failed:", updateError.message);
    throw updateError;
  }

  const notificationError = await insertCreatorSubmittedNotification(userId, applicationId);
  return { applicationId, notificationError };
}

async function insertCreatorSubmittedNotification(
  userId: string,
  applicationId: string | null
): Promise<string | null> {
  const data = applicationId ? { application_id: applicationId } : null;

  const currentSchema = await (supabase as any)
    .from("notifications")
    .insert({
      recipient_id: userId,
      actor_user_id: userId, // insert RLS requires actor = auth.uid()
      notification_type: "creator_application_submitted",
      title: "So‘rovingiz muvaffaqiyatli yuborildi",
      body: "Ijodkor bo‘lish so‘rovingiz AdabiyotX jamoasiga yuborildi. Tez orada ko‘rib chiqiladi.",
      metadata: data,
    });
  if (!currentSchema.error) return null;

  const fallbackSchema = await (supabase as any)
    .from("notifications")
    .insert({
      user_id: userId,
      type: "creator_application_submitted",
      title: "So‘rovingiz muvaffaqiyatli yuborildi",
      message: "Ijodkor bo‘lish so‘rovingiz AdabiyotX jamoasiga yuborildi. Tez orada ko‘rib chiqiladi.",
      data,
    });
  if (!fallbackSchema.error) return null;

  const message = fallbackSchema.error.message || currentSchema.error.message || "Notification yaratilmadi";
  console.error("[creator] submit notification failed:", {
    currentSchema: currentSchema.error.message,
    fallbackSchema: fallbackSchema.error.message,
  });
  return message;
}
