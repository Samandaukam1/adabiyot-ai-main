import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, LogIn, LogOut } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import SettingsRow from "@/components/SettingsRow";
import { FONT } from "@/components/ui";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useIsAuthor } from "@/hooks/useAuthorAccount";
import { useTariffsVisible } from "@/hooks/useFeatureFlags";
import { useRestorePurchases } from "@/hooks/useRestorePurchases";
import { useAuth } from "@/providers/AuthProvider";
import { useJaxongirAI } from "@/providers/JaxongirAIProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { isApprovedCreator } from "@/types/profile";
import { confirmAsync, notify } from "@/utils/dialogs";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { settings, setSetting } = useAppSettings();
  const { shakeEnabled, setShakeEnabled, animEnabled, setAnimEnabled } = useJaxongirAI();
  const { isAuthenticated, isGuest, signOut, refreshProfileRow } = useAuth();
  const { profile } = useProfile();
  const isAuthor = useIsAuthor();
  const phoneVerified = profile.phoneVerified;
  const { restore, isRestoring } = useRestorePurchases();
  const [signingOut, setSigningOut] = useState(false);
  // Admin flag. Hides only the subscription/tariff MENU — buying a single book
  // still works, the payment system itself is never switched off here.
  const tariffsVisible = useTariffsVisible();

  const handleRestorePurchases = useCallback(async () => {
    if (isRestoring) return;
    const outcome = await restore();
    notify(
      outcome.status === "restored" ? "Xaridlar tiklandi" : "Xaridlarni tiklash",
      outcome.status === "restored" && outcome.count > 0
        ? `${outcome.message} (${outcome.count} ta asar).`
        : outcome.message
    );
  }, [isRestoring, restore]);

  // Re-read the fresh `profiles` row on focus so the author-only "Daromadlar"
  // section reflects the live account_type / author_id, not a stale cache.
  useFocusEffect(
    useCallback(() => {
      refreshProfileRow().catch(() => {});
    }, [refreshProfileRow])
  );

  const handlePhoneVerify = () => {
    notify(
      phoneVerified ? "Telefon raqam tasdiqlangan" : "Telefon raqamni tasdiqlash",
      phoneVerified
        ? "Akkauntingiz telefon raqami orqali tasdiqlangan."
        : "Bu funksiya tez orada ishga tushadi — telefon raqamingizni SMS kod orqali tasdiqlay olasiz."
    );
  };

  // One shared handler for guest-exit / sign-in / sign-out. `confirmAsync` is
  // used instead of `Alert.alert` because the latter is a no-op on web, which
  // made this button do nothing in the browser.
  const handleAuthAction = useCallback(async () => {
    if (signingOut) return; // already in flight — ignore repeat taps

    if (!isAuthenticated) {
      if (isGuest) {
        setSigningOut(true);
        try {
          await signOut();
        } catch (error) {
          notify(
            "Chiqib bo'lmadi",
            error instanceof Error ? error.message : "Qaytadan urinib ko'ring."
          );
          return;
        } finally {
          setSigningOut(false);
        }
      }
      router.replace("/auth");
      return;
    }

    const confirmed = await confirmAsync({
      title: "Akkountdan chiqish",
      message: "Haqiqatan ham akkauntingizdan chiqmoqchimisiz?",
      confirmText: "Chiqish",
      destructive: true,
    });
    if (!confirmed) return;

    setSigningOut(true);
    try {
      await signOut();
      // The root layout also redirects on `!isAuthenticated`, but navigate
      // explicitly so the browser leaves this screen immediately.
      router.replace("/auth");
    } catch (error) {
      notify(
        "Chiqib bo'lmadi",
        error instanceof Error ? error.message : "Qaytadan urinib ko'ring."
      );
    } finally {
      setSigningOut(false);
    }
  }, [isAuthenticated, isGuest, signOut, signingOut]);

  // Step 1 of the deletion flow. The warning + the typed final confirmation
  // live on their own screen (`/settings/delete-account`) so App Review can see
  // the whole path, and so nothing can be deleted by one stray tap here.
  const handleDeleteAccount = useCallback(() => {
    if (!isAuthenticated) {
      notify("Hisobni o'chirish", "Hisobni o'chirish uchun avval akkauntga kiring.");
      return;
    }
    router.push("/settings/delete-account" as never);
  }, [isAuthenticated]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={c.text} size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Sozlamalar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Web keeps a fixed Jaxongir orb pinned bottom-right; without the
          // extra room it lands on top of the sign-out row at full scroll.
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 150 : 40),
        }}
      >
        {/* ─── Sozlamalar ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SOZLAMALAR</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={isDark ? "weather-night" : "white-balance-sunny"}
            iconColor={isDark ? "#F4A261" : "#FBBF24"}
            iconBg={isDark ? "#1C1E14" : "#FFFBEB"}
            label="Kun-tun rejimi"
            description={isDark ? "Tungi rejim yoqilgan" : "Kunduzgi rejim yoqilgan"}
            value={isDark}
            onValueChange={toggleTheme}
          />
          <SettingsRow
            icon="bell-outline"
            iconColor="#38BDF8"
            iconBg={isDark ? "#14181E" : "#EFF6FF"}
            label="Bildirishnomalar"
            description="Yangiliklar va eslatmalar"
            value={settings.notifications}
            onValueChange={(v) => setSetting("notifications", v)}
            isLast
          />
        </View>

        {/* ─── Muallif (only for author accounts) ─────────────── */}
        {isAuthor ? (
          <>
            <Text style={styles.sectionLabel}>MUALLIF</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="chart-line"
                iconColor={c.primary}
                iconBg={isDark ? "#162D26" : "#E8F5EE"}
                label="Daromadlar"
                description="Sotuvlar va 50% muallif ulushi"
                onPress={() => router.push("/muallif/daromadlar")}
              />
              <SettingsRow
                icon="book-multiple-outline"
                iconColor="#38BDF8"
                iconBg={isDark ? "#14181E" : "#EFF6FF"}
                label="Asarlarim"
                description="Sizga biriktirilgan asarlar"
                onPress={() => router.push("/muallif/asarlar")}
                isLast
              />
            </View>
          </>
        ) : null}

        {/* ─── Ijodkorlik (become creator) ────────────────────── */}
        {!isApprovedCreator(profile) ? (
          <>
            <Text style={styles.sectionLabel}>IJODKORLIK</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="star-circle-outline"
                iconColor="#38BDF8"
                iconBg={isDark ? "#14181E" : "#EFF6FF"}
                label={
                  profile.creatorStatus === "pending"
                    ? "So'rovingiz ko'rib chiqilmoqda"
                    : "Ijodkor bo'lish"
                }
                description={
                  profile.creatorStatus === "pending"
                    ? "So'rovingiz adminga yuborilgan"
                    : profile.creatorStatus === "rejected"
                      ? "Rad etilgan — qayta yuborishingiz mumkin"
                      : "Video, monolog va audio joylang"
                }
                onPress={() => router.push("/creator/become")}
                isLast
              />
            </View>
          </>
        ) : null}

        {/* ─── Ariza qoldirish (author / publishing application) ── */}
        <Text style={styles.sectionLabel}>ADIB BO'LISH</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="file-document-edit-outline"
            iconColor={c.primary}
            iconBg={isDark ? "#162D26" : "#E8F5EE"}
            label="Ariza qoldirish"
            description="Asaringizni chop ettirish yoki adib bo'lish uchun"
            onPress={() => router.push("/author-application")}
            isLast
          />
        </View>

        {/* ─── AdabiyotX Premium ──────────────────────────────────
            Hidden wholesale when the admin turns `tariffs_visible` off (store
            review). "Xaridlarni tiklash" stays available below, because a user
            who already paid must always be able to get their content back. */}
        {tariffsVisible ? (
          <>
            <Text style={styles.sectionLabel}>ADABIYOTX PREMIUM</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="crown-outline"
                iconColor={c.primary}
                iconBg={isDark ? "#162D26" : "#E8F5EE"}
                label="Mening tarifim"
                description="Faol tarif va muddati"
                onPress={() => router.push("/payments/tarifim")}
              />
              <SettingsRow
                icon="receipt-text-outline"
                iconColor="#38BDF8"
                iconBg={isDark ? "#14181E" : "#EFF6FF"}
                label="Mening xaridlarim"
                description="Buyurtmalar tarixi"
                onPress={() => router.push("/payments/xaridlar")}
              />
              <SettingsRow
                icon="star-four-points-outline"
                iconColor="#F4A261"
                iconBg={isDark ? "#1C1E14" : "#FFFBEB"}
                label="Tariflar"
                description="Premium / VIP / Ultra"
                onPress={() => router.push("/payments/tariflar")}
              />
              <SettingsRow
                icon={isRestoring ? "progress-download" : "restore"}
                iconColor="#A78BFA"
                iconBg={isDark ? "#1A162B" : "#F5F3FF"}
                label="Xaridlarni tiklash"
                description={
                  isRestoring
                    ? "Tekshirilmoqda…"
                    : "Oldingi xaridlaringizni serverdan qayta yuklash"
                }
                onPress={handleRestorePurchases}
                isLast
              />
            </View>
          </>
        ) : (
          /* Tariffs hidden — a user who already paid must still be able to pull
             their purchases back down onto a new device. */
          <>
            <Text style={styles.sectionLabel}>XARIDLAR</Text>
            <View style={styles.card}>
              <SettingsRow
                icon={isRestoring ? "progress-download" : "restore"}
                iconColor="#A78BFA"
                iconBg={isDark ? "#1A162B" : "#F5F3FF"}
                label="Xaridlarni tiklash"
                description={
                  isRestoring
                    ? "Tekshirilmoqda…"
                    : "Oldingi xaridlaringizni serverdan qayta yuklash"
                }
                onPress={handleRestorePurchases}
                isLast
              />
            </View>
          </>
        )}

        {/* ─── Jaxongir AI sozlamalari ────────────────────────── */}
        <Text style={styles.sectionLabel}>JAXONGIR AI SOZLAMALARI</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="robot-outline"
            iconColor={c.primary}
            iconBg={isDark ? "#162D26" : "#E8F5EE"}
            label="Jaxongir AI yoqilsin"
            description="AI yordamchisini ishlatish"
            value={settings.jaxongirEnabled}
            onValueChange={(v) => setSetting("jaxongirEnabled", v)}
          />
          <SettingsRow
            icon="gesture-tap-hold"
            iconColor="#A855F7"
            iconBg={isDark ? "#1E1A2D" : "#F5F0FF"}
            label="Telefon chayqalganda chiqsin"
            description="Silkitish orqali AI ochiladi"
            value={shakeEnabled}
            onValueChange={setShakeEnabled}
          />
          <SettingsRow
            icon="volume-high"
            iconColor="#FBBF24"
            iconBg={isDark ? "#1C1E14" : "#FFFBEB"}
            label="Jaxongir AI ovozi"
            description="Javoblarni ovoz bilan eshitish"
            value={settings.jaxongirVoice}
            onValueChange={(v) => setSetting("jaxongirVoice", v)}
          />
          <SettingsRow
            icon="animation-play"
            iconColor="#4ADE80"
            iconBg={isDark ? "#1C2018" : "#F0FFF4"}
            label="Glow animatsiyasi"
            description="AI atrofidagi nur effekti"
            value={animEnabled}
            onValueChange={setAnimEnabled}
          />
          <SettingsRow
            icon="message-reply-text-outline"
            iconColor="#38BDF8"
            iconBg={isDark ? "#14181E" : "#EFF6FF"}
            label="Ovozli javoblar"
            description="Javoblar avtomatik o'qib eshittiriladi"
            value={settings.voiceReplies}
            onValueChange={(v) => setSetting("voiceReplies", v)}
            isLast
          />
        </View>

        {/* ─── Tasdiqlash ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>TASDIQLASH</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={phoneVerified ? "cellphone-check" : "cellphone-message"}
            iconColor={phoneVerified ? c.primary : "#F59E0B"}
            iconBg={
              phoneVerified
                ? isDark ? "#162D26" : "#E8F5EE"
                : isDark ? "#2A210B" : "#FFFBEB"
            }
            label="Telefon raqamni tasdiqlash"
            description={
              phoneVerified
                ? "Telefon raqam tasdiqlangan"
                : "Akkountingizni telefon raqam bilan tasdiqlang"
            }
            onPress={handlePhoneVerify}
            isLast
          />
        </View>

        {/* ─── Huquqiy ma'lumot ────────────────────────────────── */}
        <Text style={styles.sectionLabel}>HUQUQIY MA'LUMOT</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="shield-lock-outline"
            iconColor="#38BDF8"
            iconBg={isDark ? "#14181E" : "#EFF6FF"}
            label="Maxfiylik siyosati"
            description="Ma'lumotlaringiz qanday saqlanadi"
            // Cast: typed-routes hasn't regenerated its union for the legal
            // screens yet (same as in app/_layout.tsx).
            onPress={() => router.push("/privacy" as never)}
          />
          <SettingsRow
            icon="file-document-outline"
            iconColor={c.primary}
            iconBg={isDark ? "#162D26" : "#E8F5EE"}
            label="Foydalanish shartlari"
            description="Ilovadan foydalanish qoidalari"
            onPress={() => router.push("/terms" as never)}
            isLast
          />
        </View>

        {/* ─── Akkount ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>AKKAUNT</Text>
        <View style={[styles.card, styles.authCard]}>
          <Pressable
            onPress={handleAuthAction}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut, busy: signingOut }}
            accessibilityLabel={isAuthenticated ? "Hisobdan chiqish" : "Kirish"}
            style={({ pressed }) => [
              styles.authRow,
              signingOut && { opacity: 0.6 },
              pressed && !signingOut && { opacity: 0.75 },
            ]}
          >
            <View
              style={[
                styles.authIcon,
                {
                  backgroundColor: isAuthenticated
                    ? isDark ? "#2A1515" : "#FEF2F2"
                    : isGuest
                      ? isDark ? "#2A210B" : "#FFFBEB"
                      : isDark ? "#162D26" : "#E8F5EE",
                },
              ]}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={isAuthenticated ? "#EF4444" : c.primary} />
              ) : isAuthenticated ? (
                <LogOut color="#EF4444" size={19} strokeWidth={2.4} />
              ) : (
                <LogIn color={isGuest ? "#F59E0B" : c.primary} size={19} strokeWidth={2.4} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.authLabel,
                  { color: isAuthenticated ? "#EF4444" : c.text },
                ]}
              >
                {signingOut
                  ? "Chiqilmoqda…"
                  : isAuthenticated
                    ? "Chiqish"
                    : isGuest
                      ? "Mehmon rejimidan chiqish"
                      : "Kirish / Ro'yxatdan o'tish"}
              </Text>
              <Text style={styles.authDesc}>
                {signingOut
                  ? "Sessiya yakunlanmoqda, kuting…"
                  : isAuthenticated
                    ? "Bu qurilmadagi sessiyani yakunlash"
                    : isGuest
                      ? "Kirish sahifasiga qaytib, Google yoki Apple orqali ulaning"
                      : "Google yoki Apple orqali profilga ulanish"}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ─── Hisobni o'chirish (App Review guideline 5.1.1) ───── */}
        <View style={[styles.card, styles.authCard, { marginTop: 12 }]}>
          <SettingsRow
            icon="account-remove-outline"
            iconColor="#EF4444"
            iconBg={isDark ? "#2A1515" : "#FEF2F2"}
            label="Hisobni butunlay o'chirish"
            description={
              isAuthenticated
                ? "Hisobingiz va shaxsiy ma'lumotlaringiz butunlay o'chiriladi"
                : "Hisobni o'chirish uchun avval akkauntga kiring"
            }
            onPress={handleDeleteAccount}
            isLast
          />
        </View>

        <Text style={styles.version}>AdabiyotX v2.4.0</Text>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 12,
    },
    card: {
      marginHorizontal: 20,
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
    },
    // Sits above the ambient web glow layers so the row always takes the tap.
    authCard: { position: "relative", zIndex: 1 },
    authRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      paddingVertical: 14,
      paddingHorizontal: 14,
      ...Platform.select({ web: { cursor: "pointer" as const }, default: {} }),
    },
    authIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    authLabel: { fontSize: 15, fontWeight: "700" },
    authDesc: { color: c.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16, fontWeight: "500" },
    version: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 32,
      fontWeight: "500",
    },
  });
}
