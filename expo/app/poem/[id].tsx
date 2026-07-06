import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Eye, Info, Lock, Play, ShoppingBag, Sparkles } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import RatingReviewBlock from "@/components/RatingReviewBlock";
import ContentHeaderActions from "@/components/ContentHeaderActions";
import { recordReading } from "@/lib/shelfStore";
import {
  books,
  getAuthor,
  getBook,
  getPublisher,
  type Author,
  type Book,
} from "@/mocks/content";
import { usePublishedBook } from "@/hooks/usePublishedBooks";
import { usePublicReels } from "@/hooks/useReels";
import { useApp } from "@/providers/AppProvider";
import { useAuth } from "@/providers/AuthProvider";
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
import { useTheme } from "@/providers/ThemeProvider";
import type { PublicReel } from "@/lib/reels";

const { width: SCREEN_W } = Dimensions.get("window");
const AUDIO_CARD_W = Math.round(SCREEN_W * 0.82);
const VIDEO_CARD_W = Math.round(SCREEN_W * 0.42);
const VIDEO_CARD_H = Math.round((VIDEO_CARD_W * 16) / 9);

type SongCardItem = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  durationSeconds: number;
  views: number;
};

type CompactAudioItem = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  durationSeconds: number;
  views: number;
  reelId?: string;
};

type PoemPreset = {
  publishedAt: string;
  licenseFee: number;
  moodLine: string;
  stanzas: string[];
  songs: SongCardItem[];
};

const POEM_PRESETS: Record<string, PoemPreset> = {
  b2: {
    publishedAt: "12 fevral 2026",
    licenseFee: 300_000,
    moodLine: "Shahar shovqini ichida yolg'izlikning eng sokin ovozi eshitiladi.",
    stanzas: [
      "Men bu shaharda yolg'iz emasman,\nammo hech kim meni tanimaydi.",
      "Har bir deraza - bir hikoya,\nhar bir chiroq - bir yurak.",
      "Tun bilan so'zlashaman,\nyulduzlar menga sekin javob beradi.",
      "Shahar meni eslamas balki,\nlekin mening sukutim unda qoladi.",
    ],
    songs: [
      {
        id: "b2-song-1",
        title: "Tun va derazalar",
        artist: "OhangLab Session",
        cover: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=900",
        durationSeconds: 142,
        views: 21400,
      },
      {
        id: "b2-song-2",
        title: "Yolg'iz shahar",
        artist: "Aziza Murodova",
        cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=900",
        durationSeconds: 194,
        views: 16800,
      },
      {
        id: "b2-song-3",
        title: "Tungi ko'cha akustik",
        artist: "Sokin Project",
        cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900",
        durationSeconds: 166,
        views: 12300,
      },
    ],
  },
  b6: {
    publishedAt: "03 mart 2026",
    licenseFee: 180_000,
    moodLine: "Yomg'ir tomchilari bilan yozilgan sevgi va kutish satrlari.",
    stanzas: [
      "Yomg'ir yog'ardi.\nMen seni kutardim, ammo sen kelmading.",
      "Deraza bo'yida qolgan izlar\nsening jimligingdek sovuq edi.",
      "Tomchilar ko'chalarni yuvdi,\nlekin yurakdagi changni emas.",
      "Shundan beri har bir yomg'ir\nsening nomingni qaytaradi.",
    ],
    songs: [
      {
        id: "b6-song-1",
        title: "Tomchilar ostida",
        artist: "OhangLab Live",
        cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900",
        durationSeconds: 158,
        views: 19200,
      },
      {
        id: "b6-song-2",
        title: "Kelmagan kecha",
        artist: "Rayhon Karim",
        cover: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=900",
        durationSeconds: 201,
        views: 15100,
      },
      {
        id: "b6-song-3",
        title: "Yomg'irli pianino",
        artist: "Nozik Ohang",
        cover: "https://images.unsplash.com/photo-1516280030429-27679b3dc9cf?w=900",
        durationSeconds: 175,
        views: 9800,
      },
    ],
  },
  b8: {
    publishedAt: "21 aprel 2026",
    licenseFee: 0,
    moodLine: "Yurakning o'z tili bor, u ovozdan oldin ham eshitiladi.",
    stanzas: [
      "Yurak tilida gapiring,\ntushunmasalar ham.",
      "Ba'zi so'zlar quloqqa emas,\nfaqat ichki sukunatga yetib boradi.",
      "Bir kuni eshitadilar,\nbalki bugun emas, ertaga ham emas.",
      "Ammo chin satr hech qachon\nhech kimga begona bo'lib qolmaydi.",
    ],
    songs: [
      {
        id: "b8-song-1",
        title: "Yurak tilida",
        artist: "OhangLab Acoustic",
        cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=900",
        durationSeconds: 162,
        views: 24400,
      },
      {
        id: "b8-song-2",
        title: "Eshitadilar",
        artist: "Dilafruz Ensemble",
        cover: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=900",
        durationSeconds: 188,
        views: 17300,
      },
      {
        id: "b8-song-3",
        title: "Jim ovozlar",
        artist: "Sado Trio",
        cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900",
        durationSeconds: 149,
        views: 11800,
      },
    ],
  },
};

function buildFallbackStanzas(book: Book): string[] {
  const paragraphBlocks = book.excerpt
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphBlocks.length >= 2) {
    return paragraphBlocks;
  }

  const lines = book.excerpt
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 4) {
    const grouped: string[] = [];
    for (let index = 0; index < lines.length; index += 2) {
      grouped.push(lines.slice(index, index + 2).join("\n"));
    }
    return grouped;
  }

  const descriptionParts = book.description
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return [lines.join("\n"), ...descriptionParts].filter(Boolean);
}

function buildFallbackSongs(book: Book, author?: Author): SongCardItem[] {
  const alternatePoems = books.filter((item) => item.category === "She'r" && item.id !== book.id);

  return [
    {
      id: `${book.id}-song-1`,
      title: `${book.title} akustik`,
      artist: author?.name ?? "OhangLab Session",
      cover: book.cover,
      durationSeconds: 154,
      views: 12800,
    },
    {
      id: `${book.id}-song-2`,
      title: `${book.title} live version`,
      artist: "OhangLab Live",
      cover: alternatePoems[0]?.cover ?? book.cover,
      durationSeconds: 186,
      views: 9400,
    },
    {
      id: `${book.id}-song-3`,
      title: `${book.title} piano mix`,
      artist: "Sokin Project",
      cover: alternatePoems[1]?.cover ?? book.cover,
      durationSeconds: 171,
      views: 7600,
    },
  ];
}

function getPoemPreset(book: Book, author?: Author): PoemPreset {
  return (
    POEM_PRESETS[book.id] ?? {
      publishedAt: "05 may 2026",
      licenseFee: book.free ? 0 : 150_000,
      moodLine: "So'zlar sahifada emas, kayfiyatda davom etadigan she'riy tajriba.",
      stanzas: buildFallbackStanzas(book),
      songs: buildFallbackSongs(book, author),
    }
  );
}

function formatCompactMetric(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return value.toString();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function buildVideoCards(source: PublicReel[]) {
  return source.slice(0, 4).map((reel) => ({
    id: reel.id,
    title: reel.title,
    performer: reel.creatorName ?? "Ijodkor",
    thumbnail: reel.thumbnailUrl,
  }));
}

function formatLicenseFee(value: number): string {
  return value === 0 ? "bepul" : `${value.toLocaleString()} so'm`;
}

type StylesType = ReturnType<typeof createStyles>;

function SectionHeader({
  title,
  action,
  onAction,
  styles,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  styles: StylesType;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        onAction ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={styles.sectionAction}>{action}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionAction}>{action}</Text>
        )
      ) : null}
    </View>
  );
}

function CompactAudioCard({
  item,
  onPress,
  palette,
  styles,
}: {
  item: CompactAudioItem;
  onPress?: () => void;
  palette: AppTheme;
  styles: StylesType;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.audioCard}>
      <View style={styles.audioPlayButton}>
        <Play color="#fff" fill="#fff" size={16} />
      </View>
      <View style={styles.audioContent}>
        <Text style={styles.audioTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.audioSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <View style={styles.audioMetaCol}>
        <View style={styles.audioMetricRow}>
          <Eye color={palette.textMuted} size={13} />
          <Text style={styles.audioMetricText}>{formatCompactMetric(item.views)}</Text>
        </View>
        <Text style={styles.audioDuration}>{formatDuration(item.durationSeconds)}</Text>
      </View>
    </PressableScale>
  );
}

function VideoPreviewCard({
  item,
  onPress,
  styles,
}: {
  item: { id: string; title: string; performer: string; thumbnail: string | null };
  onPress?: () => void;
  styles: StylesType;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.videoCard}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.videoThumb} contentFit="cover" />
      ) : (
        <View style={styles.videoThumb} />
      )}
      <LinearGradient
        colors={["transparent", "rgba(17,17,17,0.12)", "rgba(17,17,17,0.84)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.videoPlayBadge}>
        <Play color="#fff" fill="#fff" size={16} />
      </View>
      <View style={styles.videoTextWrap}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.videoPerformer} numberOfLines={1}>
          {item.performer}
        </Text>
      </View>
    </PressableScale>
  );
}

type PoemView = {
  id: string;
  title: string;
  authorName: string;
  publisherName?: string;
  moodLine: string;
  stanzas: string[];
  publishedAt: string;
  licenseFee: number;
  free: boolean;
  audioAvailable: boolean;
  performances: CompactAudioItem[];
  songs: SongCardItem[];
  videos: { id: string; title: string; performer: string; thumbnail: string | null }[];
};

function splitPoemStanzas(content: string | null): string[] {
  if (!content) return [];
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const byBlankLine = normalized
    .split(/\n[ \t]*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return byBlankLine.length > 0 ? byBlankLine : [normalized];
}

function formatPoemDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function PoemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors: palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const mockBook = useMemo(() => getBook(String(id)), [id]);
  const { book: supaBook, loading: supaLoading } = usePublishedBook(
    mockBook ? "" : String(id ?? "")
  );
  const author = useMemo(() => (mockBook ? getAuthor(mockBook.authorId) : undefined), [mockBook]);
  const publisher = useMemo(
    () => (mockBook ? getPublisher(mockBook.publisherId) : undefined),
    [mockBook]
  );
  const { savedBookIds, toggleSaveBook, addHistory } = useApp();
  const { isAuthenticated, userId, refreshProfileRow } = useAuth();
  const { reels: publicReels } = usePublicReels(userId);
  const [poemFontScale, setPoemFontScale] = useState(1);
  const [infoOpen, setInfoOpen] = useState(false);

  const poemPreset = useMemo(
    () => (mockBook ? getPoemPreset(mockBook, author) : null),
    [mockBook, author]
  );
  const realVideos = useMemo(() => buildVideoCards(publicReels), [publicReels]);

  const isSupaPoem =
    !mockBook && !!supaBook && (supaBook.genre === "She'r" || supaBook.contentMode === "poem");

  const vm = useMemo<PoemView | null>(() => {
    if (mockBook && poemPreset) {
      return {
        id: mockBook.id,
        title: mockBook.title,
        authorName: author?.name ?? "",
        publisherName: publisher?.name,
        moodLine: poemPreset.moodLine,
        stanzas: poemPreset.stanzas,
        publishedAt: poemPreset.publishedAt,
        licenseFee: poemPreset.licenseFee,
        free: mockBook.free,
        audioAvailable: mockBook.audioAvailable,
        performances: [],
        songs: poemPreset.songs,
        videos: realVideos,
      };
    }
    if (isSupaPoem && supaBook) {
      const stanzas = splitPoemStanzas(supaBook.cleanedContent);
      return {
        id: supaBook.id,
        title: supaBook.title,
        authorName: supaBook.authorName,
        publisherName: supaBook.publisherName || undefined,
        moodLine:
          supaBook.description ||
          "So'zlar sahifada emas, kayfiyatda davom etadigan she'riy tajriba.",
        stanzas: stanzas.length > 0 ? stanzas : ["She'r matni hali yuklanmagan."],
        publishedAt: formatPoemDate(supaBook.createdAt),
        licenseFee: supaBook.isFree ? 0 : supaBook.price,
        free: supaBook.isFree,
        audioAvailable: !!supaBook.audioUrl,
        performances: [],
        songs: [],
        videos: realVideos,
      };
    }
    return null;
  }, [mockBook, poemPreset, author, publisher, realVideos, isSupaPoem, supaBook]);

  const access = useContentAccess("poem", vm?.id);
  const purchaseFlow = usePurchaseFlow();
  const paymentProductQuery = usePaymentProduct("poem", vm?.id);
  const paymentProduct = paymentProductQuery.data ?? null;
  const promo = usePromo({
    contentType: paymentProduct?.content_type ?? "poem",
    contentId: paymentProduct?.content_id ?? vm?.id,
    productId: paymentProduct?.id,
  });
  const [showBuy, setShowBuy] = useState(false);

  const canZoomOut = poemFontScale > 0.88;
  const canZoomIn = poemFontScale < 1.28;

  const updatePoemScale = (delta: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPoemFontScale((current) => Math.max(0.88, Math.min(1.28, Number((current + delta).toFixed(2)))));
  };

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (mockBook && mockBook.category !== "She'r") {
      router.replace(`/reader/${mockBook.id}`);
    }
  }, [mockBook]);

  useEffect(() => {
    if (!mockBook && supaBook && supaBook.genre !== "She'r" && supaBook.contentMode !== "poem") {
      router.replace(`/book/${supaBook.id}`);
    }
  }, [mockBook, supaBook]);

  useEffect(() => {
    if (vm) {
      addHistory(vm.id);
    }
  }, [vm, addHistory]);

  // Record on the "O'qilayotganlar" shelf once the full poem is readable.
  useEffect(() => {
    if (vm && (vm.free || access.hasAccess)) {
      recordReading({
        contentType: "poem",
        contentId: vm.id,
        title: vm.title,
        cover: mockBook?.cover ?? supaBook?.cover ?? null,
        author: vm.authorName || null,
      });
    }
  }, [vm, access.hasAccess, mockBook?.cover, supaBook?.cover]);

  if (!mockBook && supaLoading) {
    return (
      <Screen>
        <View style={styles.missingWrap}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!vm) {
    return (
      <Screen>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>She'r topilmadi</Text>
        </View>
      </Screen>
    );
  }

  const saved = savedBookIds.includes(vm.id);
  const purchased = vm.free || access.hasAccess;
  const poemPrice = vm.free ? 0 : paymentProduct?.amount_uzs ?? vm.licenseFee;
  // Paid she'r the user doesn't own → show only ~1/4 of the stanzas as a parcha.
  const previewStanzas = purchased
    ? vm.stanzas
    : vm.stanzas.slice(0, Math.max(2, Math.ceil(vm.stanzas.length * 0.25)));
  const stanzaLocked = !purchased && previewStanzas.length < vm.stanzas.length;
  const openBuy = () => {
    if (!isAuthenticated) {
      router.push("/auth");
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

  const handleStartCreating = async () => {
    await refreshProfileRow().catch(() => {});
    router.push({
      pathname: "/creator/submit",
      params: {
        linkedContentType: "poem",
        linkedContentId: vm.id,
        linkedContentTitle: vm.title,
      },
    });
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48 }}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft color={palette.text} size={20} />
          </Pressable>
          <View style={styles.topActions}>
            <PressableScale
              onPress={canZoomOut ? () => updatePoemScale(-0.08) : undefined}
              style={canZoomOut ? styles.zoomBtn : [styles.zoomBtn, styles.zoomBtnDisabled]}
            >
              <Text style={[styles.zoomBtnText, !canZoomOut && styles.zoomBtnTextDisabled]}>A-</Text>
            </PressableScale>
            <PressableScale
              onPress={canZoomIn ? () => updatePoemScale(0.08) : undefined}
              style={canZoomIn ? styles.zoomBtn : [styles.zoomBtn, styles.zoomBtnDisabled]}
            >
              <Text style={[styles.zoomBtnText, !canZoomIn && styles.zoomBtnTextDisabled]}>A+</Text>
            </PressableScale>
            <Pressable onPress={() => setInfoOpen(true)} style={styles.iconBtn}>
              <Info color={palette.text} size={18} />
            </Pressable>
            <ContentHeaderActions
              contentType="poem"
              contentId={vm.id}
              title={vm.title}
              author={vm.authorName}
              cover={mockBook?.cover ?? supaBook?.cover ?? null}
              description={vm.moodLine}
              c={palette}
              isDark={isDark}
            />
          </View>
        </View>

        <View style={styles.heroWrap}>
          {vm.authorName ? <Text style={styles.poemAuthor}>{vm.authorName}</Text> : null}
          <Text style={styles.poemTitle}>{vm.title}</Text>
        </View>

        <View style={styles.poemPage}>
          {previewStanzas.map((stanza, index) => (
            <View key={`${vm.id}-stanza-${index}`} style={styles.stanzaWrap}>
              <Text
                style={[
                  styles.stanzaText,
                  {
                    fontSize: 23 * poemFontScale,
                    lineHeight: 31 * poemFontScale,
                  },
                ]}
              >
                {stanza}
              </Text>
            </View>
          ))}
        </View>

        {stanzaLocked ? (
          <View style={styles.poemPaywall}>
            <View style={styles.poemPaywallIcon}>
              <Lock color={palette.primary} size={20} />
            </View>
            <Text style={styles.poemPaywallTitle}>
              Bu asarning davomini o'qish uchun xarid qiling.
            </Text>
            <Text style={styles.poemPaywallText}>
              Yuqorida she'rning parchasi ko'rsatildi. To'liq matn xariddan keyin ochiladi.
            </Text>
            <PressableScale onPress={openBuy} style={styles.poemPaywallBtn}>
              <ShoppingBag color="#fff" size={16} />
              <Text style={styles.poemPaywallBtnText}>To'liq o'qish uchun sotib olish</Text>
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.licenseCard}>
          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>Ijro uchun</Text>
            <Text style={styles.licenseValue}>{formatLicenseFee(poemPrice)}</Text>
          </View>
          {promo.isActive && !purchased && !vm.free ? (
            <View style={{ marginTop: 14 }}>
              <PromoPriceBlock
                isActive={promo.isActive}
                originalAmount={promo.pricing?.original_amount_uzs ?? poemPrice}
                finalAmount={promo.pricing?.final_amount_uzs ?? poemPrice}
                discountPercent={promo.pricing?.discount_percent ?? 0}
                promoCode={promo.appliedCode ?? ""}
                endsAt={promo.endsAt}
              />
            </View>
          ) : null}
          <PressableScale onPress={handleStartCreating} style={styles.createBtn}>
            <Sparkles color="#fff" size={16} />
            <Text style={styles.createBtnText}>Ushbu she'r bilan ijodni boshlash</Text>
          </PressableScale>
          {purchased ? (
            <Text style={styles.purchaseState}>She'r sizning kutubxonangizda mavjud.</Text>
          ) : (
            <PressableScale onPress={openBuy} style={styles.purchaseBtnOutline}>
              <Text style={styles.purchaseBtnOutlineText}>She'rni xarid qilish</Text>
            </PressableScale>
          )}
        </View>

        {vm.performances.length > 0 ? (
          <>
            <View style={styles.sectionWrap}>
              <SectionHeader title="Monologlar" action="Barchasi" onAction={() => router.push("/reels")} styles={styles} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.audioRow}
              >
                {vm.performances.map((item) => (
                  <CompactAudioCard
                    key={item.id}
                    item={item}
                    palette={palette}
                    styles={styles}
                    onPress={() =>
                      router.push({
                        pathname: "/poem-audio/[bookId]",
                        params: {
                          bookId: vm.id,
                          kind: "monologue",
                          itemId: item.id,
                          title: item.title,
                          artist: item.subtitle,
                          artwork: item.thumbnail,
                          durationSeconds: String(item.durationSeconds),
                          views: String(item.views),
                          poemTitle: vm.title,
                        },
                      })
                    }
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.partnerRow}>
              <View style={styles.partnerDot} />
              <Text style={styles.partnerText}>OhangLab ilovasi bilan hamkorlikda</Text>
            </View>
          </>
        ) : null}

        {vm.songs.length > 0 ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Sher asosida aytilgan qo'shiqlar"
              action="Barchasi"
              onAction={vm.audioAvailable ? () => router.push(`/audio/${vm.id}`) : undefined}
              styles={styles}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.audioRow}
            >
              {vm.songs.map((song) => (
                <CompactAudioCard
                  key={song.id}
                  item={{
                    id: song.id,
                    title: song.title,
                    subtitle: song.artist,
                    thumbnail: song.cover,
                    durationSeconds: song.durationSeconds,
                    views: song.views,
                  }}
                  palette={palette}
                  styles={styles}
                  onPress={() =>
                    router.push({
                      pathname: "/poem-audio/[bookId]",
                      params: {
                        bookId: vm.id,
                        kind: "song",
                        itemId: song.id,
                        title: song.title,
                        artist: song.artist,
                        artwork: song.cover,
                        durationSeconds: String(song.durationSeconds),
                        views: String(song.views),
                        poemTitle: vm.title,
                      },
                    })
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {vm.videos.length > 0 ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Videolar" action="Barchasi" onAction={() => router.push("/reels")} styles={styles} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.videoRow}
            >
              {vm.videos.map((item) => (
                <VideoPreviewCard
                  key={item.id}
                  item={item}
                  styles={styles}
                  onPress={() => router.push({ pathname: "/reels", params: { reelId: item.id } })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
        <RatingReviewBlock
          contentType="poem"
          contentId={vm.id}
          title={vm.title}
          author={vm.authorName}
        />
      </ScrollView>

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.infoTitle}>Asar haqida</Text>
            {vm.moodLine ? <Text style={styles.infoDesc}>{vm.moodLine}</Text> : null}
            {vm.publishedAt ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sana</Text>
                <Text style={styles.infoValue}>{vm.publishedAt}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Muallif</Text>
              <Text style={styles.infoValue}>{vm.authorName}</Text>
            </View>
            {vm.publisherName ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nashr</Text>
                <Text style={styles.infoValue}>{vm.publisherName}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ijro narxi</Text>
              <Text style={styles.infoValue}>{formatLicenseFee(poemPrice)}</Text>
            </View>
            <View style={styles.certificatePill}>
              <Text style={styles.certificateText}>Ushbu she'r mualliflik sertifikatiga ega</Text>
            </View>
            <PressableScale onPress={() => setInfoOpen(false)} style={styles.infoCloseBtn}>
              <Text style={styles.infoCloseText}>Yopish</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      <BuyConfirmSheet
        visible={showBuy}
        title={vm.title}
        priceUzs={poemPrice}
        benefits={["She'rni kutubxonangizga qo'shish", "Doimiy kirish huquqi"]}
        onConfirm={confirmBuy}
        onClose={() => setShowBuy(false)}
        promo={promo}
      />
      <CardPaymentSheet
        flow={purchaseFlow}
        title={vm.title}
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

function createStyles(palette: AppTheme) {
  return StyleSheet.create({
  missingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  missingText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "600",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  zoomBtn: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  zoomBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  zoomBtnText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  zoomBtnTextDisabled: {
    color: palette.textMuted,
  },
  heroWrap: {
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginTop: 26,
    width: "100%",
  },
  kicker: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    textAlign: "left",
  },
  poemTitle: {
    color: palette.text,
    fontSize: 38,
    lineHeight: 44,
    fontFamily: FONT.serif,
    textAlign: "left",
    marginTop: 8,
    width: "100%",
  },
  poemAuthor: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: 0,
    textAlign: "left",
  },
  moodLine: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "left",
    marginTop: 14,
    maxWidth: 340,
  },
  poemPage: {
    marginTop: 34,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 14,
  },
  stanzaWrap: {
    width: "100%",
  },
  stanzaText: {
    color: palette.text,
    fontSize: 23,
    lineHeight: 31,
    textAlign: "left",
    fontFamily: FONT.serif,
  },
  metaCard: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 20,
    borderRadius: 24,
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  metaTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "left",
  },
  metaRow: {
    paddingVertical: 8,
    alignItems: "flex-start",
  },
  metaLabel: {
    color: "#666666",
    fontSize: 13,
  },
  metaValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "left",
    marginTop: 4,
  },
  certificatePill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  certificateText: {
    color: palette.primary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  licenseCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: palette.surface,
  },
  licenseLabel: {
    color: "#666666",
    fontSize: 13,
  },
  licenseValue: {
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  licenseRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  purchaseBtnOutline: {
    height: 50,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "transparent",
  },
  purchaseBtnOutlineText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13,27,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  infoCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: palette.bgCard,
    borderRadius: 24,
    padding: 22,
  },
  infoTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: FONT.serif,
    marginBottom: 14,
  },
  infoDesc: {
    color: "#888888",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  infoLabel: { color: "#888", fontSize: 13 },
  infoValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  infoCloseBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
  },
  infoCloseText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  licenseNote: {
    color: "#666666",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  purchaseBtn: {
    marginHorizontal: 20,
    marginTop: 18,
    height: 58,
    borderRadius: 24,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  purchaseBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  purchaseState: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "left",
    marginHorizontal: 20,
    marginTop: 10,
  },
  sectionWrap: {
    marginTop: 34,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionAction: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  audioRow: {
    paddingHorizontal: 20,
    gap: 14,
  },
  audioCard: {
    width: AUDIO_CARD_W,
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: palette.bgCard,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  audioContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  audioTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  audioSubtitle: {
    color: "#666666",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  audioMetaCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  audioMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  audioMetricText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  audioDuration: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 34,
    marginBottom: 8,
  },
  partnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(46,125,50,0.42)",
  },
  partnerText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "500",
  },
  videoRow: {
    paddingHorizontal: 20,
    gap: 14,
  },
  videoCard: {
    width: VIDEO_CARD_W,
    height: VIDEO_CARD_H,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  videoThumb: {
    width: "100%",
    height: "100%",
  },
  videoPlayBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(17,17,17,0.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoTextWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 24,
  },
  videoTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  videoPerformer: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    marginTop: 6,
  },
  poemPaywall: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 22,
    borderRadius: 22,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
  },
  poemPaywallIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.soft,
  },
  poemPaywallTitle: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily: FONT.serif,
    textAlign: "center",
    marginTop: 14,
  },
  poemPaywallText: {
    color: palette.textDim,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  poemPaywallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 22,
    marginTop: 18,
    backgroundColor: palette.primary,
  },
  poemPaywallBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
}
