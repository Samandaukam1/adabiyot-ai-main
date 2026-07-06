import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import BrandLogo from "@/components/BrandLogo";
import { FONT } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { useBranding } from "@/providers/BrandingProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials } from "@/types/profile";
import { useHover } from "./useHover";
import WebSearchOverlay from "./WebSearchOverlay";
import { cursorPointer, glassBlur, hoverTransition } from "./webStyle";

export const WEB_HEADER_HEIGHT = 68;

interface NavItem {
  label: string;
  href: string;
  match: string;
}

// Center navigation. Every target is a real route today; dedicated Kitoblar /
// She'rlar list pages arrive in a later phase and will slot in here.
const NAV: NavItem[] = [
  { label: "Bosh sahifa", href: "/(tabs)", match: "/" },
  { label: "Kitoblar", href: "/kitoblar", match: "/kitoblar" },
  { label: "Reels", href: "/(tabs)/reels", match: "/reels" },
  { label: "Tokcha", href: "/(tabs)/tokcha", match: "/tokcha" },
  { label: "So'zlab", href: "/(tabs)/sozlab", match: "/sozlab" },
  { label: "Adiblar", href: "/adiblar", match: "/adiblar" },
];

/** The translucent rounded container that groups the nav / action clusters. */
function pillStyle(border: string, isDark: boolean) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    padding: 5,
    borderRadius: 26,
    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(13,27,42,0.035)",
    borderWidth: 1,
    borderColor: border,
  };
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={() => router.push(item.href as any)}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          paddingHorizontal: 16,
          paddingVertical: 9,
          borderRadius: 18,
          backgroundColor: active ? "rgba(82,183,136,0.16)" : hovered ? L.surface : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <Text
        style={[
          { color: active ? L.primary : hovered ? L.text : L.textDim, fontSize: 14, fontWeight: active ? "800" : "700" },
          hoverTransition,
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function IconButton({
  name,
  onPress,
  dot,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  dot?: boolean;
}) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hovered ? L.soft : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <Ionicons name={name} size={19} color={L.primary} />
      {dot ? (
        <View
          style={{
            position: "absolute",
            top: 9,
            right: 9,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: L.gold,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The premium desktop top navigation. Replaces the mobile floating tab bar on
 * web ≥ 768px; returns null everywhere else so native is untouched.
 */
export default function WebHeader() {
  const { colors: L, isDark, toggleTheme } = useTheme();
  const { appName } = useBranding();
  const { isWebLayout } = useResponsive();
  const { profile } = useProfile();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);

  if (!isWebLayout) return null;

  const isActive = (match: string) =>
    match === "/" ? pathname === "/" || pathname === "/index" : pathname.startsWith(match);

  return (
    <>
    <View
      style={[
        {
          height: WEB_HEADER_HEIGHT,
          backgroundColor: isDark ? "rgba(13,17,23,0.82)" : "rgba(255,255,255,0.85)",
          borderBottomWidth: 1,
          borderBottomColor: L.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          zIndex: 100,
        },
        glassBlur,
      ]}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1440,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 32,
          gap: 28,
        }}
      >
        {/* Brand */}
        <Pressable
          onPress={() => router.push("/(tabs)")}
          style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, cursorPointer]}
        >
          <BrandLogo variant="logo" size={34} radius={10} />
          <Text style={{ color: L.text, fontSize: 20, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.4 }}>
            {appName}
          </Text>
        </Pressable>

        {/* Center nav — its own grouped pill */}
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>
          <View style={pillStyle(L.border, isDark)}>
            {NAV.map((item) => (
              <NavLink key={item.href + item.label} item={item} active={isActive(item.match)} />
            ))}
          </View>
        </View>

        {/* Right cluster — actions pill + a separate profile circle */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={pillStyle(L.border, isDark)}>
            <IconButton name="search-outline" onPress={() => setSearchOpen(true)} />
            <IconButton name="notifications-outline" onPress={() => router.push("/notifications")} />
            <IconButton name={isDark ? "sunny-outline" : "moon-outline"} onPress={toggleTheme} />
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={[
              { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: L.primary, overflow: "hidden" },
              cursorPointer,
            ]}
          >
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, backgroundColor: L.primary, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{getInitials(profile.displayName)}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
    {searchOpen ? <WebSearchOverlay onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}
