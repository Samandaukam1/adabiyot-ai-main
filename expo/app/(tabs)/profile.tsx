import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Award,
  Bell,
  ChevronRight,
  Crown,
  Download,
  Flame,
  Globe,
  HelpCircle,
  LogOut,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { books, getBookRoute } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { purchasedBookIds, followedAuthorIds, history } = useApp();

  const shelf = books.filter((b) => purchasedBookIds.includes(b.id));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <LinearGradient
          colors={[palette.bg, palette.bgElevated]}
          style={[styles.headerGrad, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400" }}
                style={styles.avatar}
              />
              <View style={styles.crownBadge}>
                <Crown color="#fff" size={12} fill="#fff" />
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.name}>Aziz Karimov</Text>
              <Text style={styles.handle}>@aziz.reads</Text>
              <View style={styles.premiumBadge}>
                <Sparkles color={palette.gold} size={11} />
                <Text style={styles.premiumText}>PREMIUM A'ZO</Text>
              </View>
            </View>
            <PressableScale style={styles.settingsBtn}>
              <Settings color={palette.text} size={18} />
            </PressableScale>
          </View>

          <View style={styles.statRow}>
            <Stat value={history.length.toString()} label="O'qilgan" />
            <Divider />
            <Stat value={purchasedBookIds.length.toString()} label="Sotib olingan" />
            <Divider />
            <Stat value={followedAuthorIds.length.toString()} label="Kuzatiladi" />
          </View>
        </LinearGradient>

        <Text style={styles.sectionLabel}>YUTUQLAR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          <Badge icon={<Flame color={palette.primary} size={22} />} title="7 kun ketma-ket" subtitle="O'qish seriyasi" />
          <Badge icon={<Award color={palette.gold} size={22} />} title="10 kitob" subtitle="Yutuq ochildi" locked={false} />
          <Badge icon={<Sparkles color={palette.secondary} size={22} />} title="Shoir" subtitle="25 she'r o'qildi" />
          <Badge icon={<Crown color={palette.gold} size={22} />} title="Premium" subtitle="VIP a'zo" />
        </ScrollView>

        <Text style={styles.sectionLabel}>MENING TOKCHAM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {shelf.map((b) => (
            <PressableScale key={b.id} onPress={() => router.push(getBookRoute(b))} style={{ width: 110 }}>
              <Image source={{ uri: b.cover }} style={{ width: 110, height: 160, borderRadius: 10 }} />
              <Text numberOfLines={1} style={{ color: palette.text, fontSize: 12, marginTop: 8, fontWeight: "600" }}>
                {b.title}
              </Text>
            </PressableScale>
          ))}
          {shelf.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>Tokcha bo'sh</Text>
          ) : null}
        </ScrollView>

        <Text style={styles.sectionLabel}>SOZLAMALAR</Text>
        <View style={styles.menu}>
          <MenuRow icon={<Bell color={palette.text} size={18} />} label="Bildirishnomalar" />
          <MenuRow icon={<Download color={palette.text} size={18} />} label="Yuklab olingan" />
          <MenuRow icon={<Globe color={palette.text} size={18} />} label="Til: O'zbekcha" />
          <MenuRow icon={<Shield color={palette.text} size={18} />} label="Maxfiylik" />
          <MenuRow icon={<HelpCircle color={palette.text} size={18} />} label="Yordam" />
          <MenuRow icon={<LogOut color={palette.primary} size={18} />} label="Chiqish" danger last />
        </View>

        <Text style={styles.version}>Adabiyot AI · v1.0</Text>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function Divider() {
  return <View style={{ width: 1, height: 30, backgroundColor: palette.border }} />;
}

function Badge({
  icon,
  title,
  subtitle,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  locked?: boolean;
}) {
  return (
    <View style={[styles.badge, locked && { opacity: 0.4 }]}>
      <View style={styles.badgeIcon}>{icon}</View>
      <Text style={styles.badgeTitle}>{title}</Text>
      <Text style={styles.badgeSub}>{subtitle}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  danger,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <PressableScale style={[styles.menuRow, last ? {} : styles.menuDivider]}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={[styles.menuLabel, danger && { color: palette.primary }]}>{label}</Text>
      <ChevronRight color={palette.textMuted} size={16} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headerGrad: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { width: 72, height: 72 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: palette.primary,
  },
  crownBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.bgCard,
  },
  name: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: FONT.serif,
    letterSpacing: -0.3,
  },
  handle: { color: palette.textDim, fontSize: 13, marginTop: 2 },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: palette.soft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  premiumText: { color: palette.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    backgroundColor: palette.bgCard,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: FONT.serif,
  },
  statLabel: { color: palette.textMuted, fontSize: 11, marginTop: 4, letterSpacing: 0.3 },
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  badge: {
    width: 110,
    backgroundColor: palette.bgCard,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },
  badgeSub: { color: palette.textMuted, fontSize: 10, marginTop: 2, textAlign: "center" },
  menu: {
    marginHorizontal: 20,
    backgroundColor: palette.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  menuIcon: { width: 28 },
  menuLabel: { color: palette.text, fontSize: 14, fontWeight: "500", flex: 1 },
  version: {
    color: palette.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 30,
    letterSpacing: 1,
  },
});
