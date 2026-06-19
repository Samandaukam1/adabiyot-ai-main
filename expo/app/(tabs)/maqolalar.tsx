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
import { palette } from "@/constants/colors";
import {
  articles,
  articleCategories,
  type Article,
  type ArticleCategory,
} from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const FEATURED_H = Math.min(430, Math.round(SCREEN_W * 0.92));

type CategoryFilter = "Hammasi" | ArticleCategory;
type SortOption = "Yangi" | "Mashhur" | "Eng ko'p o'qilgan" | "Eng foydali";

const CATEGORY_FILTERS: CategoryFilter[] = ["Hammasi", ...articleCategories];
const SORT_OPTIONS: SortOption[] = ["Yangi", "Mashhur", "Eng ko'p o'qilgan", "Eng foydali"];

export default function ArticlesScreen() {
  const insets = useSafeAreaInsets();
  const { purchasedArticleIds } = useApp();
  const [query, setQuery] = useState<string>("");
  const [category, setCategory] = useState<CategoryFilter>("Hammasi");
  const [sort, setSort] = useState<SortOption>("Yangi");

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
  }, [category, query, sort]);

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
            <Star color={palette.primary} size={21} fill={palette.primary} />
          </View>
        </View>

        <Text style={styles.subtitle}>
          Tadqiqot, amaliy yo'riqnoma va chuqur tahlillar uchun alohida bilim kutubxonasi.
        </Text>

        <View style={styles.searchWrap}>
          <Search color={palette.textMuted} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Maqola, muallif yoki mavzu..."
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
            testID="articles-search"
          />
        </View>

        <FeaturedArticle
          article={featured}
          purchased={purchasedArticleIds.includes(featured.id)}
          onPress={() => openArticle(featured.id)}
        />

        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Filter color={palette.primary} size={17} />
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
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <ArrowUpDown color={palette.primary} size={17} />
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
            />
          ))}
        </ScrollView>

        <View style={styles.articleList}>
          {visibleArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              purchased={purchasedArticleIds.includes(article.id)}
              onPress={() => openArticle(article.id)}
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
}: {
  article: Article;
  purchased: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.featuredWrap} testID={`article-featured-${article.id}`}>
      <Image source={{ uri: article.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient
        colors={["rgba(10,24,12,0.10)", "rgba(10,24,12,0.82)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.featuredTop}>
        <View style={styles.premiumBadge}>
          <TrendingUp color="#fff" size={13} />
          <Text style={styles.premiumBadgeText}>LONGREAD</Text>
        </View>
        <View style={styles.pricePill}>
          {purchased ? null : <Lock color={palette.primary} size={12} />}
          <Text style={styles.pricePillText}>{purchased ? "Sotib olingan" : formatPrice(article.price)}</Text>
        </View>
      </View>
      <View style={styles.featuredBottom}>
        <Text style={styles.featuredCategory}>{article.category.toUpperCase()}</Text>
        <Text style={styles.featuredTitle} numberOfLines={3}>
          {article.title}
        </Text>
        <Text style={styles.featuredDesc} numberOfLines={3}>
          {article.description}
        </Text>
        <View style={styles.featuredMeta}>
          <View style={styles.metaItem}>
            <User color="rgba(255,255,255,0.82)" size={14} />
            <Text style={styles.featuredMetaText}>{article.author}</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock color="rgba(255,255,255,0.82)" size={14} />
            <Text style={styles.featuredMetaText}>{article.readingTime}</Text>
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
}: {
  article: Article;
  purchased: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.articleCard} testID={`article-card-${article.id}`}>
      <Image source={{ uri: article.cover }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.categoryBadge}>{article.category}</Text>
          <View style={styles.readTime}>
            <Clock color={palette.textMuted} size={12} />
            <Text style={styles.readTimeText}>{article.readingTime}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.cardDesc} numberOfLines={3}>
          {article.description}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.authorWrap}>
            <User color={palette.primary} size={13} />
            <Text style={styles.authorText} numberOfLines={1}>
              {article.author}
            </Text>
          </View>
          <View style={purchased ? styles.ownedPill : styles.lockedPill}>
            {purchased ? null : <Lock color={palette.primary} size={11} />}
            <Text style={purchased ? styles.ownedText : styles.lockedText}>
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={active ? [styles.chip, styles.chipActive] : styles.chip}>
      <Text style={active ? [styles.chipText, styles.chipTextActive] : styles.chipText}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatPrice(value: number): string {
  return `${value.toLocaleString()} so'm`;
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  h1: {
    color: palette.text,
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
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    color: palette.textDim,
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
    backgroundColor: palette.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: "500",
  },
  featuredWrap: {
    height: FEATURED_H,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  featuredTop: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  premiumBadge: {
    height: 31,
    borderRadius: 999,
    paddingHorizontal: 11,
    backgroundColor: "rgba(46,125,50,0.88)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  premiumBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  pricePill: {
    minHeight: 31,
    borderRadius: 999,
    paddingHorizontal: 11,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pricePillText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  featuredBottom: {
    marginTop: "auto",
    padding: 18,
  },
  featuredCategory: {
    color: "#B7F2B9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  featuredTitle: {
    color: "#fff",
    fontFamily: FONT.serif,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: 0,
  },
  featuredDesc: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
    fontWeight: "500",
  },
  featuredMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  featuredMetaText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: "700",
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
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  sectionHint: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#fff",
  },
  articleList: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 18,
  },
  articleCard: {
    minHeight: 174,
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardImage: {
    width: 124,
    minHeight: 174,
    backgroundColor: palette.bgElevated,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  categoryBadge: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  readTimeText: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  cardTitle: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 9,
  },
  cardDesc: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 6,
  },
  cardFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  authorWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  authorText: {
    flex: 1,
    color: palette.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  lockedPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockedText: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  ownedPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ownedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
});
