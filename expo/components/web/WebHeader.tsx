import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useResponsive } from "@/hooks/useResponsive";
import { useBranding } from "@/providers/BrandingProvider";
import { useJaxongirAI } from "@/providers/JaxongirAIProvider";
import { useProfile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { getInitials } from "@/types/profile";
import { useHover } from "./useHover";
import WebSearchOverlay from "./WebSearchOverlay";
import { cursorPointer, hoverTransition } from "./webStyle";

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
  { label: "Ariza qoldirish", href: "/author-application", match: "/author-application" },
];

/** The translucent rounded container that groups the nav / action clusters. */
const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const UZ_WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

// Live date + time pill for the header.
function HeaderClock() {
  const { colors: L, isDark } = useTheme();
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <View
      style={{
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(13,27,42,0.035)",
        borderWidth: 1,
        borderColor: L.border,
      }}
    >
      <Text style={{ color: L.text, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {hh}:{mm}
      </Text>
      <Text style={{ color: L.textDim, fontSize: 10.5, fontWeight: "600", marginTop: 1 }}>
        {UZ_WEEKDAYS[now.getDay()]}, {now.getDate()}-{UZ_MONTHS[now.getMonth()]}
      </Text>
    </View>
  );
}

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

function NavLink({ item, active, onPress }: { item: NavItem; active: boolean; onPress?: () => void }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={() => (onPress ? onPress() : router.push(item.href as any))}
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
  const { appName, logoSource, defaultLogoSource } = useBranding();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const { isWebLayout } = useResponsive();
  const { profile } = useProfile();
  const { open: openJaxongirAI, isOpen: jaxongirOpen } = useJaxongirAI();
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
          backgroundColor: "transparent",
          zIndex: 100,
        },
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
        {/* Brand — in its own pill, matching the nav / actions pills */}
        <Pressable
          onPress={() => router.push("/(tabs)")}
          style={[pillStyle(L.border, isDark), { paddingHorizontal: 18, paddingVertical: 7 }, cursorPointer]}
          accessibilityLabel={appName}
        >
          {/* Admin-panel logo PNG (not an icon + text wordmark) */}
          <Image
            source={logoFailed ? defaultLogoSource : logoSource}
            style={{ height: 38, width: 154 }}
            contentFit="contain"
            transition={120}
            onError={() => setLogoFailed(true)}
          />
        </Pressable>

        {/* Center nav — its own grouped pill */}
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>
          <View style={pillStyle(L.border, isDark)}>
            {NAV.map((item) => (
              <NavLink key={item.href + item.label} item={item} active={isActive(item.match)} />
            ))}
            <NavLink
              item={{ label: "Jaxongir AI", href: "", match: "__jaxongir_ai__" }}
              active={jaxongirOpen}
              onPress={openJaxongirAI}
            />
          </View>
        </View>

        {/* Right cluster — clock + actions pill + a separate profile circle */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <HeaderClock />
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
