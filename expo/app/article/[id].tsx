import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import RatingReviewBlock from "@/components/RatingReviewBlock";
import {
  ArrowLeft,
  Clock,
  Heart,
  Lock,
  Minus,
  MessageCircle,
  Plus,
  Share2,
  ShoppingBag,
  Type,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { ArticleAudioPlayer } from "@/components/articles/ArticleAudioPlayer";
import { RichArticleRenderer } from "@/components/articles/RichArticleRenderer";
import VerificationBadge from "@/components/VerificationBadge";
import type { DisplayArticle } from "@/lib/articles";
import { useArticleContent } from "@/hooks/useArticleContent";
import BuyConfirmSheet from "@/components/payments/BuyConfirmSheet";
import CardPaymentSheet from "@/components/payments/CardPaymentSheet";
import PromoPriceBlock from "@/components/payments/PromoPriceBlock";
import {
  createOrderInputFromPaymentProduct,
  logCreateOrderDebug,
  showMissingPaymentProductAlert,
  useContentAccess,
  usePaymentProduct,
  usePurchaseFlow,
} from "@/hooks/usePayments";
import { usePromo } from "@/hooks/usePromo";
import { usePlannedRead } from "@/hooks/useShelf";
import { shareContent } from "@/lib/share";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthGate } from "@/providers/AuthGateProvider";
import { getInitials } from "@/types/profile";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const IS_WIDE = SCREEN_W >= 720;
const PAPER_MAX = 720;
const PRIMARY = "#2F9E6E";

// Minimalist, magazine-grade reading surfaces. White is the default; the others
// are calm alternatives the reader can switch to.
const PAGE_THEMES = {
  oq: {
    label: "Oq",
    bg: "#FFFFFF",
    paper: "#FFFFFF",
    text: "#15171C",
    sub: "#69707B",
    border: "rgba(0,0,0,0.07)",
    soft: "#F5F6F8",
  },
  krem: {
    label: "Krem",
    bg: "#FBF8F2",
    paper: "#FFFFFF",
    text: "#1A1813",
    sub: "#6F695E",
    border: "rgba(0,0,0,0.07)",
    soft: "#F4F0E8",
  },
  yashil: {
    label: "Yashil",
    bg: "#F5FAF6",
    paper: "#FFFFFF",
    text: "#13201A",
    sub: "#5E6F66",
    border: "rgba(0,0,0,0.07)",
    soft: "#ECF5EF",
  },
  tungi: {
    label: "Tungi",
    bg: "#15181C",
    paper: "#1B1F24",
    text: "#ECEFF3",
    sub: "#9BA4AF",
    border: "rgba(255,255,255,0.10)",
    soft: "#22272D",
  },
} as const;

type PageThemeKey = keyof typeof PAGE_THEMES;
type PageTheme = (typeof PAGE_THEMES)[PageThemeKey];
type ArticleFontKey = "serif" | "classic" | "sans";

const ARTICLE_FONTS: Record<ArticleFontKey, string> = {
  serif: FONT.serif,
  classic: FONT.classic,
  sans: FONT.sans,
};

const ARTICLE_FONT_OPTIONS: { key: ArticleFontKey; label: string }[] = [
  { key: "serif", label: "Serif" },
  { key: "classic", label: "Klassik" },
  { key: "sans", label: "Sans" },
];

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { article, loading, error } = useArticleContent(typeof id === "string" ? id : undefined);
  const { isAuthenticated } = useAuth();
  const { promptLogin } = useAuthGate();
  const access = useContentAccess("article", article?.id);
  const purchaseFlow = usePurchaseFlow();
  const paymentProductQuery = usePaymentProduct("article", article?.id);
  const paymentProduct = paymentProductQuery.data ?? null;
  const promo = usePromo({
    contentType: paymentProduct?.content_type ?? "article",
    contentId: paymentProduct?.content_id ?? article?.id,
    productId: paymentProduct?.id,
  });
  const [showBuy, setShowBuy] = useState(false);

  const [fontSize, setFontSize] = useState<number>(19);
  const [fontKey, setFontKey] = useState<ArticleFontKey>("serif");
  const [pageThemeKey, setPageThemeKey] = useState<PageThemeKey>("oq");
  const [showSettings, setShowSettings] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (__DEV__ && article) console.log("[ArticleDetail] blocks count:", article.blocks?.length ?? 0);
  }, [article]);

  const theme = PAGE_THEMES[pageThemeKey];
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (loading && !article) {
    return (
      <Screen style={{ backgroundColor: theme.bg }}>
        <View style={[styles.loadingState, { paddingTop: insets.top + 56 }]}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={[styles.loadingText, { color: theme.sub }]}>Maqola yuklanmoqda...</Text>
        </View>
      </Screen>
    );
  }

  if (!article) {
    return (
      <Screen style={{ backgroundColor: theme.bg }}>
        <View style={[styles.notFound, { paddingTop: insets.top + 48 }]}>
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>{error || "Maqola topilmadi"}</Text>
          <PressableScale onPress={() => router.back()} style={styles.notFoundButton}>
            <Text style={styles.notFoundButtonText}>Orqaga</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  const ownsArticle = access.hasAccess;
  const purchased = !article.requiresPurchase || ownsArticle;
  const articlePrice = article.requiresPurchase ? paymentProduct?.amount_uzs ?? article.price : 0;
  const hasPaidBlocks = article.blocks.some((block) => block.isPaid || block.type === "paid_content");
  const richBlocksUnlocked = hasPaidBlocks ? ownsArticle : true;
  // Open the confirm sheet (gated by login); access is granted only by the backend.
  const handleBuy = () => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    if (paymentProductQuery.isLoading || paymentProductQuery.isFetching) return;
    if (!paymentProduct) {
      showMissingPaymentProductAlert();
      return;
    }
    setShowBuy(true);
  };
  const confirmBuy = () => {
    if (!paymentProduct) {
      setShowBuy(false);
      showMissingPaymentProductAlert();
      return;
    }
    setShowBuy(false);
    logCreateOrderDebug(paymentProduct);
    void purchaseFlow.start(createOrderInputFromPaymentProduct(paymentProduct), { promoCode: promo.appliedCode });
  };

  const heroAspect = article.coverAspectRatio > 0 ? article.coverAspectRatio : 0.72;
  const heroWidth = Math.min(SCREEN_W, IS_WIDE ? PAPER_MAX : SCREEN_W);
  const heroHeight = Math.min(Math.round(heroWidth / heroAspect), Math.round(SCREEN_H * 0.66));

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 140 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <ArticleHero
          article={article}
          topInset={insets.top}
          heroHeight={heroHeight}
          scrollY={scrollY}
          styles={styles}
        />

        <View style={styles.body}>
          <ActionRow article={article} theme={theme} styles={styles} />

          {article.description ? (
            <Text style={styles.lead}>{article.description}</Text>
          ) : null}

          {article.audioUrl ? (
            <View style={styles.audioWrap}>
              <ArticleAudioPlayer
                url={article.audioUrl}
                durationSeconds={article.audioDurationSeconds}
                theme={theme}
              />
            </View>
          ) : null}

          {!purchased && article.requiresPurchase ? (
            <PreviewPaywall article={article} priceUzs={articlePrice} onBuy={handleBuy} styles={styles} promo={promo} />
          ) : (
            <>
              <SettingsBar
                open={showSettings}
                onToggle={() => setShowSettings((v) => !v)}
                fontSize={fontSize}
                fontKey={fontKey}
                pageThemeKey={pageThemeKey}
                onFontMinus={() => setFontSize((value) => Math.max(16, value - 1))}
                onFontPlus={() => setFontSize((value) => Math.min(24, value + 1))}
                onFont={setFontKey}
                onTheme={setPageThemeKey}
                theme={theme}
                styles={styles}
              />

              <View style={styles.longread}>
                <RichArticleRenderer
                  blocks={article.blocks}
                  theme={theme}
                  fontSize={fontSize}
                  fontFamily={ARTICLE_FONTS[fontKey]}
                  purchased={richBlocksUnlocked}
                  onBuy={article.requiresPurchase || hasPaidBlocks ? handleBuy : undefined}
                  priceLabel={formatPrice(articlePrice)}
                />
              </View>
            </>
          )}
        </View>
        <RatingReviewBlock
          contentType="article"
          contentId={article.id}
          title={article.title}
          author={article.author || "AdabiyotX"}
          coverUrl={article.cover}
        />
      </Animated.ScrollView>

      <BuyConfirmSheet
        visible={showBuy}
        title={article.title}
        priceUzs={articlePrice}
        benefits={["To'liq maqolani o'qish", "Doimiy kirish huquqi"]}
        onConfirm={confirmBuy}
        onClose={() => setShowBuy(false)}
        promo={promo}
      />
      <CardPaymentSheet
        flow={purchaseFlow}
        title={article.title}
        success={{
          kind: "content",
          onPrimary: purchaseFlow.reset,
          onSecondary: () => {
            purchaseFlow.reset();
            router.push("/library");
          },
        }}
        onClose={purchaseFlow.reset}
      />
    </Screen>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function HeroAvatar({ uri, name, styles }: { uri: string | null; name: string; styles: StylesType }) {
  const [err, setErr] = useState(false);
  React.useEffect(() => { setErr(false); }, [uri]);

  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={styles.authorAvatar}
        contentFit="cover"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
      <Text style={styles.authorAvatarInitial}>{getInitials(name)}</Text>
    </View>
  );
}

function ArticleHero({
  article,
  topInset,
  heroHeight,
  scrollY,
  styles,
}: {
  article: DisplayArticle;
  topInset: number;
  heroHeight: number;
  scrollY: Animated.Value;
  styles: StylesType;
}) {
  const { planned, toggle } = usePlannedRead("article", article.id);
  const overlay = article.coverOverlayEnabled ? article.coverOverlayOpacity : 0.2;
  const publishedDate = formatDate(article.publishedAt);

  // Parallax: the whole hero rises at half speed so the rounded content sheet
  // slides up over it — the image "stays underneath" and reverses on scroll back.
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, heroHeight * 0.5],
    extrapolateLeft: "clamp",
    extrapolateRight: "extend",
  });
  // Gentle zoom while pulling down (overscroll) for a premium feel.
  const imageScale = scrollY.interpolate({
    inputRange: [-heroHeight, 0],
    outputRange: [1.35, 1],
    extrapolateLeft: "extend",
    extrapolateRight: "clamp",
  });

  return (
    <Animated.View style={[styles.hero, { height: heroHeight, transform: [{ translateY: heroTranslate }] }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ scale: imageScale }] }]}>
        <Image source={{ uri: article.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <LinearGradient
          colors={[
            "rgba(8,12,16,0.34)",
            "rgba(8,12,16,0.04)",
            `rgba(8,12,16,${Math.min(0.55, overlay * 0.85).toFixed(2)})`,
            `rgba(8,12,16,${Math.min(0.92, overlay + 0.5).toFixed(2)})`,
          ]}
          locations={[0, 0.32, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.heroIconButton} hitSlop={8}>
          <ArrowLeft color="#fff" size={20} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() =>
              toggle({ title: article.title, cover: article.cover, author: article.hasAuthor ? article.author : null })
            }
            style={[styles.heroIconButton, planned && { backgroundColor: "rgba(47,158,110,0.92)" }]}
            hitSlop={8}
            accessibilityLabel="Tez orada o'qiyman"
          >
            <Clock color="#fff" size={19} />
          </Pressable>
          <Pressable
            onPress={() =>
              shareContent({ title: article.title, author: article.hasAuthor ? article.author : null, description: article.description })
            }
            style={styles.heroIconButton}
            hitSlop={8}
            accessibilityLabel="Ulashish"
          >
            <Share2 color="#fff" size={19} />
          </Pressable>
        </View>
      </View>
      <View style={styles.heroCopy}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>MAQOLA</Text>
        </View>
        {publishedDate ? <Text style={styles.heroDate}>{publishedDate}</Text> : null}
        <Text style={styles.heroTitle}>{article.title}</Text>
        {article.hasAuthor && article.author ? (
          <Pressable
            style={styles.authorRow}
            disabled={!article.authorProfileId}
            onPress={() => article.authorProfileId && router.push(`/author/${article.authorProfileId}` as never)}
          >
            <HeroAvatar uri={article.authorAvatarUrl} name={article.author} styles={styles} />
            <View style={{ flex: 1 }}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName} numberOfLines={1}>{article.author}</Text>
                {article.authorVerification !== "none" ? (
                  <VerificationBadge verificationType={article.authorVerification} size="sm" />
                ) : null}
              </View>
              {article.authorRole ? (
                <Text style={styles.authorRole} numberOfLines={1}>{article.authorRole}</Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function ActionRow({
  article,
  theme,
  styles,
}: {
  article: DisplayArticle;
  theme: PageTheme;
  styles: StylesType;
}) {
  const [liked, setLiked] = useState(false);
  const likeCount = article.likesCount + (liked ? 1 : 0);

  const onShare = () => {
    Share.share({
      title: article.title,
      message: `${article.title}\n\nAdabiyotX`,
    }).catch(() => {});
  };

  return (
    <View style={styles.actionRow}>
      <Pressable onPress={() => setLiked((v) => !v)} style={styles.actionItem} hitSlop={8}>
        <Heart color={liked ? "#E5484D" : theme.sub} size={20} fill={liked ? "#E5484D" : "transparent"} />
        {likeCount > 0 ? <Text style={styles.actionCount}>{likeCount}</Text> : null}
      </Pressable>

      <Pressable onPress={onShare} style={styles.actionItem} hitSlop={8}>
        <Share2 color={theme.sub} size={20} />
      </Pressable>

      <View style={styles.actionItem}>
        <MessageCircle color={theme.sub} size={20} />
        <Text style={styles.actionCount}>{article.commentsCount}</Text>
      </View>

      <View style={styles.actionSpacer} />

      <View style={styles.readingPill}>
        <Clock color={theme.sub} size={14} />
        <Text style={styles.readingPillText}>{article.readingMinutes} daqiqa o'qiladi</Text>
      </View>
    </View>
  );
}

function PreviewPaywall({
  article,
  priceUzs,
  onBuy,
  styles,
  promo,
}: {
  article: DisplayArticle;
  priceUzs: number;
  onBuy: () => void;
  styles: StylesType;
  promo: ReturnType<typeof usePromo>;
}) {
  return (
    <View style={styles.previewBox}>
      <View style={styles.lockCircle}>
        <Lock color={PRIMARY} size={22} />
      </View>
      <Text style={styles.previewTitle}>To'liq maqola pullik</Text>
      <Text style={styles.previewText}>{article.previewSnippet}</Text>
      {promo.isActive ? (
        <View style={{ alignSelf: "stretch", marginBottom: 16 }}>
          <PromoPriceBlock
            isActive={promo.isActive}
            originalAmount={promo.pricing?.original_amount_uzs ?? priceUzs}
            finalAmount={promo.pricing?.final_amount_uzs ?? priceUzs}
            discountPercent={promo.pricing?.discount_percent ?? 0}
            promoCode={promo.appliedCode ?? ""}
            endsAt={promo.endsAt}
          />
        </View>
      ) : null}
      <PressableScale onPress={onBuy} style={styles.previewButton}>
        <ShoppingBag color="#fff" size={17} />
        <Text style={styles.previewButtonText}>{formatPrice(priceUzs)} ga ochish</Text>
      </PressableScale>
      <Pressable onPress={() => router.push("/payments/tariflar")} hitSlop={8} style={{ marginTop: 14 }}>
        <Text style={{ color: PRIMARY, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
          Tarif orqali ochish
        </Text>
      </Pressable>
    </View>
  );
}

function SettingsBar({
  open,
  onToggle,
  fontSize,
  fontKey,
  pageThemeKey,
  onFontMinus,
  onFontPlus,
  onFont,
  onTheme,
  theme,
  styles,
}: {
  open: boolean;
  onToggle: () => void;
  fontSize: number;
  fontKey: ArticleFontKey;
  pageThemeKey: PageThemeKey;
  onFontMinus: () => void;
  onFontPlus: () => void;
  onFont: (key: ArticleFontKey) => void;
  onTheme: (key: PageThemeKey) => void;
  theme: PageTheme;
  styles: StylesType;
}) {
  return (
    <View style={styles.settingsWrap}>
      <Pressable onPress={onToggle} style={styles.settingsToggle} hitSlop={6}>
        <Type color={theme.sub} size={16} />
        <Text style={styles.settingsToggleText}>O'qish ko'rinishi</Text>
        <Text style={styles.settingsToggleHint}>{open ? "Yopish" : "Sozlash"}</Text>
      </Pressable>

      {open ? (
        <View style={styles.settingsPanel}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Matn kattaligi</Text>
            <View style={styles.stepper}>
              <Pressable onPress={onFontMinus} style={styles.stepperBtn}>
                <Minus color={theme.text} size={15} />
              </Pressable>
              <Text style={styles.stepperValue}>{fontSize}</Text>
              <Pressable onPress={onFontPlus} style={styles.stepperBtn}>
                <Plus color={theme.text} size={15} />
              </Pressable>
            </View>
          </View>

          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Shrift</Text>
            <View style={styles.chips}>
              {ARTICLE_FONT_OPTIONS.map((option) => {
                const active = fontKey === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => onFont(option.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Sahifa rangi</Text>
            <View style={styles.chips}>
              {(Object.keys(PAGE_THEMES) as PageThemeKey[]).map((key) => {
                const active = pageThemeKey === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => onTheme(key)}
                    style={[
                      styles.swatch,
                      { backgroundColor: PAGE_THEMES[key].bg },
                      active && styles.swatchActive,
                    ]}
                  >
                    <View style={[styles.swatchDot, { backgroundColor: PAGE_THEMES[key].text }]} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatPrice(value: number): string {
  if (!value || value <= 0) return "Bepul";
  return `${value.toLocaleString()} so'm`;
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  const months = [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr",
  ];
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()}-${months[date.getMonth()]}, ${date.getFullYear()}`;
}

function createStyles(theme: PageTheme) {
  return StyleSheet.create({
      notFound: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
      notFoundTitle: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
      notFoundButton: {
        height: 44,
        borderRadius: 14,
        backgroundColor: PRIMARY,
        paddingHorizontal: 20,
        justifyContent: "center",
      },
      notFoundButtonText: { color: "#fff", fontWeight: "800" },
      loadingState: { flex: 1, alignItems: "center", gap: 12, paddingHorizontal: 24 },
      loadingText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },

      hero: {
        width: "100%",
        overflow: "hidden",
        backgroundColor: "#0E1318",
        alignSelf: "center",
        maxWidth: PAPER_MAX,
      },
      topBar: {
        paddingHorizontal: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      heroIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.32)",
        alignItems: "center",
        justifyContent: "center",
      },
      heroCopy: {
        marginTop: "auto",
        paddingHorizontal: 22,
        paddingBottom: 42,
        maxWidth: PAPER_MAX,
        alignSelf: "center",
        width: "100%",
      },
      heroBadge: {
        alignSelf: "flex-start",
        height: 26,
        borderRadius: 7,
        paddingHorizontal: 10,
        backgroundColor: "rgba(47,158,110,0.95)",
        alignItems: "center",
        justifyContent: "center",
      },
      heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
      heroDate: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.3,
        marginTop: 14,
      },
      heroTitle: {
        color: "#fff",
        fontFamily: FONT.serif,
        fontSize: IS_WIDE ? 42 : 31,
        lineHeight: IS_WIDE ? 49 : 37,
        fontWeight: "800",
        letterSpacing: -0.3,
        marginTop: 7,
      },
      authorRow: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 18 },
      authorAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",
      },
      authorAvatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: PRIMARY },
      authorAvatarInitial: { color: "#fff", fontSize: 15, fontWeight: "800", fontFamily: FONT.serif },
      authorNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
      authorName: { color: "#fff", fontSize: 14, fontWeight: "700", flexShrink: 1 },
      authorRole: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "600", marginTop: 2 },

      body: {
        width: "100%",
        maxWidth: PAPER_MAX,
        alignSelf: "center",
        paddingHorizontal: 22,
        paddingTop: 6,
        marginTop: -18,
        backgroundColor: theme.bg,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        zIndex: 2,
      },
      actionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 22,
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      },
      actionItem: { flexDirection: "row", alignItems: "center", gap: 6 },
      actionCount: { color: theme.sub, fontSize: 13, fontWeight: "700" },
      actionSpacer: { flex: 1 },
      readingPill: { flexDirection: "row", alignItems: "center", gap: 6 },
      readingPillText: { color: theme.sub, fontSize: 12, fontWeight: "700" },

      lead: {
        color: theme.sub,
        fontFamily: FONT.serif,
        fontSize: 18,
        lineHeight: 28,
        fontWeight: "500",
        marginTop: 20,
      },
      audioWrap: { marginTop: 20 },

      previewBox: { paddingVertical: 26, alignItems: "center" },
      lockCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: theme.soft,
        alignItems: "center",
        justifyContent: "center",
      },
      previewTitle: {
        color: theme.text,
        fontFamily: FONT.serif,
        fontSize: 23,
        lineHeight: 29,
        fontWeight: "800",
        marginTop: 16,
        textAlign: "center",
      },
      previewText: { color: theme.sub, fontSize: 15, lineHeight: 24, fontWeight: "500", textAlign: "center", marginTop: 10 },
      previewButton: {
        height: 50,
        borderRadius: 14,
        paddingHorizontal: 20,
        marginTop: 20,
        backgroundColor: PRIMARY,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      },
      previewButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },

      settingsWrap: { marginTop: 22, marginBottom: 4 },
      settingsToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        backgroundColor: theme.soft,
      },
      settingsToggleText: { color: theme.text, fontSize: 13, fontWeight: "700", flex: 1 },
      settingsToggleHint: { color: PRIMARY, fontSize: 12, fontWeight: "800" },
      settingsPanel: {
        marginTop: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        gap: 16,
      },
      settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
      settingsLabel: { color: theme.sub, fontSize: 13, fontWeight: "700" },
      stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
      stepperBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        backgroundColor: theme.soft,
        alignItems: "center",
        justifyContent: "center",
      },
      stepperValue: { color: theme.text, fontSize: 14, fontWeight: "800", minWidth: 22, textAlign: "center" },
      chips: { flexDirection: "row", gap: 8 },
      chip: {
        height: 34,
        borderRadius: 999,
        paddingHorizontal: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center",
      },
      chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
      chipText: { color: theme.text, fontSize: 12, fontWeight: "700" },
      chipTextActive: { color: "#fff" },
      swatch: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center",
      },
      swatchActive: { borderColor: PRIMARY, borderWidth: 2 },
      swatchDot: { width: 12, height: 12, borderRadius: 6 },

      longread: { marginTop: 10 },
  });
}
