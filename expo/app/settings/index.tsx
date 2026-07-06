import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, LogIn, LogOut } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import SettingsRow from "@/components/SettingsRow";
import { FONT } from "@/components/ui";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useIsAuthor } from "@/hooks/useAuthorAccount";
import { useAuth } from "@/providers/AuthProvider";
import { useJaxongirAI } from "@/providers/JaxongirAIProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { isApprovedCreator } from "@/types/profile";

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

  // Re-read the fresh `profiles` row on focus so the author-only "Daromadlar"
  // section reflects the live account_type / author_id, not a stale cache.
  useFocusEffect(
    useCallback(() => {
      refreshProfileRow().catch(() => {});
    }, [refreshProfileRow])
  );

  const handlePhoneVerify = () => {
    Alert.alert(
      phoneVerified ? "Telefon raqam tasdiqlangan" : "Telefon raqamni tasdiqlash",
      phoneVerified
        ? "Akkauntingiz telefon raqami orqali tasdiqlangan."
        : "Bu funksiya tez orada ishga tushadi — telefon raqamingizni SMS kod orqali tasdiqlay olasiz."
    );
  };

  const handleAuthAction = async () => {
    if (!isAuthenticated && isGuest) {
      await signOut();
      router.replace("/auth");
      return;
    }

    if (!isAuthenticated) {
      router.replace("/auth");
      return;
    }

    Alert.alert(
      "Akkountdan chiqish",
      "Haqiqatan ham akkauntingizdan chiqmoqchimisiz?",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Chiqish",
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

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
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
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

        {/* ─── AdabiyotX Premium ──────────────────────────────── */}
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
            isLast
          />
        </View>

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

        {/* ─── Akkount ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>AKKAUNT</Text>
        <View style={styles.card}>
          <Pressable onPress={handleAuthAction} style={styles.authRow}>
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
              {isAuthenticated ? (
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
                {isAuthenticated
                  ? "Chiqish"
                  : isGuest
                    ? "Mehmon rejimidan chiqish"
                    : "Kirish / Ro'yxatdan o'tish"}
              </Text>
              <Text style={styles.authDesc}>
                {isAuthenticated
                  ? "Bu qurilmadagi sessiyani yakunlash"
                  : isGuest
                    ? "Kirish sahifasiga qaytib, Google yoki Apple orqali ulaning"
                    : "Google yoki Apple orqali profilga ulanish"}
              </Text>
            </View>
          </Pressable>
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
    authRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      paddingVertical: 14,
      paddingHorizontal: 14,
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
