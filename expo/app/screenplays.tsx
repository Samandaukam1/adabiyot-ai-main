import { router } from "expo-router";
import {
  ArrowLeft,
  Baby,
  BookOpen,
  Building2,
  Camera,
  ChevronRight,
  Clapperboard,
  Drama,
  Flag,
  GraduationCap,
  Play,
  School,
  Sparkles,
  Smartphone,
  Theater,
  Tv,
  Video,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";

const { width: SCREEN_W } = Dimensions.get("window");

type IconComponent = React.ComponentType<{ color: string; size: number; strokeWidth?: number }>;

interface ScreenplaySubcategory {
  id: string;
  title: string;
  icon: IconComponent;
}

interface ScreenplayGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: IconComponent;
  subcategories: ScreenplaySubcategory[];
}

const GROUPS: ScreenplayGroup[] = [
  {
    id: "kino-video",
    title: "Kino va video",
    subtitle: "Film, serial va qisqa video matnlari",
    icon: Camera,
    subcategories: [
      { id: "kino", title: "Kino ssenariylari", icon: Clapperboard },
      { id: "multfilm", title: "Multfilm ssenariylari", icon: Sparkles },
      { id: "mobil-serial", title: "Mobil serial ssenariylari", icon: Smartphone },
      { id: "vayn", title: "Vayn ssenariylari", icon: Video },
      { id: "serial", title: "Serial ssenariylari", icon: Tv },
    ],
  },
  {
    id: "sahna-spektakl",
    title: "Sahna va spektakl",
    subtitle: "Teatr, dialog va sahna ko'rinishi",
    icon: Theater,
    subcategories: [
      { id: "spektakl", title: "Spektakl ssenariylari", icon: Drama },
      { id: "sahna-korinishi", title: "Sahna ko'rinishi ssenariylari", icon: Theater },
    ],
  },
  {
    id: "talimiy",
    title: "Ta'limiy tadbirlar",
    subtitle: "Maktab, bog'cha va OTM dasturlari",
    icon: School,
    subcategories: [
      { id: "maktab", title: "Maktab tadbiri ssenariylari", icon: BookOpen },
      { id: "bogcha", title: "Bog'cha tadbiri ssenariylari", icon: Baby },
      { id: "otm", title: "OTM tadbiri ssenariylari", icon: GraduationCap },
    ],
  },
  {
    id: "rasmiy",
    title: "Rasmiy tadbirlar",
    subtitle: "Davlat va protokol tadbirlari",
    icon: Building2,
    subcategories: [
      { id: "davlat", title: "Davlat tadbiri ssenariylari", icon: Flag },
    ],
  },
];

export default function ScreenplaysHub() {
  const insets = useSafeAreaInsets();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => GROUPS.find((group) => group.id === selectedGroupId) ?? null,
    [selectedGroupId]
  );
  const selectedSubcategory = useMemo(
    () =>
      selectedGroup?.subcategories.find((subcategory) => subcategory.id === selectedSubcategoryId) ??
      null,
    [selectedGroup, selectedSubcategoryId]
  );

  const selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const group = GROUPS.find((item) => item.id === groupId);
    setSelectedSubcategoryId(group?.subcategories[0]?.id ?? null);
  };

  const resetGroup = () => {
    setSelectedGroupId(null);
    setSelectedSubcategoryId(null);
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 130 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>SSENARIYLAR</Text>
            <Text style={styles.title}>Ijodiy ssenariy markazi</Text>
            <Text style={styles.subtitle}>
              Kerakli yo'nalishni tanlang, keyin mos ssenariy turiga o'ting.
            </Text>
          </View>
        </View>

        {!selectedGroup ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Asosiy yo'nalishlar</Text>
              <Text style={styles.sectionHint}>4 ta guruh</Text>
            </View>
            <View style={styles.groupGrid}>
              {GROUPS.map((group) => (
                <MainGroupCard key={group.id} group={group} onPress={() => selectGroup(group.id)} />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.breadcrumb}>
              <Pressable onPress={resetGroup} hitSlop={10}>
                <Text style={styles.breadcrumbBack}>Asosiy guruhlar</Text>
              </Pressable>
              <ChevronRight color={palette.textMuted} size={15} />
              <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
                {selectedGroup.title}
              </Text>
            </View>

            <SelectedGroupHero group={selectedGroup} onChange={resetGroup} />

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Ichki bo'limlar</Text>
              <Text style={styles.sectionHint}>{selectedGroup.subcategories.length} ta tur</Text>
            </View>

            <View style={styles.subGrid}>
              {selectedGroup.subcategories.map((subcategory) => (
                <SubcategoryCard
                  key={subcategory.id}
                  subcategory={subcategory}
                  active={selectedSubcategoryId === subcategory.id}
                  onPress={() => setSelectedSubcategoryId(subcategory.id)}
                />
              ))}
            </View>

            {selectedSubcategory ? (
              <View style={styles.actionPanel}>
                <View style={styles.actionIcon}>
                  <selectedSubcategory.icon color={palette.primary} size={20} strokeWidth={2.2} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionTitle}>{selectedSubcategory.title}</Text>
                  <Text style={styles.actionText}>
                    Tanlangan yo'nalish asosida mos ssenariylar va namunalar ko'rsatiladi.
                  </Text>
                </View>
                <PressableScale
                  onPress={() => router.push({ pathname: "/screenplay/[id]", params: { id: "b9" } })}
                  style={styles.actionButton}
                >
                  <Play color="#fff" size={15} fill="#fff" />
                </PressableScale>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MainGroupCard({ group, onPress }: { group: ScreenplayGroup; onPress: () => void }) {
  const Icon = group.icon;

  return (
    <PressableScale onPress={onPress} style={styles.groupCard}>
      <View style={styles.groupTopRow}>
        <View style={styles.groupIcon}>
          <Icon color={palette.primary} size={24} strokeWidth={2.1} />
        </View>
        <ChevronRight color={palette.primary} size={19} />
      </View>
      <Text style={styles.groupTitle}>{group.title}</Text>
      <Text style={styles.groupSubtitle} numberOfLines={2}>
        {group.subtitle}
      </Text>
      <View style={styles.groupFoot}>
        <Text style={styles.groupCount}>{group.subcategories.length} tur</Text>
      </View>
    </PressableScale>
  );
}

function SelectedGroupHero({ group, onChange }: { group: ScreenplayGroup; onChange: () => void }) {
  const Icon = group.icon;

  return (
    <View style={styles.selectedHero}>
      <View style={styles.selectedIcon}>
        <Icon color="#fff" size={26} strokeWidth={2.1} />
      </View>
      <View style={styles.selectedTextWrap}>
        <Text style={styles.selectedTitle}>{group.title}</Text>
        <Text style={styles.selectedSubtitle}>{group.subtitle}</Text>
      </View>
      <Pressable onPress={onChange} style={styles.changeButton}>
        <Text style={styles.changeButtonText}>Almashtirish</Text>
      </Pressable>
    </View>
  );
}

function SubcategoryCard({
  subcategory,
  active,
  onPress,
}: {
  subcategory: ScreenplaySubcategory;
  active: boolean;
  onPress: () => void;
}) {
  const Icon = subcategory.icon;

  return (
    <PressableScale
      onPress={onPress}
      style={active ? [styles.subCard, styles.subCardActive] : styles.subCard}
    >
      <View style={active ? [styles.subIcon, styles.subIconActive] : styles.subIcon}>
        <Icon color={active ? "#fff" : palette.primary} size={18} strokeWidth={2.1} />
      </View>
      <Text style={active ? [styles.subTitle, styles.subTitleActive] : styles.subTitle} numberOfLines={2}>
        {subcategory.title}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  headerCopy: {
    backgroundColor: "rgba(255,255,255,0.60)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
  },
  kicker: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    fontWeight: "500",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 19,
    fontFamily: FONT.serif,
    fontWeight: "800",
    letterSpacing: 0,
  },
  sectionHint: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  groupGrid: {
    paddingHorizontal: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  groupCard: {
    width: (SCREEN_W - 38) / 2,
    minHeight: 176,
    borderRadius: 20,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  groupTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 15,
    lineHeight: 21,
  },
  groupSubtitle: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: "500",
  },
  groupFoot: {
    alignSelf: "flex-start",
    marginTop: "auto",
    borderRadius: 999,
    backgroundColor: "rgba(46,125,50,0.09)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  groupCount: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  breadcrumbBack: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  breadcrumbCurrent: {
    flex: 1,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  selectedHero: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: palette.primary,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: palette.primary,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  selectedIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
  selectedSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontWeight: "600",
  },
  changeButton: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  changeButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  subGrid: {
    paddingHorizontal: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  subCard: {
    width: (SCREEN_W - 38) / 2,
    minHeight: 92,
    borderRadius: 17,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subCardActive: {
    borderColor: palette.borderStrong,
    backgroundColor: "#FAFFFA",
  },
  subIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  subIconActive: {
    backgroundColor: palette.primary,
  },
  subTitle: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  subTitleActive: {
    color: palette.primary,
  },
  actionPanel: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
  },
  actionText: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    fontWeight: "600",
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
