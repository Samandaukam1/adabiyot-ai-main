import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import BrandLogo from "@/components/BrandLogo";
import { FONT } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { useBranding } from "@/providers/BrandingProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { isSafeInternalRoute, openExternalUrl } from "@/utils/safeLinks";
import { useHover } from "./useHover";
import { cursorPointer, hoverTransition } from "./webStyle";
import WebContainer from "./WebContainer";

interface FooterLink {
  label: string;
  href?: string;
  url?: string;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Platforma",
    links: [
      { label: "Bosh sahifa", href: "/(tabs)" },
      { label: "Tokcha", href: "/(tabs)/tokcha" },
      { label: "Reels", href: "/(tabs)/reels" },
      { label: "So'zlab", href: "/(tabs)/sozlab" },
      { label: "Adiblar", href: "/adib-encyclopedia" },
    ],
  },
  {
    title: "Ijodkorlar",
    links: [
      { label: "Ijodkor bo'lish", href: "/creator/become" },
      { label: "Muallif bo'lish", href: "/creator/become" },
      { label: "Nashriyotlar uchun" },
    ],
  },
  {
    title: "Hujjatlar",
    links: [
      { label: "Biz haqimizda" },
      { label: "Foydalanish shartlari" },
      { label: "Maxfiylik siyosati" },
      { label: "Aloqa" },
    ],
  },
];

function FooterLinkRow({ link }: { link: FooterLink }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  const navigable = !!link.href || !!link.url;
  const onPress = () => {
    if (link.href && isSafeInternalRoute(link.href)) router.push(link.href as any);
    else if (link.url) void openExternalUrl(link.url);
  };
  return (
    <Pressable
      onPress={navigable ? onPress : undefined}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[{ paddingVertical: 6 }, navigable ? cursorPointer : null]}
    >
      <Text style={[{ color: hovered && navigable ? L.primary : L.textDim, fontSize: 14 }, hoverTransition]}>
        {link.label}
      </Text>
    </Pressable>
  );
}

function Social({ name, url }: { name: React.ComponentProps<typeof Ionicons>["name"]; url: string }) {
  const { colors: L } = useTheme();
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={() => void openExternalUrl(url)}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hovered ? L.primary : L.soft,
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <Ionicons name={name} size={18} color={hovered ? "#fff" : L.primary} />
    </Pressable>
  );
}

/** Desktop footer. Null on native / narrow web so the mobile app has no footer. */
export default function WebFooter() {
  const { colors: L, isDark } = useTheme();
  const { appName } = useBranding();
  const { isWebLayout, isTablet } = useResponsive();
  if (!isWebLayout) return null;

  return (
    <View
      style={{
        backgroundColor: isDark ? "#0A0E14" : "#F5F8F6",
        borderTopWidth: 1,
        borderTopColor: L.border,
        paddingVertical: isTablet ? 48 : 64,
        marginTop: 40,
      }}
    >
      <WebContainer>
        <View
          style={{
            flexDirection: isTablet ? "column" : "row",
            justifyContent: "space-between",
            gap: isTablet ? 40 : 24,
          }}
        >
          {/* Brand block */}
          <View style={{ maxWidth: 320, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <BrandLogo variant="logo" size={34} radius={10} />
              <Text style={{ color: L.text, fontSize: 20, fontWeight: "900", fontFamily: FONT.serif }}>{appName}</Text>
            </View>
            <Text style={{ color: L.textDim, fontSize: 14, lineHeight: 22 }}>
              O'zbek adabiyoti uchun yangi raqamli makon. Kitoblar, she'rlar, romanlar, ssenariylar va
              ijodkorlar bir platformada.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Social name="logo-instagram" url="https://instagram.com" />
              <Social name="logo-youtube" url="https://youtube.com" />
              <Social name="paper-plane-outline" url="https://t.me" />
            </View>
          </View>

          {/* Link columns */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: isTablet ? 40 : 64 }}>
            {COLUMNS.map((col) => (
              <View key={col.title} style={{ gap: 4, minWidth: 150 }}>
                <Text style={{ color: L.text, fontSize: 14, fontWeight: "800", marginBottom: 8 }}>{col.title}</Text>
                {col.links.map((link) => (
                  <FooterLinkRow key={col.title + link.label} link={link} />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: L.border,
            marginTop: 40,
            paddingTop: 24,
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Text style={{ color: L.textMuted, fontSize: 13 }}>
            © {new Date().getFullYear()} {appName}. Barcha huquqlar himoyalangan.
          </Text>
          <Text style={{ color: L.textMuted, fontSize: 13 }}>O'zbekiston · adabiyot uchun</Text>
        </View>
      </WebContainer>
    </View>
  );
}
