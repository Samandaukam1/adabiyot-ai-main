import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Bookmark, ChevronLeft, Eye, Play } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { palette } from "@/constants/colors";
import {
  books,
  getAuthor,
  getBook,
  getPublisher,
  reels,
  type Author,
  type Book,
} from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

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

function collectPoemReels(book: Book) {
  const seen = new Set<string>();
  const relatedPoemReels = reels.filter((reel) => {
    const relatedBook = reel.relatedBookId ? getBook(reel.relatedBookId) : undefined;
    return (
      reel.relatedBookId === book.id ||
      (relatedBook?.category === "She'r" && relatedBook.authorId === book.authorId)
    );
  });
  const fallbackPoemReels = reels.filter((reel) => {
    const relatedBook = reel.relatedBookId ? getBook(reel.relatedBookId) : undefined;
    return relatedBook?.category === "She'r";
  });

  return [...relatedPoemReels, ...fallbackPoemReels]
    .filter((reel) => {
      if (seen.has(reel.id)) return false;
      seen.add(reel.id);
      return true;
    })
    .slice(0, 4);
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

function buildPerformanceCards(book: Book): CompactAudioItem[] {
  return collectPoemReels(book).map((reel, index) => ({
    id: reel.id,
    title: reel.title,
    subtitle: getAuthor(reel.authorId)?.name ?? "Ijrochi",
    thumbnail: getAuthor(reel.authorId)?.photo ?? reel.poster,
    durationSeconds: 120 + index * 17 + (reel.comments % 35),
    views: reel.likes * 12 + reel.comments * 8,
    reelId: reel.id,
  }));
}

function buildVideoCards(book: Book) {
  return collectPoemReels(book).map((reel) => ({
    id: reel.id,
    title: reel.title,
    performer: getAuthor(reel.authorId)?.name ?? "Ijrochi",
    thumbnail: reel.poster,
  }));
}

function formatLicenseFee(value: number): string {
  return value === 0 ? "bepul" : `${value.toLocaleString()} so'm`;
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
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
}: {
  item: CompactAudioItem;
  onPress?: () => void;
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
}: {
  item: { id: string; title: string; performer: string; thumbnail: string };
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.videoCard}>
      <Image source={{ uri: item.thumbnail }} style={styles.videoThumb} contentFit="cover" />
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

export default function PoemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const book = useMemo(() => getBook(String(id)), [id]);
  const author = useMemo(() => (book ? getAuthor(book.authorId) : undefined), [book]);
  const publisher = useMemo(() => (book ? getPublisher(book.publisherId) : undefined), [book]);
  const { savedBookIds, purchasedBookIds, toggleSaveBook, buyBook, addHistory } = useApp();
  const [poemFontScale, setPoemFontScale] = useState(1);

  const poemPreset = useMemo(() => (book ? getPoemPreset(book, author) : null), [book, author]);
  const performances = useMemo(() => (book ? buildPerformanceCards(book) : []), [book]);
  const videos = useMemo(() => (book ? buildVideoCards(book) : []), [book]);

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
    if (book && book.category !== "She'r") {
      router.replace(`/reader/${book.id}`);
    }
  }, [book]);

  useEffect(() => {
    if (book) {
      addHistory(book.id);
    }
  }, [book, addHistory]);

  if (!book) {
    return (
      <Screen>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>She'r topilmadi</Text>
        </View>
      </Screen>
    );
  }

  if (book.category !== "She'r" || !poemPreset) {
    return null;
  }

  const saved = savedBookIds.includes(book.id);
  const purchased = purchasedBookIds.includes(book.id) || book.free;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
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
            <Pressable onPress={() => toggleSaveBook(book.id)} style={styles.iconBtn}>
              <Bookmark
                color={saved ? palette.primary : palette.text}
                fill={saved ? palette.primary : "transparent"}
                size={18}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroWrap}>
          <Text style={styles.kicker}>She'r sahifasi</Text>
          <Text style={styles.poemTitle}>{book.title}</Text>
          <Text style={styles.poemAuthor}>{author?.name}</Text>
          <Text style={styles.moodLine}>{poemPreset.moodLine}</Text>
        </View>

        <View style={styles.poemPage}>
          {poemPreset.stanzas.map((stanza, index) => (
            <View key={`${book.id}-stanza-${index}`} style={styles.stanzaWrap}>
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

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Asar haqida</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Sana</Text>
            <Text style={styles.metaValue}>{poemPreset.publishedAt}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Muallif</Text>
            <Text style={styles.metaValue}>{author?.name}</Text>
          </View>
          {publisher ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Nashr</Text>
              <Text style={styles.metaValue}>{publisher.name}</Text>
            </View>
          ) : null}
          <View style={styles.certificatePill}>
            <Text style={styles.certificateText}>Ushbu she'r mualliflik sertifikatiga ega</Text>
          </View>
        </View>

        <View style={styles.licenseCard}>
          <Text style={styles.licenseLabel}>Ijro uchun</Text>
          <Text style={styles.licenseValue}>{formatLicenseFee(poemPreset.licenseFee)}</Text>
          <Text style={styles.licenseNote}>
            Sahna, studiya va media ijrolari uchun litsenziya so'rovi shu joydan boshlanadi.
          </Text>
        </View>

        <PressableScale onPress={() => buyBook(book.id)} style={styles.purchaseBtn}>
          <Text style={styles.purchaseBtnText}>SHERNI HARID QILISH</Text>
        </PressableScale>
        {purchased ? <Text style={styles.purchaseState}>She'r sizning kutubxonangizda mavjud.</Text> : null}

        <View style={styles.sectionWrap}>
          <SectionHeader title="Monologlar" action="Barchasi" onAction={() => router.push("/reels")} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.audioRow}
          >
            {performances.map((item) => (
              <CompactAudioCard
                key={item.id}
                item={item}
                onPress={() =>
                  router.push({
                    pathname: "/poem-audio/[bookId]",
                    params: {
                      bookId: book.id,
                      kind: "monologue",
                      itemId: item.id,
                      title: item.title,
                      artist: item.subtitle,
                      artwork: item.thumbnail,
                      durationSeconds: String(item.durationSeconds),
                      views: String(item.views),
                      poemTitle: book.title,
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

        <View style={styles.sectionWrap}>
          <SectionHeader
            title="Sher asosida aytilgan qo'shiqlar"
            action="Barchasi"
            onAction={book.audioAvailable ? () => router.push(`/audio/${book.id}`) : undefined}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.audioRow}
          >
            {poemPreset.songs.map((song) => (
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
                onPress={() =>
                  router.push({
                    pathname: "/poem-audio/[bookId]",
                    params: {
                      bookId: book.id,
                      kind: "song",
                      itemId: song.id,
                      title: song.title,
                      artist: song.artist,
                      artwork: song.cover,
                      durationSeconds: String(song.durationSeconds),
                      views: String(song.views),
                      poemTitle: book.title,
                    },
                  })
                }
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionWrap}>
          <SectionHeader title="Videolar" action="Barchasi" onAction={() => router.push("/reels")} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.videoRow}
          >
            {videos.map((item) => (
              <VideoPreviewCard
                key={item.id}
                item={item}
                onPress={() => router.push({ pathname: "/reels", params: { reelId: item.id } })}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 14,
    width: "100%",
  },
  poemAuthor: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
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
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    marginTop: 6,
  },
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
});