import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Headphones,
  Lock,
  Minus,
  Palette,
  Play,
  Plus,
  Quote as QuoteIcon,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Type,
  User,
  Video,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { palette } from "@/constants/colors";
import {
  getArticle,
  type Article,
  type ArticleBlock,
  type ArticleUsageTerm,
} from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W >= 720;
const HERO_H = IS_WIDE ? 520 : 500;
const PAPER_MAX = 760;

const PAGE_THEMES = {
  krem: {
    label: "Krem",
    bg: "#F5F1EA",
    paper: "#FFFDF8",
    text: "#171511",
    sub: "#70695E",
    border: "rgba(46,125,50,0.13)",
    soft: "#E8F5E9",
  },
  oq: {
    label: "Oq",
    bg: "#FFFFFF",
    paper: "#FFFFFF",
    text: "#161616",
    sub: "#666666",
    border: "rgba(20,20,20,0.08)",
    soft: "#F1F8F1",
  },
  yashil: {
    label: "Yashil",
    bg: "#F3FAF0",
    paper: "#FBFFF8",
    text: "#142016",
    sub: "#65715E",
    border: "rgba(46,125,50,0.16)",
    soft: "#E1F3E3",
  },
  tungi: {
    label: "Tungi",
    bg: "#151914",
    paper: "#1D221B",
    text: "#F7F0E4",
    sub: "#C9C0B2",
    border: "rgba(255,255,255,0.12)",
    soft: "rgba(76,175,80,0.18)",
  },
} as const;

type PageThemeKey = keyof typeof PAGE_THEMES;
type PageTheme = (typeof PAGE_THEMES)[PageThemeKey];
type ArticleFontKey = "classic" | "serif" | "sans";

const ARTICLE_FONTS: Record<ArticleFontKey, string> = {
  classic: FONT.classic,
  serif: FONT.serif,
  sans: FONT.sans,
};

const ARTICLE_FONT_OPTIONS: { key: ArticleFontKey; label: string }[] = [
  { key: "classic", label: "Klassik" },
  { key: "serif", label: "Serif" },
  { key: "sans", label: "Sans" },
];

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const article = useMemo(() => getArticle(String(id)), [id]);
  const { purchasedArticleIds, buyArticle } = useApp();
  const [fontSize, setFontSize] = useState<number>(18);
  const [fontKey, setFontKey] = useState<ArticleFontKey>("classic");
  const [pageThemeKey, setPageThemeKey] = useState<PageThemeKey>("krem");

  const theme = PAGE_THEMES[pageThemeKey];

  if (!article) {
    return (
      <Screen>
        <View style={[styles.notFound, { paddingTop: insets.top + 48 }]}>
          <Text style={styles.notFoundTitle}>Maqola topilmadi</Text>
          <PressableScale onPress={() => router.back()} style={styles.notFoundButton}>
            <Text style={styles.notFoundButtonText}>Orqaga</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  const purchased = purchasedArticleIds.includes(article.id);

  const handleBuy = () => {
    buyArticle(article.id);
  };

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <ArticleHero article={article} topInset={insets.top} />

        <View style={styles.bodyOuter}>
          <View style={[styles.summaryPanel, { backgroundColor: theme.paper, borderColor: theme.border }]}>
            <MetaGrid article={article} publishedDate={formatDate(article.publishedAt)} theme={theme} />
            <Text style={[styles.description, { color: theme.sub }]}>{article.description}</Text>
            <PressableScale
              onPress={purchased ? undefined : handleBuy}
              style={purchased ? [styles.purchaseButton, styles.purchaseButtonOwned] : styles.purchaseButton}
              testID={`article-buy-${article.id}`}
            >
              {purchased ? <CheckCircle2 color="#fff" size={18} /> : <ShoppingBag color="#fff" size={18} />}
              <Text style={styles.purchaseText}>
                {purchased ? "Sotib olingan" : `Sotib olish - ${formatPrice(article.price)}`}
              </Text>
            </PressableScale>
          </View>

          <UsageRights terms={article.usageTerms} theme={theme} />

          {!purchased ? (
            <PreviewPaywall article={article} onBuy={handleBuy} theme={theme} />
          ) : (
            <>
              <ReadingControls
                fontSize={fontSize}
                fontKey={fontKey}
                pageThemeKey={pageThemeKey}
                onFontMinus={() => setFontSize((value) => Math.max(16, value - 1))}
                onFontPlus={() => setFontSize((value) => Math.min(22, value + 1))}
                onFont={setFontKey}
                onTheme={setPageThemeKey}
                theme={theme}
              />

              <View style={[styles.longreadPaper, { backgroundColor: theme.paper, borderColor: theme.border }]}>
                {article.blocks.map((block) => (
                  <ArticleBlockView
                    key={block.id}
                    block={block}
                    theme={theme}
                    fontSize={fontSize}
                    fontFamily={ARTICLE_FONTS[fontKey]}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function ArticleHero({ article, topInset }: { article: Article; topInset: number }) {
  return (
    <View style={styles.hero}>
      <Image source={{ uri: article.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient
        colors={["rgba(11,23,12,0.18)", "rgba(11,23,12,0.68)", palette.bg]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.topBar, { paddingTop: topInset + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.heroIconButton}>
          <ArrowLeft color="#fff" size={21} />
        </Pressable>
      </View>
      <View style={styles.heroCopy}>
        <View style={styles.heroBadge}>
          <FileText color="#fff" size={13} />
          <Text style={styles.heroBadgeText}>PREMIUM MAQOLA</Text>
        </View>
        <Text style={styles.heroCategory}>{article.category.toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{article.title}</Text>
        <Text style={styles.heroAuthor}>
          {article.author} - {article.authorRole}
        </Text>
      </View>
    </View>
  );
}

function MetaGrid({
  article,
  publishedDate,
  theme,
}: {
  article: Article;
  publishedDate: string;
  theme: PageTheme;
}) {
  const items = [
    { key: "author", icon: User, label: "Muallif", value: article.author },
    { key: "category", icon: Tag, label: "Kategoriya", value: article.category },
    { key: "read", icon: Clock, label: "O'qish vaqti", value: article.readingTime },
    { key: "date", icon: CalendarDays, label: "Nashr sanasi", value: publishedDate },
    { key: "price", icon: ShoppingBag, label: "Narx", value: formatPrice(article.price) },
  ];

  return (
    <View style={styles.metaGrid}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <View key={item.key} style={[styles.metaCard, { borderColor: theme.border, backgroundColor: theme.soft }]}>
            <Icon color={palette.primary} size={16} />
            <View style={styles.metaTextWrap}>
              <Text style={[styles.metaLabel, { color: theme.sub }]}>{item.label}</Text>
              <Text style={[styles.metaValue, { color: theme.text }]} numberOfLines={2}>
                {item.value}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function UsageRights({ terms, theme }: { terms: ArticleUsageTerm[]; theme: PageTheme }) {
  return (
    <View style={[styles.usageBox, { backgroundColor: theme.paper, borderColor: theme.border }]}>
      <View style={styles.usageHeader}>
        <View style={styles.usageIcon}>
          <ShieldCheck color={palette.primary} size={19} />
        </View>
        <View>
          <Text style={[styles.usageTitle, { color: theme.text }]}>Foydalanish huquqi</Text>
          <Text style={[styles.usageSubtitle, { color: theme.sub }]}>
            Xariddan keyingi foydalanish shartlari
          </Text>
        </View>
      </View>
      <View style={styles.usageList}>
        {terms.map((term) => (
          <View key={term.label} style={[styles.usageRow, { borderColor: theme.border }]}>
            <Text style={[styles.usageLabel, { color: theme.sub }]}>{term.label}</Text>
            <Text style={[styles.usageValue, { color: theme.text }]}>{term.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PreviewPaywall({
  article,
  onBuy,
  theme,
}: {
  article: Article;
  onBuy: () => void;
  theme: PageTheme;
}) {
  return (
    <View style={[styles.previewBox, { backgroundColor: theme.paper, borderColor: theme.border }]}>
      <View style={styles.lockCircle}>
        <Lock color={palette.primary} size={24} />
      </View>
      <Text style={[styles.previewTitle, { color: theme.text }]}>To'liq maqola pullik</Text>
      <Text style={[styles.previewText, { color: theme.sub }]}>{article.previewSnippet}</Text>
      <PressableScale onPress={onBuy} style={styles.previewButton}>
        <ShoppingBag color="#fff" size={17} />
        <Text style={styles.previewButtonText}>{formatPrice(article.price)} ga ochish</Text>
      </PressableScale>
    </View>
  );
}

function ReadingControls({
  fontSize,
  fontKey,
  pageThemeKey,
  onFontMinus,
  onFontPlus,
  onFont,
  onTheme,
  theme,
}: {
  fontSize: number;
  fontKey: ArticleFontKey;
  pageThemeKey: PageThemeKey;
  onFontMinus: () => void;
  onFontPlus: () => void;
  onFont: (key: ArticleFontKey) => void;
  onTheme: (key: PageThemeKey) => void;
  theme: PageTheme;
}) {
  return (
    <View style={[styles.controls, { backgroundColor: theme.paper, borderColor: theme.border }]}>
      <View style={styles.controlsHeader}>
        <Type color={palette.primary} size={18} />
        <Text style={[styles.controlsTitle, { color: theme.text }]}>Sozlamalar</Text>
      </View>
      <View style={styles.controlRow}>
        <View style={styles.controlLabel}>
          <Type color={theme.sub} size={15} />
          <Text style={[styles.controlText, { color: theme.sub }]}>Matn kattaligi {fontSize}</Text>
        </View>
        <View style={styles.stepper}>
          <Pressable onPress={onFontMinus} style={[styles.stepperBtn, { borderColor: theme.border }]}>
            <Minus color={theme.text} size={16} />
          </Pressable>
          <Pressable onPress={onFontPlus} style={[styles.stepperBtn, { borderColor: theme.border }]}>
            <Plus color={theme.text} size={16} />
          </Pressable>
        </View>
      </View>
      <View style={styles.themeRow}>
        <View style={styles.controlLabel}>
          <Type color={theme.sub} size={15} />
          <Text style={[styles.controlText, { color: theme.sub }]}>Shrift tanlash</Text>
        </View>
        <View style={styles.themeChips}>
          {ARTICLE_FONT_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => onFont(option.key)}
              style={[
                styles.themeChip,
                {
                  borderColor: fontKey === option.key ? palette.primary : theme.border,
                  backgroundColor: theme.paper,
                },
              ]}
            >
              <Text style={[styles.themeChipText, { color: fontKey === option.key ? palette.primary : theme.text }]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.themeRow}>
        <View style={styles.controlLabel}>
          <Palette color={theme.sub} size={15} />
          <Text style={[styles.controlText, { color: theme.sub }]}>Sahifa rangi</Text>
        </View>
        <View style={styles.themeChips}>
          {(Object.keys(PAGE_THEMES) as PageThemeKey[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => onTheme(key)}
              style={[
                styles.themeChip,
                {
                  borderColor: pageThemeKey === key ? palette.primary : theme.border,
                  backgroundColor: PAGE_THEMES[key].paper,
                },
              ]}
            >
              <Text
                style={[
                  styles.themeChipText,
                  { color: key === "tungi" ? "#F7F0E4" : palette.text },
                ]}
              >
                {PAGE_THEMES[key].label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function ArticleBlockView({
  block,
  theme,
  fontSize,
  fontFamily,
}: {
  block: ArticleBlock;
  theme: PageTheme;
  fontSize: number;
  fontFamily: string;
}) {
  const paragraphStyle = {
    color: theme.text,
    fontSize,
    lineHeight: Math.round(fontSize * 1.55),
    fontFamily,
  };

  switch (block.type) {
    case "title":
      return (
        <Text
          style={[
            styles.blockTitle,
            block.level === 3 && styles.blockSubtitle,
            { color: theme.text },
          ]}
        >
          {block.text}
        </Text>
      );
    case "paragraph":
      return <Text style={[styles.paragraph, paragraphStyle]}>{block.text}</Text>;
    case "image":
      return (
        <View style={styles.imageBlock}>
          <Image source={{ uri: block.image }} style={styles.largeImage} contentFit="cover" />
          {block.caption ? <Text style={[styles.caption, { color: theme.sub }]}>{block.caption}</Text> : null}
        </View>
      );
    case "imagePair":
      return (
        <View style={styles.imagePair}>
          {block.images.slice(0, 2).map((item) => (
            <View key={item.image} style={styles.imagePairItem}>
              <Image source={{ uri: item.image }} style={styles.pairImage} contentFit="cover" />
              {item.caption ? (
                <Text style={[styles.captionSmall, { color: theme.sub }]} numberOfLines={2}>
                  {item.caption}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      );
    case "video":
      return (
        <View style={[styles.mediaBlock, { borderColor: theme.border, backgroundColor: theme.soft }]}>
          <View style={styles.videoThumb}>
            <Image source={{ uri: block.thumbnail }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            <LinearGradient
              colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.58)"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.playCircle}>
              <Play color="#fff" fill="#fff" size={22} />
            </View>
            {block.duration ? <Text style={styles.durationBadge}>{block.duration}</Text> : null}
          </View>
          <View style={styles.mediaText}>
            <View style={styles.mediaTitleRow}>
              <Video color={palette.primary} size={18} />
              <Text style={[styles.mediaTitle, { color: theme.text }]}>{block.title}</Text>
            </View>
            {block.description ? (
              <Text style={[styles.mediaDesc, { color: theme.sub }]}>{block.description}</Text>
            ) : null}
          </View>
        </View>
      );
    case "quote":
      return (
        <View style={[styles.quoteBlock, { borderColor: theme.border, backgroundColor: theme.soft }]}>
          <QuoteIcon color={palette.primary} size={24} />
          <Text style={[styles.quoteText, { color: theme.text }]}>{block.text}</Text>
          {block.author ? <Text style={[styles.quoteAuthor, { color: theme.sub }]}>{block.author}</Text> : null}
        </View>
      );
    case "audio":
      return (
        <View style={[styles.audioBlock, { borderColor: theme.border, backgroundColor: theme.soft }]}>
          {block.cover ? (
            <Image source={{ uri: block.cover }} style={styles.audioCover} contentFit="cover" />
          ) : (
            <View style={styles.audioCoverFallback}>
              <Headphones color={palette.primary} size={24} />
            </View>
          )}
          <View style={styles.audioInfo}>
            <Text style={[styles.audioTitle, { color: theme.text }]}>{block.title}</Text>
            {block.description ? (
              <Text style={[styles.audioDesc, { color: theme.sub }]} numberOfLines={2}>
                {block.description}
              </Text>
            ) : null}
            <Text style={styles.audioDuration}>{block.duration}</Text>
          </View>
          <View style={styles.audioPlay}>
            <Play color="#fff" fill="#fff" size={17} />
          </View>
        </View>
      );
    case "file":
      return (
        <View style={[styles.fileBlock, { borderColor: theme.border, backgroundColor: theme.soft }]}>
          <View style={styles.fileIcon}>
            <Download color={palette.primary} size={22} />
          </View>
          <View style={styles.fileTextWrap}>
            <Text style={[styles.fileTitle, { color: theme.text }]}>{block.title}</Text>
            {block.description ? (
              <Text style={[styles.fileDesc, { color: theme.sub }]}>{block.description}</Text>
            ) : null}
            <Text style={styles.fileMeta}>
              {block.fileName} - {block.format} - {block.size}
            </Text>
          </View>
        </View>
      );
    case "highlight":
      return (
        <View style={[styles.highlightBlock, { borderColor: palette.borderStrong, backgroundColor: theme.soft }]}>
          <View style={styles.highlightIcon}>
            <ShieldCheck color={palette.primary} size={19} />
          </View>
          <View style={{ flex: 1 }}>
            {block.title ? <Text style={[styles.highlightTitle, { color: theme.text }]}>{block.title}</Text> : null}
            <Text style={[styles.highlightText, { color: theme.sub }]}>{block.text}</Text>
          </View>
        </View>
      );
    case "divider":
      return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
    case "numberedList":
      return (
        <View style={styles.listBlock}>
          {block.items.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.listRow}>
              <View style={styles.numberBullet}>
                <Text style={styles.numberBulletText}>{index + 1}</Text>
              </View>
              <Text style={[styles.listText, paragraphStyle]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "bulletList":
      return (
        <View style={styles.listBlock}>
          {block.items.map((item) => (
            <View key={item} style={styles.listRow}>
              <View style={styles.dotBullet} />
              <Text style={[styles.listText, paragraphStyle]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
          <View style={[styles.table, { borderColor: theme.border }]}>
            <View style={[styles.tableRow, { backgroundColor: theme.soft }]}>
              {block.headers.map((header) => (
                <Text key={header} style={[styles.tableHeadCell, { color: theme.text, borderColor: theme.border }]}>
                  {header}
                </Text>
              ))}
            </View>
            {block.rows.map((row, rowIndex) => (
              <View key={`${row.join("-")}-${rowIndex}`} style={styles.tableRow}>
                {row.map((cell, cellIndex) => (
                  <Text
                    key={`${cell}-${cellIndex}`}
                    style={[styles.tableCell, { color: theme.sub, borderColor: theme.border }]}
                  >
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    default:
      return null;
  }
}

function formatPrice(value: number): string {
  return `${value.toLocaleString()} so'm`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  const months = [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avgust",
    "sentyabr",
    "oktyabr",
    "noyabr",
    "dekabr",
  ];

  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()}-${months[date.getMonth()]} ${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  notFoundTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  notFoundButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  notFoundButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  hero: {
    height: HERO_H,
    overflow: "hidden",
    backgroundColor: palette.primaryDim,
  },
  topBar: {
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    marginTop: "auto",
    paddingHorizontal: 22,
    paddingBottom: 54,
    maxWidth: PAPER_MAX,
    alignSelf: "center",
    width: "100%",
  },
  heroBadge: {
    alignSelf: "flex-start",
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(46,125,50,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  heroCategory: {
    color: "#B7F2B9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginTop: 18,
  },
  heroTitle: {
    color: "#fff",
    fontFamily: FONT.serif,
    fontSize: IS_WIDE ? 44 : 32,
    lineHeight: IS_WIDE ? 51 : 38,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 8,
  },
  heroAuthor: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 12,
  },
  bodyOuter: {
    paddingHorizontal: 18,
    marginTop: -38,
    alignItems: "center",
  },
  summaryPanel: {
    width: "100%",
    maxWidth: PAPER_MAX,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  metaCard: {
    width: IS_WIDE ? "32%" : "48%",
    minHeight: 74,
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  metaTextWrap: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    marginTop: 15,
  },
  purchaseButton: {
    height: 54,
    borderRadius: 16,
    marginTop: 16,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  purchaseButtonOwned: {
    backgroundColor: palette.primaryDim,
  },
  purchaseText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  usageBox: {
    width: "100%",
    maxWidth: PAPER_MAX,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  usageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  usageIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  usageTitle: {
    fontFamily: FONT.serif,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  usageSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  usageList: {
    marginTop: 14,
  },
  usageRow: {
    paddingVertical: 11,
    borderTopWidth: 1,
    gap: 4,
  },
  usageLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  usageValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  previewBox: {
    width: "100%",
    maxWidth: PAPER_MAX,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginTop: 16,
    alignItems: "center",
  },
  lockCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitle: {
    fontFamily: FONT.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 16,
    textAlign: "center",
  },
  previewText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 10,
  },
  previewButton: {
    height: 50,
    borderRadius: 15,
    paddingHorizontal: 18,
    marginTop: 18,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  previewButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  controls: {
    width: "100%",
    maxWidth: PAPER_MAX,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  controlsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  controlsTitle: {
    fontFamily: FONT.serif,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  controlRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  controlLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  controlText: {
    fontSize: 13,
    fontWeight: "800",
  },
  stepper: {
    flexDirection: "row",
    gap: 8,
  },
  stepperBtn: {
    width: 38,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeRow: {
    marginTop: 10,
    gap: 12,
  },
  themeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeChip: {
    height: 34,
    minWidth: 64,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
  longreadPaper: {
    width: "100%",
    maxWidth: PAPER_MAX,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: IS_WIDE ? 44 : 20,
    paddingVertical: IS_WIDE ? 42 : 26,
  },
  blockTitle: {
    fontFamily: FONT.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 24,
    marginBottom: 12,
  },
  blockSubtitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  paragraph: {
    fontFamily: FONT.classic,
    fontWeight: "500",
    marginBottom: 18,
  },
  imageBlock: {
    marginVertical: 22,
  },
  largeImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 16,
    backgroundColor: palette.bgElevated,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 9,
    textAlign: "center",
  },
  imagePair: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 22,
  },
  imagePairItem: {
    flex: 1,
  },
  pairImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: palette.bgElevated,
  },
  captionSmall: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 7,
  },
  mediaBlock: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    marginVertical: 22,
  },
  videoThumb: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: palette.primaryDim,
  },
  playCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 58,
    height: 58,
    marginLeft: -29,
    marginTop: -29,
    borderRadius: 29,
    backgroundColor: "rgba(46,125,50,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaText: {
    padding: 14,
  },
  mediaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mediaTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  mediaDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 7,
  },
  quoteBlock: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginVertical: 22,
  },
  quoteText: {
    fontFamily: FONT.serif,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: 0,
    marginTop: 12,
  },
  quoteAuthor: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  audioBlock: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioCover: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: palette.bgElevated,
  },
  audioCoverFallback: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: palette.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  audioDesc: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 3,
  },
  audioDuration: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5,
  },
  audioPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fileBlock: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginVertical: 18,
    flexDirection: "row",
    gap: 12,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  fileTextWrap: {
    flex: 1,
  },
  fileTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  fileDesc: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  fileMeta: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 7,
  },
  highlightBlock: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginVertical: 18,
  },
  highlightIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: palette.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 26,
  },
  listBlock: {
    gap: 12,
    marginBottom: 20,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  numberBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  numberBulletText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  dotBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
    marginTop: 11,
  },
  listText: {
    flex: 1,
    fontFamily: FONT.classic,
    fontWeight: "500",
  },
  tableScroll: {
    marginVertical: 22,
  },
  table: {
    minWidth: Math.min(680, SCREEN_W + 160),
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeadCell: {
    width: 170,
    padding: 12,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    borderRightWidth: 1,
  },
  tableCell: {
    width: 170,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
});
