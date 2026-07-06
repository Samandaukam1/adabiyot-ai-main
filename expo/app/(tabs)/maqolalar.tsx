import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ArrowUpDown,
  Clock,
  Filter,
  Lock,
  Search,
  Star,
  TrendingUp,
  User,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale, Screen } from "@/components/ui";
import type { AppTheme } from "@/constants/colors";
import { articleCategories, type ArticleCategory } from "@/mocks/content";
import { usePublishedArticles } from "@/hooks/useArticleContent";
import type { DisplayArticle } from "@/lib/articles";
import { useContentAccessChecker } from "@/hooks/usePayments";
import { useTheme } from "@/providers/ThemeProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const FEATURED_H = Math.min(430, Math.round(SCREEN_W * 0.92));

type CategoryFilter = "Hammasi" | ArticleCategory;
type SortOption = "Yangi" | "Mashhur" | "Eng ko'p o'qilgan" | "Eng foydali";

const CATEGORY_FILTERS: CategoryFilter[] = ["Hammasi", ...articleCategories];
const SORT_OPTIONS: SortOption[] = ["Yangi", "Mashhur", "Eng ko'p o'qilgan", "Eng foydali"];

export default function ArticlesScreen() {
  const insets = useSafeAreaInsets();
  const hasAccess = useContentAccessChecker();
  const [query, setQuery] = useState<string>("");
  const [category, setCategory] = useState<CategoryFilter>("Hammasi");
  const [sort, setSort] = useState<SortOption>("Yangi");
  const { articles } = usePublishedArticles();
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);

  const featured = articles[0];

  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = articles.filter((article) => {
      const matchesCategory = category === "Hammasi" || article.category === category;
      const matchesQuery =
        !normalizedQuery ||
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.description.toLowerCase().includes(normalizedQuery) ||
        article.author.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "Mashhur") return b.popularity - a.popularity;
      if (sort === "Eng ko'p o'qilgan") return b.reads - a.reads;
      if (sort === "Eng foydali") return b.usefulness - a.usefulness;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [articles, category, query, sort]);

  const openArticle = (id: string) => {
    router.push({ pathname: "/article/[id]", params: { id } });
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 128 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>PREMIUM BILIM</Text>
            <Text style={styles.h1}>Maqolalar</Text>
          </View>
          <View style={styles.headerIcon}>
            <Star color={c.primary} size={21} fill={c.primary} />
          </View>
        </View>

        <Text style={styles.subtitle}>
          Tadqiqot, amaliy yo'riqnoma va chuqur tahlillar uchun alohida bilim kutubxonasi.
        </Text>

        <View style={styles.searchWrap}>
          <Search color={c.textMuted} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Maqola, muallif yoki mavzu..."
            placeholderTextColor={c.textMuted}
            style={styles.searchInput}
            testID="articles-search"
          />
        </View>

        <FeaturedArticle
          article={featured}
          purchased={!featured.requiresPurchase || hasAccess("article", featured.id)}
          onPress={() => openArticle(featured.id)}
          c={c}
        />

        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Filter color={c.primary} size={17} />
            <Text style={styles.sectionTitle}>Yo'nalishlar</Text>
          </View>
          <Text style={styles.sectionHint}>{visibleArticles.length} ta maqola</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CATEGORY_FILTERS.map((item) => (
            <FilterChip
              key={item}
              label={item}
              active={category === item}
              onPress={() => setCategory(item)}
              c={c}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <ArrowUpDown color={c.primary} size={17} />
            <Text style={styles.sectionTitle}>Tartiblash</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {SORT_OPTIONS.map((item) => (
            <FilterChip
              key={item}
              label={item}
              active={sort === item}
              onPress={() => setSort(item)}
              c={c}
            />
          ))}
        </ScrollView>

        <View style={styles.articleList}>
          {visibleArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              purchased={!article.requiresPurchase || hasAccess("article", article.id)}
              onPress={() => openArticle(article.id)}
              c={c}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function FeaturedArticle({
  article,
  purchased,
  onPress,
  c,
}: {
  article: DisplayArticle;
  purchased: boolean;
  onPress: () => void;
  c: AppTheme;
}) {
  return (
    <PressableScale onPress={onPress} style={{ height: FEATURED_H, marginHorizontal: 20, marginTop: 20, borderRadius: 22, overflow: "hidden", backgroundColor: c.bgCard, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 }} testID={`article-featured-${article.id}`}>
      <Image source={{ uri: article.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient
        colors={["rgba(10,24,12,0.10)", "rgba(10,24,12,0.82)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ height: 31, borderRadius: 999, paddingHorizontal: 11, backgroundColor: "rgba(46,125,50,0.88)", flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TrendingUp color="#fff" size={13} />
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }}>LONGREAD</Text>
        </View>
        <View style={{ minHeight: 31, borderRadius: 999, paddingHorizontal: 11, backgroundColor: "rgba(255,255,255,0.92)", flexDirection: "row", alignItems: "center", gap: 5 }}>
          {purchased ? null : <Lock color={c.primary} size={12} />}
          <Text style={{ color: c.primary, fontSize: 11, fontWeight: "900" }}>
            {purchased ? (article.requiresPurchase ? "Sotib olingan" : "Ochiq") : formatPrice(article.price)}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: "auto" as any, padding: 18 }}>
        <Text style={{ color: "#B7F2B9", fontSize: 10, fontWeight: "900", letterSpacing: 1.3, marginBottom: 8 }}>{article.category.toUpperCase()}</Text>
        <Text style={{ color: "#fff", fontFamily: FONT.serif, fontSize: 27, lineHeight: 32, fontWeight: "800" }} numberOfLines={3}>
          {article.title}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.84)", fontSize: 13, lineHeight: 19, marginTop: 9, fontWeight: "500" }} numberOfLines={3}>
          {article.description}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
          {article.author ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <User color="rgba(255,255,255,0.82)" size={14} />
              <Text style={{ color: "rgba(255,255,255,0.84)", fontSize: 12, fontWeight: "700" }}>{article.author}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Clock color="rgba(255,255,255,0.82)" size={14} />
            <Text style={{ color: "rgba(255,255,255,0.84)", fontSize: 12, fontWeight: "700" }}>{article.readingTime}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function ArticleCard({
  article,
  purchased,
  onPress,
  c,
}: {
  article: DisplayArticle;
  purchased: boolean;
  onPress: () => void;
  c: AppTheme;
}) {
  return (
    <PressableScale onPress={onPress} style={{ minHeight: 174, borderRadius: 18, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 }} testID={`article-card-${article.id}`}>
      <Image source={{ uri: article.cover }} style={{ width: 124, minHeight: 174, backgroundColor: c.bgElevated }} contentFit="cover" />
      <View style={{ flex: 1, padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: c.primary, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }}>{article.category}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock color={c.textMuted} size={12} />
            <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: "800" }}>{article.readingTime}</Text>
          </View>
        </View>
        <Text style={{ color: c.text, fontFamily: FONT.serif, fontSize: 18, lineHeight: 22, fontWeight: "800", marginTop: 9 }} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={{ color: c.textDim, fontSize: 12, lineHeight: 18, fontWeight: "500", marginTop: 6 }} numberOfLines={3}>
          {article.description}
        </Text>
        <View style={{ marginTop: "auto" as any, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5 }}>
            {article.author ? (
              <>
                <User color={c.primary} size={13} />
                <Text style={{ flex: 1, color: c.textDim, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>{article.author}</Text>
              </>
            ) : null}
          </View>
          <View style={purchased ? { minHeight: 28, borderRadius: 999, paddingHorizontal: 10, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" } : { minHeight: 28, borderRadius: 999, paddingHorizontal: 9, backgroundColor: c.soft, borderWidth: 1, borderColor: c.borderStrong, flexDirection: "row", alignItems: "center", gap: 4 }}>
            {purchased ? null : <Lock color={c.primary} size={11} />}
            <Text style={{ color: purchased ? "#fff" : c.primary, fontSize: 10, fontWeight: "900" }}>
              {purchased ? "Ochiq" : formatPrice(article.price)}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: AppTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 36,
        borderRadius: 999,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: active ? c.primary : c.borderStrong,
        backgroundColor: active ? c.primary : c.bgCard,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: active ? "#fff" : c.primary, fontSize: 13, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatPrice(value: number): string {
  if (!value || value <= 0) return "Bepul";
  return `${value.toLocaleString()} so'm`;
}

function createStyles(c: AppTheme) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    kicker: {
      color: c.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.4,
    },
    h1: {
      color: c.text,
      fontFamily: FONT.serif,
      fontSize: 38,
      lineHeight: 44,
      fontWeight: "800",
      letterSpacing: 0,
      marginTop: 4,
    },
    headerIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: c.soft,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    subtitle: {
      color: c.textDim,
      fontSize: 14,
      lineHeight: 21,
      paddingHorizontal: 20,
      marginTop: 8,
      fontWeight: "500",
    },
    searchWrap: {
      height: 52,
      marginHorizontal: 20,
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 15,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontWeight: "500",
    },
    sectionHead: {
      paddingHorizontal: 20,
      marginTop: 24,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    sectionTitle: {
      color: c.text,
      fontFamily: FONT.serif,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 0,
    },
    sectionHint: {
      color: c.primary,
      fontSize: 11,
      fontWeight: "900",
    },
    chipRow: {
      paddingHorizontal: 20,
      gap: 8,
    },
    articleList: {
      paddingHorizontal: 20,
      gap: 14,
      marginTop: 18,
    },
  });
}
