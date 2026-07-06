import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { TabBarVisibilityContext } from "@/providers/TabBarVisibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials } from "@/types/profile";
import { useResponsive } from "@/hooks/useResponsive";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface MainTab {
  name: string;
  label: string;
  active: IoniconName;
  inactive: IoniconName;
  size?: number;
}

// The 4 tabs that live inside the pill. Profile is rendered separately (avatar).
const MAIN_TABS: MainTab[] = [
  { name: "index", label: "Bosh sahifa", active: "home", inactive: "home-outline" },
  { name: "reels", label: "Reels", active: "film", inactive: "film-outline" },
  { name: "tokcha", label: "Tokcha", active: "book", inactive: "book-outline" },
  { name: "sozlab", label: "So'zLab", active: "chatbubble", inactive: "chatbubble-outline" },
];

const PILL_RADIUS = 30;

/** Rounded translucent "liquid glass" surface used by the pill and the avatar. */
function Glass({
  isDark,
  radius,
  style,
  children,
}: {
  isDark: boolean;
  radius: number;
  style?: any;
  children?: React.ReactNode;
}) {
  const overlay = isDark ? "rgba(18,24,32,0.55)" : "rgba(255,255,255,0.62)";
  const solid = isDark ? "rgba(20,26,34,0.97)" : "rgba(255,255,255,0.98)";
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
  return (
    <View style={[style, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: border }]}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={44} tint={isDark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { borderRadius: radius }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay, borderRadius: radius }]} />
        </BlurView>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: solid, borderRadius: radius }]} />
      )}
      {children}
    </View>
  );
}

function TabButton({
  label,
  focused,
  color,
  onPress,
  children,
}: {
  label: string;
  focused: boolean;
  color: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [tb.btn, pressed && { opacity: 0.55 }]}
      hitSlop={4}
    >
      <View style={[tb.iconWrap, focused && { backgroundColor: "rgba(82,183,136,0.16)" }]}>
        {children}
      </View>
      <Text style={[tb.label, { color, fontWeight: focused ? "800" : "600" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Separate circular Profile button that shows the user's avatar (not an icon). */
function ProfileButton({
  focused,
  onPress,
}: {
  focused: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { profile } = useProfile();
  const uri = profile.avatarUrl;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.65 }} hitSlop={4}>
      <Glass isDark={isDark} radius={PILL_RADIUS} style={pb.circle}>
        <View style={[pb.ring, focused && { borderColor: colors.primary }]}>
          {uri ? (
            <Image source={{ uri }} style={pb.avatar} contentFit="cover" />
          ) : (
            <View style={[pb.avatar, pb.avatarFallback, { backgroundColor: colors.primary }]}>
              <Text style={pb.avatarInitials}>{getInitials(profile.displayName)}</Text>
            </View>
          )}
        </View>
      </Glass>
    </Pressable>
  );
}

function FloatingTabBar({ state, navigation }: { state: any; navigation: any }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const currentName: string = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r: any) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (currentName !== name && !event.defaultPrevented) {
      navigation.navigate(name);
    }
  };

  return (
    <View style={[bar.root, { bottom: Math.max(insets.bottom - 10, 8) }]} pointerEvents="box-none">
      <View style={bar.pillShadow}>
        <Glass isDark={isDark} radius={PILL_RADIUS} style={bar.pill}>
          {MAIN_TABS.map((tab) => {
            const focused = currentName === tab.name;
            const color = focused ? colors.primary : colors.textDim;
            return (
              <TabButton key={tab.name} label={tab.label} focused={focused} color={color} onPress={() => go(tab.name)}>
                <Ionicons name={focused ? tab.active : tab.inactive} size={tab.size ?? 23} color={color} />
              </TabButton>
            );
          })}
        </Glass>
      </View>

      <View style={bar.profileShadow}>
        <ProfileButton focused={currentName === "profile"} onPress={() => go("profile")} />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { isWebLayout } = useResponsive();
  const [tabBarHidden, setTabBarHidden] = useState(false);

  const screens = [
    <Tabs.Screen key="index" name="index" options={{ title: "Bosh sahifa" }} />,
    <Tabs.Screen key="reels" name="reels" options={{ title: "Reels" }} />,
    <Tabs.Screen key="tokcha" name="tokcha" options={{ title: "Tokcha" }} />,
    <Tabs.Screen key="sozlab" name="sozlab" options={{ title: "So'zLab" }} />,
    <Tabs.Screen key="profile" name="profile" options={{ title: "Profil" }} />,
    <Tabs.Screen key="explore" name="explore" options={{ href: null }} />,
    <Tabs.Screen key="library" name="library" options={{ href: null }} />,
    <Tabs.Screen key="maqolalar" name="maqolalar" options={{ href: null }} />,
  ];

  // Web ≥ 768px: the global WebHeader (mounted in the root layout) provides the
  // top nav, so here we only hide the floating bottom pill. Native mobile keeps
  // the floating tab bar exactly as before (isWebLayout is always false off web).
  if (isWebLayout) {
    return (
      <TabBarVisibilityContext.Provider value={setTabBarHidden}>
        <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
          {screens}
        </Tabs>
      </TabBarVisibilityContext.Provider>
    );
  }

  return (
    <TabBarVisibilityContext.Provider value={setTabBarHidden}>
      <Tabs
        tabBar={(props) =>
          tabBarHidden ? null : <FloatingTabBar state={props.state} navigation={props.navigation} />
        }
        screenOptions={{ headerShown: false }}
      >
        {screens}
      </Tabs>
    </TabBarVisibilityContext.Provider>
  );
}

const bar = StyleSheet.create({
  root: {
    position: "absolute",
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  pillShadow: {
    flex: 1,
    borderRadius: PILL_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  pill: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  profileShadow: {
    borderRadius: PILL_RADIUS,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});

const tb = StyleSheet.create({
  btn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6 },
  iconWrap: {
    width: 40,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 9.5, letterSpacing: 0.1, textAlign: "center", maxWidth: "100%" },
});

const pb = StyleSheet.create({
  circle: { width: 62, height: 62, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ring: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
