import { Redirect } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { FONT } from "@/components/ui";
import WebBookGrid, { WebBookGridSkeleton } from "@/components/web/WebBookGrid";
import WebContainer from "@/components/web/WebContainer";
import WebFooter from "@/components/web/WebFooter";
import { cursorPointer, hoverTransition } from "@/components/web/webStyle";
import { useHover } from "@/components/web/useHover";
import { useResponsive } from "@/hooks/useResponsive";
import { usePublishedBooks } from "@/hooks/usePublishedBooks";
import { useTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/constants/colors";

type PriceFilter = "all" | "free" | "paid";
type SortKey = "new" | "az";

const SIDEBAR_W = 244;
const COL_GAP = 32;

/**
 * Premium web "Kitoblar" catalog: filter sidebar + sort + responsive grid.
 * Web-only — on native (or a narrow browser) it redirects to the existing
 * library tab so the mobile experience is untouched.
 */
export default function KitoblarCatalog() {
  const { isWebLayout } = useResponsive();
  if (!isWebLayout) return <Redirect href="/(tabs)/tokcha" />;
  return <WebCatalog />;
}

function WebCatalog() {
  const { colors: L } = useTheme();
  const { width, contentMaxWidth, isDesktopWeb, isLargeDesktop, isTablet } = useResponsive();
  const { books, loading } = usePublishedBooks();

  const [genre, setGenre] = useState("Hammasi");
  const [price, setPrice] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<SortKey>("new");

  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.genre && set.add(b.genre));
    return ["Hammasi", ...Array.from(set)];
  }, [books]);

  const filtered = useMemo(() => {
    let list = books;
    if (genre !== "Hammasi") list = list.filter((b) => b.genre === genre);
    if (price === "free") list = list.filter((b) => b.isFree);
    else if (price === "paid") list = list.filter((b) => !b.isFree);
    const sorted = [...list];
    if (sort === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return sorted;
  }, [books, genre, price, sort]);

  const pad = isTablet ? 24 : 40;
  const inner = Math.min(width, contentMaxWidth) - pad * 2;
  const twoCol = isDesktopWeb;
  const gridAvail = twoCol ? inner - SIDEBAR_W - COL_GAP : inner;
  const cols = isLargeDesktop ? 4 : 3;

  const sidebar = (
    <View style={{ width: twoCol ? SIDEBAR_W : "100%", gap: 28 }}>
      <FilterGroup title="Kategoriya">
        {genres.map((g) => (
          <RadioRow key={g} label={g} active={genre === g} onPress={() => setGenre(g)} L={L} />
        ))}
      </FilterGroup>
      <FilterGroup title="Narx">
        {(
          [
            { key: "all", label: "Hammasi" },
            { key: "free", label: "Bepul" },
            { key: "paid", label: "Pullik" },
          ] as { key: PriceFilter; label: string }[]
        ).map((o) => (
          <RadioRow key={o.key} label={o.label} active={price === o.key} onPress={() => setPrice(o.key)} L={L} />
        ))}
      </FilterGroup>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: L.bg }}>
      <View style={{ paddingTop: isDesktopWeb ? 44 : 32 }}>
        <WebContainer>
          {/* Page head */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: L.text, fontSize: isDesktopWeb ? 40 : 32, fontWeight: "900", fontFamily: FONT.serif, letterSpacing: -0.8 }}>
              Kitoblar
            </Text>
            <Text style={{ color: L.textDim, fontSize: 16, marginTop: 8 }}>
              O'zbek adabiyotining eng saralangan asarlari
            </Text>
          </View>

          <View style={{ flexDirection: twoCol ? "row" : "column", gap: COL_GAP }}>
            {sidebar}

            {/* Main */}
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 22,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <Text style={{ color: L.textDim, fontSize: 14, fontWeight: "600" }}>
                  {loading ? "Yuklanmoqda…" : `${filtered.length} ta asar`}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <SortPill label="Yangi" active={sort === "new"} onPress={() => setSort("new")} L={L} />
                  <SortPill label="Nomi (A–Z)" active={sort === "az"} onPress={() => setSort("az")} L={L} />
                </View>
              </View>

              {loading && filtered.length === 0 ? (
                <WebBookGridSkeleton count={cols * 2} />
              ) : filtered.length > 0 ? (
                <WebBookGrid books={filtered} availableWidth={gridAvail} columns={cols} />
              ) : (
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 10 }}>
                  <Text style={{ color: L.textMuted, fontSize: 15 }}>Bu filtrlarga mos kitob topilmadi</Text>
                </View>
              )}
            </View>
          </View>
        </WebContainer>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: L } = useTheme();
  return (
    <View>
      <Text style={{ color: L.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12 }}>
        {title}
      </Text>
      <View style={{ gap: 2 }}>{children}</View>
    </View>
  );
}

function RadioRow({
  label,
  active,
  onPress,
  L,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  L: AppTheme;
}) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: active ? L.soft : hovered ? L.surface : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: active ? L.primary : L.borderStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: L.primary }} /> : null}
      </View>
      <Text style={{ color: active ? L.text : L.textDim, fontSize: 14, fontWeight: active ? "700" : "500" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SortPill({
  label,
  active,
  onPress,
  L,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  L: AppTheme;
}) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? L.primary : L.border,
          backgroundColor: active ? L.primary : hovered ? L.surface : "transparent",
        },
        cursorPointer,
        hoverTransition,
      ]}
    >
      <Text style={{ color: active ? "#fff" : L.textDim, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
