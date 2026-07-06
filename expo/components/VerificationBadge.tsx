import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { VerificationType } from "@/types/profile";

interface BadgeConfig {
  gradientColors: [string, string];
  icon: string;
  label: string;
  border: string;
}

const BADGE_CONFIG: Record<Exclude<VerificationType, "none">, BadgeConfig> = {
  creator_blue: {
    gradientColors: ["#38BDF8", "#0EA5E9"],
    icon: "check-decagram",
    label: "Ijodkor",
    border: "#BAE6FD",
  },
  adib_green: {
    gradientColors: ["#4ADE80", "#16A34A"],
    icon: "feather",
    label: "Adib",
    border: "#BBF7D0",
  },
  creator_adib_gold: {
    gradientColors: ["#FBBF24", "#F59E0B"],
    icon: "star-four-points",
    label: "Ijodkor · Adib",
    border: "#FDE68A",
  },
  vip_yellow: {
    gradientColors: ["#FCD34D", "#EAB308"],
    icon: "crown",
    label: "VIP",
    border: "#FEF08A",
  },
  publisher_black: {
    gradientColors: ["#374151", "#111827"],
    icon: "shield-check",
    label: "Nashriyot",
    border: "#6B7280",
  },
  company_black: {
    gradientColors: ["#1F2937", "#030712"],
    icon: "office-building",
    label: "Kompaniya",
    border: "#4B5563",
  },
};

interface Props {
  verificationType: VerificationType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const ICON_SIZE: Record<string, number> = { sm: 9, md: 11, lg: 14 };
const BADGE_SIZE: Record<string, number> = { sm: 18, md: 22, lg: 28 };

export default function VerificationBadge({
  verificationType,
  size = "md",
  showLabel = false,
}: Props) {
  if (verificationType === "none") return null;

  const config = BADGE_CONFIG[verificationType];
  const badgeSz = BADGE_SIZE[size];
  const iconSz = ICON_SIZE[size];
  const radius = badgeSz / 2;

  if (showLabel) {
    return (
      <View style={styles.row}>
        <LinearGradient
          colors={config.gradientColors}
          style={[
            styles.badge,
            {
              width: badgeSz,
              height: badgeSz,
              borderRadius: radius,
              borderColor: config.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={config.icon as any}
            size={iconSz}
            color="#fff"
          />
        </LinearGradient>
        <Text style={[styles.label, size === "sm" ? styles.labelSm : size === "lg" ? styles.labelLg : styles.labelMd]}>
          {config.label}
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={config.gradientColors}
      style={[
        styles.badge,
        {
          width: badgeSz,
          height: badgeSz,
          borderRadius: radius,
          borderColor: config.border,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={config.icon as any}
        size={iconSz}
        color="#fff"
      />
    </LinearGradient>
  );
}

export function GoldBadgeRow() {
  return (
    <View style={styles.goldRow}>
      <LinearGradient
        colors={["#FBBF24", "#F59E0B", "#D97706"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.goldPill}
      >
        <MaterialCommunityIcons name="star-four-points" size={11} color="#fff" />
        <Text style={styles.goldText}>Ijodkor · Adib</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  label: {
    fontWeight: "700",
    color: "#fff",
  },
  labelSm: { fontSize: 10 },
  labelMd: { fontSize: 12 },
  labelLg: { fontSize: 14 },
  goldRow: { flexDirection: "row" },
  goldPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  goldText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
