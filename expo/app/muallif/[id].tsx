import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BadgeCheck, BookOpen, ChevronRight } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import AuthorWorkCard from "@/components/AuthorWorkCard";
import { FONT, PressableScale } from "@/components/ui";
import {
  useAuthorPublicProfile,
  useAuthorPublicWorks,
} from "@/hooks/useAuthorAccount";
import { getInitials } from "@/types/profile";
import { useTheme } from "@/providers/ThemeProvider";

const CARD_WIDTH = (Dimensions.get("window").width - 28 - 24) / 2;

export default function PublicAuthorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const authorId = id ? String(id) : undefined;
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const { author, loading } = useAuthorPublicProfile(authorId);
  const { works, loading: worksLoading } = useAuthorPublicWorks(authorId);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (!author) {
    return (
      <View style={[styles.screen, styles.center, { paddingHorizontal: 40 }]}>
        <Text style={styles.notFoundTitle}>Muallif topilmadi</Text>
        <Text style={styles.notFoundText}>
          Bu muallif ma'lumotlari mavjud emas yoki hali chop etilmagan.
        </Text>
        <PressableScale onPress={() => router.back()} style={styles.backCta}>
          <Text style={styles.backCtaText}>Orqaga</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      >
        {/* ─── HERO ──────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {author.avatarUrl ? (
            <Image
              source={{ uri: author.avatarUrl }}
              style={StyleSheet.absoluteFillObject}
              blurRadius={40}
            />
          ) : (
            <LinearGradient
              colors={isDark ? ["#15211B", "#101A15"] : ["#EAF6EF", "#E3F0E6"]}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <LinearGradient
            colors={[
              isDark ? "rgba(13,17,23,0.35)" : "rgba(255,255,255,0.35)",
              isDark ? "rgba(13,17,23,0.85)" : "rgba(255,255,255,0.8)",
              c.bg,
            ]}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={c.text} size={20} />
            </PressableScale>
            <View style={styles.encBadge}>
              <Text style={styles.encBadgeText}>MUALLIF</Text>
            </View>
          </View>

          <View style={styles.heroInner}>
            {author.avatarUrl ? (
              <Image source={{ uri: author.avatarUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoInitials}>{getInitials(author.fullName)}</Text>
              </View>
            )}
            <View style={styles.nameRow}>
              <Text style={styles.name}>{author.fullName}</Text>
              {author.isVerified ? (
                <BadgeCheck color={c.primary} size={22} fill={c.primary} strokeWidth={0} />
              ) : null}
            </View>
            {author.profession ? (
              <Text style={styles.role}>{author.profession}</Text>
            ) : null}
            {author.shortDescription ? (
              <Text style={styles.shortDesc}>{author.shortDescription}</Text>
            ) : null}

            {author.encyclopediaEntryId ? (
              <PressableScale
                onPress={() => router.push(`/adiblar/${author.encyclopediaEntryId}` as never)}
                style={styles.encCta}
              >
                <BookOpen color={c.primary} size={16} strokeWidth={2.2} />
                <Text style={styles.encCtaText}>Adiblar ensiklopediyasida o'qish</Text>
                <ChevronRight color={c.primary} size={16} />
              </PressableScale>
            ) : null}
          </View>
        </View>

        {/* ─── BIO ───────────────────────────────────────────────── */}
        {author.bio ? (
          <>
            <Text style={styles.sectionTitle}>Muallif haqida</Text>
            <View style={styles.bioBox}>
              <Text style={styles.bioText}>{author.bio}</Text>
              {author.quote ? (
                <Text style={styles.quote}>“{author.quote}”</Text>
              ) : null}
            </View>
          </>
        ) : null}

        {/* ─── ASARLAR ───────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Asarlari</Text>
        {worksLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : works.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Bu muallifga hali asarlar biriktirilmagan.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {works.map((w) => (
              <View key={`${w.contentType}:${w.id}`} style={styles.gridCell}>
                <AuthorWorkCard work={w} width={CARD_WIDTH} showStats={false} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    center: { justifyContent: "center", alignItems: "center", flexGrow: 1 },

    hero: { minHeight: 420, paddingBottom: 24 },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.82)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
    },
    encBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: "rgba(45,155,111,0.14)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.32)",
    },
    encBadgeText: { color: c.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    heroInner: { alignItems: "center", paddingHorizontal: 24, marginTop: 20 },
    photo: {
      width: 122,
      height: 122,
      borderRadius: 61,
      borderWidth: 4,
      borderColor: c.bg,
      backgroundColor: c.surface,
    },
    photoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: c.primary },
    photoInitials: { color: "#fff", fontSize: 42, fontWeight: "900", fontFamily: FONT.serif },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16 },
    name: {
      color: c.text,
      fontSize: 26,
      fontFamily: FONT.serif,
      fontWeight: "800",
      letterSpacing: -0.5,
      textAlign: "center",
    },
    role: { color: c.primary, fontSize: 13.5, fontWeight: "700", marginTop: 6 },
    shortDesc: {
      color: c.textDim,
      fontSize: 13.5,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 10,
      fontWeight: "500",
    },
    encCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 18,
      paddingHorizontal: 16,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
      borderColor: c.borderStrong,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.06)",
    },
    encCtaText: { color: c.primary, fontSize: 13.5, fontWeight: "800" },

    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: "800",
      fontFamily: FONT.serif,
      paddingHorizontal: 20,
      marginTop: 26,
      marginBottom: 12,
    },
    bioBox: {
      marginHorizontal: 20,
      padding: 18,
      backgroundColor: c.bgCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
    },
    bioText: { color: c.text, fontSize: 14, lineHeight: 22, fontWeight: "500" },
    quote: {
      color: c.primary,
      fontSize: 14,
      lineHeight: 22,
      fontStyle: "italic",
      marginTop: 12,
      fontFamily: FONT.serif,
    },

    grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14 },
    gridCell: { width: "50%", paddingHorizontal: 6, marginBottom: 20 },
    emptyWrap: { paddingHorizontal: 40, paddingVertical: 30, alignItems: "center" },
    emptyText: { color: c.textMuted, fontSize: 13.5, fontWeight: "500", textAlign: "center", lineHeight: 20 },

    notFoundTitle: { color: c.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
    notFoundText: { color: c.textMuted, fontSize: 13.5, textAlign: "center", lineHeight: 20, marginBottom: 18 },
    backCta: {
      paddingHorizontal: 24,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    backCtaText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
}
