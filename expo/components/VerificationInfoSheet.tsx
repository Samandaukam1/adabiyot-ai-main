import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import { useTheme } from "@/providers/ThemeProvider";
import type { VerificationType } from "@/types/profile";

interface LegendItem {
  type: Exclude<VerificationType, "none">;
  icon: string;
  gradient: [string, string];
  title: string;
  colorName: string;
  desc: string;
}

const LEGEND: LegendItem[] = [
  {
    type: "creator_blue",
    icon: "check-decagram",
    gradient: ["#38BDF8", "#0EA5E9"],
    title: "Ijodkor",
    colorName: "Ko'k",
    desc: "Video, monolog va reels joylaydigan tasdiqlangan ijodkor.",
  },
  {
    type: "adib_green",
    icon: "feather",
    gradient: ["#4ADE80", "#16A34A"],
    title: "Adib",
    colorName: "Yashil",
    desc: "Asarlari AdabiyotX'da nashr etilgan yozuvchi yoki shoir.",
  },
  {
    type: "creator_adib_gold",
    icon: "star-four-points",
    gradient: ["#FBBF24", "#F59E0B"],
    title: "Ijodkor · Adib",
    colorName: "Oltin",
    desc: "Ham ijodkor, ham asarlari nashr etilgan adib.",
  },
  {
    type: "vip_yellow",
    icon: "crown",
    gradient: ["#FCD34D", "#EAB308"],
    title: "VIP",
    colorName: "Sariq",
    desc: "AdabiyotX premium a'zosi.",
  },
  {
    type: "publisher_black",
    icon: "shield-check",
    gradient: ["#374151", "#111827"],
    title: "Nashriyot",
    colorName: "Qora",
    desc: "Rasmiy nashriyot akkaunti.",
  },
  {
    type: "company_black",
    icon: "office-building",
    gradient: ["#1F2937", "#030712"],
    title: "Kompaniya",
    colorName: "Qora",
    desc: "AdabiyotX rasmiy kompaniya akkaunti.",
  },
];

export default function VerificationInfoSheet({
  visible,
  verificationType,
  subjectName,
  onClose,
}: {
  visible: boolean;
  verificationType: VerificationType;
  /**
   * When set, the sheet speaks in the THIRD person about this person (a public
   * profile the viewer opened) instead of "Siz…" (the viewer's own profile).
   */
  subjectName?: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const current = LEGEND.find((l) => l.type === verificationType);
  const subject = subjectName?.trim() || null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Tasdiq nishonlari</Text>
            <Pressable onPress={onClose} hitSlop={14} style={styles.closeBtn}>
              <X color={c.textDim} size={16} />
            </Pressable>
          </View>

          {current ? (
            <View style={styles.currentCard}>
              <VerificationBadge verificationType={verificationType} size="lg" />
              <Text style={styles.currentText}>
                {subject ? (
                  <>
                    <Text style={{ color: c.primary, fontWeight: "900" }}>{subject}</Text> — AdabiyotX
                    platformasi tomonidan tasdiqlangan{" "}
                    <Text style={{ color: c.primary, fontWeight: "900" }}>{current.title}</Text>.
                  </>
                ) : (
                  <>
                    Siz <Text style={{ color: c.primary, fontWeight: "900" }}>{current.title}</Text> tasdiq
                    nishoniga egasiz.
                  </>
                )}
              </Text>
            </View>
          ) : (
            <Text style={styles.noneText}>
              Sizda hali tasdiq nishoni yo'q. Ijodkor yoki adib bo'lib nishonga ega bo'ling.
            </Text>
          )}

          <Text style={styles.legendLabel}>BARCHA NISHONLAR</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {LEGEND.map((item) => {
              const isCurrent = item.type === verificationType;
              return (
                <View key={item.type} style={[styles.row, isCurrent && styles.rowActive]}>
                  <LinearGradient colors={item.gradient} style={styles.rowBadge}>
                    <MaterialCommunityIcons name={item.icon as any} size={16} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <View style={styles.colorPill}>
                        <Text style={styles.colorPillText}>{item.colorName}</Text>
                      </View>
                      {isCurrent ? (
                        <View style={styles.youPill}>
                          <Text style={styles.youPillText}>Siz</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowDesc}>{item.desc}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(13,27,42,0.26)" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { color: c.text, fontSize: 19, fontWeight: "900", fontFamily: FONT.serif },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.bgElevated },
    currentCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: isDark ? "rgba(82,183,136,0.10)" : "rgba(82,183,136,0.07)",
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    currentText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
    noneText: { color: c.textDim, fontSize: 14, lineHeight: 20, marginBottom: 16, fontWeight: "500" },
    legendLabel: { color: c.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 12 },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowActive: { borderColor: c.borderStrong, backgroundColor: isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.05)" },
    rowBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 1 },
    rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
    rowTitle: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    colorPill: { backgroundColor: c.bgElevated, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    colorPillText: { color: c.textDim, fontSize: 10, fontWeight: "700" },
    youPill: { backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    youPillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
    rowDesc: { color: c.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 3, fontWeight: "500" },
  });
}
