import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Download,
  Film,
  Headphones,
  Highlighter,
  List,
  Music2,
  Minus,
  Palette,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Shield,
  Star,
  Type,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import {
  getAuthor,
  getPublisher,
  getScreenplay,
  type Screenplay,
  type ScreenplayImageKey,
  type ScreenplayLine,
  type ScreenplayMusicTrack,
  type ScreenplayScene,
} from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WIDE = SCREEN_W >= 720;
const PAPER_MAX_WIDTH = 760;
const PAPER_SIDE_PADDING = IS_WIDE ? 62 : 22;
const AUTO_LINE_HEIGHT = 1.55;

const SCENE_IMAGES: Record<ScreenplayImageKey, number> = {
  "yomgir-scene-1": require("../../assets/images/ssenariy-yomgir-scene-1.png"),
  "yomgir-scene-2": require("../../assets/images/ssenariy-yomgir-scene-2.png"),
  "yomgir-scene-3": require("../../assets/images/ssenariy-yomgir-scene-3.png"),
  "yomgir-scene-4": require("../../assets/images/ssenariy-yomgir-scene-4.png"),
};

const PAGE_THEMES = {
  oq: {
    label: "Oq",
    bg: "#FFFFFF",
    text: "#181713",
    sub: "#6D675F",
    border: "rgba(28,26,23,0.07)",
  },
  krem: {
    label: "Krem",
    bg: "#FFF8EA",
    text: "#211A12",
    sub: "#70624D",
    border: "rgba(46,125,50,0.12)",
  },
  yashil: {
    label: "Yashil",
    bg: "#F5FAF1",
    text: "#172017",
    sub: "#65705F",
    border: "rgba(46,125,50,0.15)",
  },
  tungi: {
    label: "Tungi",
    bg: "#1A1D18",
    text: "#F7F0E4",
    sub: "#C8BFAA",
    border: "rgba(255,255,255,0.11)",
  },
} as const;

type PageThemeKey = keyof typeof PAGE_THEMES;
type FontKey = "screenplay" | "serif" | "classic";
type MarkColor = "yellow" | "green" | "blue" | "rose";

interface MarkState {
  color: MarkColor;
}

interface SearchResult {
  sceneId: string;
  lineId: string;
  sceneNumber: number;
  sceneTitle: string;
  snippet: string;
}

const MARK_BG: Record<MarkColor, string> = {
  yellow: "rgba(255, 213, 79, 0.34)",
  green: "rgba(76, 175, 80, 0.20)",
  blue: "rgba(66, 165, 245, 0.19)",
  rose: "rgba(236, 112, 99, 0.18)",
};

const MARK_LABELS: Record<MarkColor, string> = {
  yellow: "Sariq",
  green: "Yashil",
  blue: "Ko'k",
  rose: "Pushti",
};

const READER_FONTS: Record<FontKey, string> = {
  screenplay: FONT.mono,
  serif: FONT.serif,
  classic: FONT.classic,
};

const CHARACTER_ROLES: Record<string, string> = {
  AZIZ: "Yosh ssenarist, otasining tugallanmagan filmiga qaytadi",
  MUNISA: "Xotira va haqiqat orasidagi yo'l ko'rsatuvchi",
  REJISSYOR: "Sahnadagi sukut va ritmni boshqaruvchi ovoz",
};

const RELATED_SCREENPLAY_CARDS = [
  {
    id: "related-screenplay-1",
    title: "Sukunat Kadri",
    subtitle: "Adabiyot AI Studio · Ijtimoiy drama",
    imageKey: "yomgir-scene-2" as ScreenplayImageKey,
  },
  {
    id: "related-screenplay-2",
    title: "So'nggi Dubl",
    subtitle: "Adabiyot AI Studio · Kamera dramasi",
    imageKey: "yomgir-scene-4" as ScreenplayImageKey,
  },
  {
    id: "related-screenplay-3",
    title: "Kechki Repetitsiya",
    subtitle: "Adabiyot AI Studio · Romantik drama",
    imageKey: "yomgir-scene-3" as ScreenplayImageKey,
  },
];

export default function ScreenplayReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const screenplay = useMemo(() => getScreenplay(String(id)), [id]);
  const author = useMemo(() => (screenplay ? getAuthor(screenplay.authorId) : undefined), [screenplay]);
  const publisher = useMemo(() => (screenplay ? getPublisher(screenplay.publisherId) : undefined), [screenplay]);
  const { savedBookIds, toggleSaveBook } = useApp();

  const scrollRef = useRef<ScrollView>(null);
  const sceneOffsets = useRef<Record<string, number>>({});
  const documentOffsetY = useRef(0);
  const sceneListOffsetY = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeSceneId, setActiveSceneId] = useState<string | null>(screenplay?.scenes[0]?.id ?? null);
  const [readingStarted, setReadingStarted] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearchLineId, setActiveSearchLineId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(16);
  const lineHeight = AUTO_LINE_HEIGHT;
  const [fontKey, setFontKey] = useState<FontKey>("screenplay");
  const [pageTheme, setPageTheme] = useState<PageThemeKey>("oq");
  const [markerMode, setMarkerMode] = useState<boolean>(false);
  const [markColor, setMarkColor] = useState<MarkColor>("yellow");
  const [marks, setMarks] = useState<Record<string, MarkState>>({});
  const [marksReadyFor, setMarksReadyFor] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!screenplay) return;
    setActiveSceneId(screenplay.scenes[0]?.id ?? null);
    setReadingStarted(false);
    setFocusMode(false);
    setMarks({});
    setMarksReadyFor(null);
    AsyncStorage.getItem(getMarksStorageKey(screenplay.id))
      .then((raw) => {
        if (raw) setMarks(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setMarksReadyFor(screenplay.id));
  }, [screenplay]);

  useEffect(() => {
    if (!screenplay || marksReadyFor !== screenplay.id) return;
    AsyncStorage.setItem(getMarksStorageKey(screenplay.id), JSON.stringify(marks)).catch(() => {});
  }, [marks, marksReadyFor, screenplay]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (searchPulseTimer.current) clearTimeout(searchPulseTimer.current);
    };
  }, []);

  const page = PAGE_THEMES[pageTheme];
  const readerFont = READER_FONTS[fontKey];
  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!screenplay || query.length < 2) return [];

    return screenplay.scenes.flatMap((scene) =>
      scene.lines
        .filter((line) => line.text.toLowerCase().includes(query))
        .map((line) => ({
          sceneId: scene.id,
          lineId: line.id,
          sceneNumber: scene.number,
          sceneTitle: scene.title,
          snippet: buildSnippet(line.text, searchQuery),
        }))
    );
  }, [screenplay, searchQuery]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  }, []);

  const jumpToScene = useCallback((sceneId: string, lineId?: string) => {
    const y = sceneOffsets.current[sceneId] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 78), animated: true });
    setActiveSceneId(sceneId);
    setTocOpen(false);
    setSearchOpen(false);
    setFocusMode(false);

    if (lineId) {
      setActiveSearchLineId(lineId);
      if (searchPulseTimer.current) clearTimeout(searchPulseTimer.current);
      searchPulseTimer.current = setTimeout(() => setActiveSearchLineId(null), 2600);
    }
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!screenplay) return;
    const y = event.nativeEvent.contentOffset.y + 170;
    let current = screenplay.scenes[0]?.id ?? null;

    for (const scene of screenplay.scenes) {
      const sceneY = sceneOffsets.current[scene.id];
      if (typeof sceneY === "number" && sceneY <= y) current = scene.id;
    }

    if (current && current !== activeSceneId) setActiveSceneId(current);
  };

  const handleLinePress = (line: ScreenplayLine) => {
    if (markerMode) {
      setMarks((current) => ({
        ...current,
        [line.id]: { color: markColor },
      }));
      return;
    }

    setFocusMode((value) => !value);
  };

  const clearMarks = () => {
    setMarks({});
    showToast("Belgilar tozalandi");
  };

  const saved = screenplay ? savedBookIds.includes(screenplay.id) : false;

  const startReading = () => {
    setReadingStarted(true);
    setFocusMode(false);
    setSettingsOpen(false);
    setTocOpen(false);
    setSearchOpen(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 0);
  };

  const exitReading = () => {
    setReadingStarted(false);
    setFocusMode(false);
    setSettingsOpen(false);
    setTocOpen(false);
    setSearchOpen(false);
  };

  const handleShare = async () => {
    if (!screenplay) return;
    await Clipboard.setStringAsync(`${screenplay.title} · ${author?.name ?? "Muallif"} · Adabiyot AI`);
    showToast("Ssenariy havolasi nusxalandi");
  };

  const handlePdfDownload = async () => {
    if (!screenplay) return;
    try {
      const pdf = buildScreenplayPdf(screenplay, author?.name ?? "Muallif");
      const fileName = `${slugifyFileName(screenplay.title)}.pdf`;

      if (Platform.OS === "web") {
        downloadPdfOnWeb(pdf, fileName);
        showToast("PDF yuklab olindi");
        return;
      }

      if (!FileSystem.documentDirectory) {
        showToast("PDF saqlash joyi topilmadi");
        return;
      }

      await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${fileName}`, pdf, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      showToast("PDF qurilmaga saqlandi");
    } catch {
      showToast("PDF saqlashda xatolik");
    }
  };

  if (!screenplay) {
    return (
      <Screen>
        <View style={[styles.notFound, { paddingTop: insets.top + 48 }]}>
          <Text style={styles.notFoundTitle}>Ssenariy topilmadi</Text>
          <PressableScale onPress={() => router.back()} style={styles.notFoundButton}>
            <Text style={styles.notFoundButtonText}>Orqaga</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  if (!readingStarted) {
    return (
      <ScreenplayOverview
        screenplay={screenplay}
        authorName={author?.name ?? "Muallif"}
        authorPhoto={author?.photo}
        authorBio={author?.bio ?? ""}
        publisherName={publisher?.name ?? "Nashriyot"}
        publisherLogo={publisher?.logo}
        publisherAbout={publisher?.about ?? ""}
        heroImage={SCENE_IMAGES[screenplay.scenes[0].imageKey]}
        saved={saved}
        toast={toast}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        onBack={() => router.back()}
        onStart={startReading}
        onSave={() => {
          toggleSaveBook(screenplay.id);
          showToast(saved ? "Saqlashdan olindi" : "Saqlab qo'yildi");
        }}
        onShare={handleShare}
        onAudio={() => {
          setPlayingTrackId(screenplay.recommendedMusic[0]?.id ?? null);
          startReading();
        }}
      />
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={[styles.readerTopBar, { top: insets.top + 10 }]}>
        <View style={styles.readerPrimaryActions}>
          <Pressable
            onPress={exitReading}
            style={styles.toolbarButton}
            accessibilityRole="button"
            accessibilityLabel="Ssenariy oynasiga qaytish"
          >
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
          <Pressable
            onPress={handlePdfDownload}
            style={styles.toolbarButton}
            accessibilityRole="button"
            accessibilityLabel="PDF saqlab olish"
          >
            <Download color={palette.text} size={19} />
          </Pressable>
        </View>
        {!focusMode ? (
          <View style={styles.readerToolActions}>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={styles.toolbarButton}
              accessibilityRole="button"
              accessibilityLabel="O'qish sozlamalari"
            >
              <Settings color={palette.text} size={20} />
            </Pressable>
            <Pressable
              onPress={() => setTocOpen(true)}
              style={styles.toolbarButton}
              accessibilityRole="button"
              accessibilityLabel="Mundarija"
            >
              <List color={palette.text} size={20} />
            </Pressable>
            <Pressable
              onPress={() => setSearchOpen(true)}
              style={styles.toolbarButton}
              accessibilityRole="button"
              accessibilityLabel="Qidirish"
            >
              <Search color={palette.text} size={20} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 82 },
        ]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <View style={styles.paperWrap}>
          <View
            style={[
              styles.paper,
              {
                backgroundColor: page.bg,
                borderColor: page.border,
                paddingHorizontal: PAPER_SIDE_PADDING,
              },
            ]}
            onLayout={(event) => {
              documentOffsetY.current = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.readerHeader}>
              <Text style={[styles.readerTitle, { color: page.text }]}>{screenplay.title}</Text>
              <View style={styles.readerMetaRow}>
                <Text style={[styles.readerMetaText, { color: page.sub }]}>{author?.name ?? "Muallif"}</Text>
                <View style={styles.readerMetaDot} />
                <Text style={[styles.readerMetaText, { color: page.sub }]}>{screenplay.genre}</Text>
                <View style={styles.readerMetaDot} />
                <Text style={[styles.readerMetaText, { color: page.sub }]}>{screenplay.readTime}</Text>
              </View>
            </View>

            <View
              style={styles.sceneList}
              onLayout={(event) => {
                sceneListOffsetY.current = event.nativeEvent.layout.y;
              }}
            >
              {screenplay.scenes.map((scene) => {
                const track = getMusicForScene(screenplay, scene.number);
                return (
                  <React.Fragment key={scene.id}>
                    <SceneBlock
                      scene={scene}
                      active={activeSceneId === scene.id}
                      page={page}
                      fontFamily={readerFont}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      markerMode={markerMode}
                      marks={marks}
                      searchQuery={searchQuery}
                      activeSearchLineId={activeSearchLineId}
                      onPressLine={handleLinePress}
                      onLayout={(y) => {
                        sceneOffsets.current[scene.id] = documentOffsetY.current + sceneListOffsetY.current + y;
                      }}
                    />
                    {track ? (
                      <MusicBlock
                        track={track}
                        playing={playingTrackId === track.id}
                        onPress={() => setPlayingTrackId((current) => (current === track.id ? null : track.id))}
                      />
                    ) : null}
                    {shouldShowSceneImage(scene) ? (
                      <SceneImageBreak image={SCENE_IMAGES[scene.imageKey]} />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

          </View>
        </View>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 22 }]}>
          <Check color="#fff" size={15} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontKey={fontKey}
        setFontKey={setFontKey}
        pageTheme={pageTheme}
        setPageTheme={setPageTheme}
        markerMode={markerMode}
        setMarkerMode={setMarkerMode}
        markColor={markColor}
        setMarkColor={setMarkColor}
        marksCount={Object.keys(marks).length}
        onClearMarks={clearMarks}
      />

      <TocSheet
        visible={tocOpen}
        scenes={screenplay.scenes}
        activeSceneId={activeSceneId}
        onClose={() => setTocOpen(false)}
        onJump={jumpToScene}
      />

      <SearchSheet
        visible={searchOpen}
        query={searchQuery}
        setQuery={setSearchQuery}
        results={searchResults}
        onClose={() => setSearchOpen(false)}
        onJump={(result) => jumpToScene(result.sceneId, result.lineId)}
      />
    </Screen>
  );
}

function ScreenplayOverview({
  screenplay,
  authorName,
  authorPhoto,
  authorBio,
  publisherName,
  publisherLogo,
  publisherAbout,
  heroImage,
  saved,
  toast,
  insetsTop,
  insetsBottom,
  onBack,
  onStart,
  onSave,
  onShare,
  onAudio,
}: {
  screenplay: Screenplay;
  authorName: string;
  authorPhoto?: string;
  authorBio: string;
  publisherName: string;
  publisherLogo?: string;
  publisherAbout: string;
  heroImage: number;
  saved: boolean;
  toast: string | null;
  insetsTop: number;
  insetsBottom: number;
  onBack: () => void;
  onStart: () => void;
  onSave: () => void;
  onShare: () => void;
  onAudio: () => void;
}) {
  return (
    <Screen style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.overviewContent,
          { paddingTop: insetsTop + 12, paddingBottom: insetsBottom + 42 },
        ]}
      >
        <View style={styles.posterSection}>
          <Pressable onPress={onBack} style={styles.overviewBackButton}>
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
          <View style={styles.posterCard}>
            <Image source={heroImage} style={styles.posterImage} contentFit="cover" />
            <LinearGradient
              colors={["rgba(0,0,0,0.02)", "rgba(7,18,8,0.78)"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.posterBadge}>
              <Film color="#fff" size={13} />
              <Text style={styles.posterBadgeText}>SSENARIY</Text>
            </View>
            <View style={styles.posterCopy}>
              <Text style={styles.posterTitle} numberOfLines={2}>{screenplay.title}</Text>
              <Text style={styles.posterSubtitle} numberOfLines={1}>{authorName} · {screenplay.genre}</Text>
            </View>
          </View>
        </View>

        <View style={styles.overviewMetaGrid}>
          <OverviewMetaBlock icon={<Star color={palette.primary} fill={palette.primary} size={16} />} label="Reyting" value={screenplay.rating.toFixed(1)} />
          <OverviewMetaBlock icon={<Clock color={palette.primary} size={16} />} label="Mo'ljallangan vaqti" value={screenplay.duration} />
          <OverviewMetaBlock icon={<Users color={palette.primary} size={16} />} label="O'qilishlar soni" value={formatCount(screenplay.readers)} />
          <OverviewMetaBlock icon={<Bookmark color={palette.primary} size={16} />} label="Saqlashlar soni" value={formatCount(screenplay.saved)} />
          <OverviewMetaBlock icon={<Shield color={palette.primary} size={16} />} label="Yosh chegarasi" value={screenplay.ageLimit} />
          <OverviewMetaBlock icon={<Building2 color={palette.primary} size={16} />} label="Nashriyoti" value={publisherName} />
        </View>

        <PressableScale onPress={onStart} style={styles.overviewPrimaryCta}>
          <BookOpen color="#fff" size={19} />
          <Text style={styles.overviewPrimaryCtaText}>Ssenariyni o'qishni boshlash</Text>
        </PressableScale>

        <View style={styles.secondaryActionRow}>
          <OverviewSecondaryAction
            icon={<Bookmark color={saved ? "#fff" : palette.primary} fill={saved ? "#fff" : "transparent"} size={16} />}
            label={saved ? "Saqlangan" : "Saqlash"}
            active={saved}
            onPress={onSave}
          />
          <OverviewSecondaryAction icon={<Share2 color={palette.primary} size={16} />} label="Ulashish" onPress={onShare} />
          <OverviewSecondaryAction icon={<Headphones color={palette.primary} size={16} />} label="Audio rejim" onPress={onAudio} />
        </View>

        <View style={styles.overviewFeatureStack}>
          <OverviewFeatureCard
            icon={<Film color={palette.primary} size={24} />}
            title="Sahnalar"
            subtitle={`${screenplay.scenes.length} ta sahna`}
            preview={screenplay.scenes.slice(0, 2).map((scene) => `${scene.number}-sahna: ${scene.title}`).join(" · ")}
            onPress={onStart}
          />
          <OverviewFeatureCard
            icon={<Users color={palette.primary} size={24} />}
            title="Qahramonlar"
            subtitle={getCharacterPreview(screenplay).map((item) => item.name).join(" · ")}
            preview={getCharacterPreview(screenplay).map((item) => `${item.name} - ${item.role}`).join("\n")}
          />
          <OverviewFeatureCard
            icon={<Music2 color={palette.primary} size={24} />}
            title="Ishlatiladigan musiqalar"
            subtitle={getMusicPreview(screenplay).map((item) => item.title).join(" · ")}
            preview={getMusicPreview(screenplay).map((item) => `${item.mood} · ${item.duration}`).join("\n")}
            onPress={onAudio}
          />
        </View>

        <OverviewSectionTitle title="Lavhalar" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lavhaRow}>
          {screenplay.scenes.map((scene) => (
            <View key={scene.id} style={styles.lavhaCard}>
              <Image source={SCENE_IMAGES[scene.imageKey]} style={styles.lavhaImage} contentFit="cover" />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.68)"]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.lavhaCopy}>
                <Text style={styles.lavhaNumber}>{scene.number}-SAHNA</Text>
                <Text style={styles.lavhaTitle} numberOfLines={1}>{scene.title}</Text>
                <Text style={styles.lavhaMeta} numberOfLines={1}>{scene.identifier}. {scene.location}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <OverviewSectionTitle title="Muallif haqida" />
        <InfoProfile
          image={authorPhoto}
          fallbackIcon={<Users color={palette.primary} size={22} />}
          title={authorName}
          text={authorBio}
          accent="Ijodiy ohang: dramatik, sokin va kino tiliga yaqin."
        />

        <OverviewSectionTitle title="Nashriyot haqida" />
        <InfoProfile
          image={publisherLogo}
          fallbackIcon={<Building2 color={palette.primary} size={22} />}
          title={publisherName}
          text={publisherAbout}
          accent="Ssenariy, audio va ekran asarlarini bir joyga jamlaydi."
        />

        <OverviewSectionTitle title="O'quvchilar fikri" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewRow}>
          {screenplay.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{review.name.charAt(0)}</Text>
                </View>
                <View style={styles.reviewNameWrap}>
                  <Text style={styles.reviewName} numberOfLines={1}>{review.name}</Text>
                  <Text style={styles.reviewRole} numberOfLines={1}>{review.role}</Text>
                </View>
                <View style={styles.reviewRating}>
                  <Star color={palette.primary} fill={palette.primary} size={12} />
                  <Text style={styles.reviewRatingText}>{review.rating}</Text>
                </View>
              </View>
              <Text style={styles.reviewText} numberOfLines={4}>{review.text}</Text>
            </View>
          ))}
        </ScrollView>

        <OverviewSectionTitle title="Shu nashriyotdagi boshqa ssenariylar" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScreenplayRow}>
          {RELATED_SCREENPLAY_CARDS.map((item) => (
            <View key={item.id} style={styles.relatedScreenplayCard}>
              <Image source={SCENE_IMAGES[item.imageKey]} style={styles.relatedScreenplayImage} contentFit="cover" />
              <View style={styles.relatedScreenplayBody}>
                <Text style={styles.relatedScreenplayTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.relatedScreenplaySubtitle} numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insetsBottom + 22 }]}>
          <Check color="#fff" size={15} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function OverviewMetaBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.overviewMetaBlock}>
      <View style={styles.overviewMetaIcon}>{icon}</View>
      <View style={styles.overviewMetaCopy}>
        <Text style={styles.overviewMetaValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.overviewMetaLabel} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function OverviewSecondaryAction({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.overviewSecondaryAction, active ? styles.overviewSecondaryActionActive : {}]}>
      {icon}
      <Text style={[styles.overviewSecondaryText, active && styles.overviewSecondaryTextActive]}>{label}</Text>
    </PressableScale>
  );
}

function OverviewFeatureCard({
  icon,
  title,
  subtitle,
  preview,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  preview: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.overviewFeatureCard}>
      <View style={styles.overviewFeatureIcon}>{icon}</View>
      <View style={styles.overviewFeatureCopy}>
        <Text style={styles.overviewFeatureTitle}>{title}</Text>
        <Text style={styles.overviewFeatureSubtitle} numberOfLines={2}>{subtitle}</Text>
        <Text style={styles.overviewFeaturePreview} numberOfLines={3}>{preview}</Text>
      </View>
      {onPress ? <ChevronRight color={palette.primary} size={18} /> : null}
    </View>
  );

  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}

function OverviewSectionTitle({ title }: { title: string }) {
  return <Text style={styles.overviewSectionTitle}>{title}</Text>;
}

function InfoProfile({
  image,
  fallbackIcon,
  title,
  text,
  accent,
}: {
  image?: string;
  fallbackIcon: React.ReactNode;
  title: string;
  text: string;
  accent: string;
}) {
  return (
    <View style={styles.infoProfile}>
      {image ? (
        <Image source={{ uri: image }} style={styles.infoImage} contentFit="cover" />
      ) : (
        <View style={styles.infoImageFallback}>{fallbackIcon}</View>
      )}
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.infoText} numberOfLines={3}>{text}</Text>
        <Text style={styles.infoAccent} numberOfLines={2}>{accent}</Text>
      </View>
    </View>
  );
}

function SceneBlock({
  scene,
  active,
  page,
  fontFamily,
  fontSize,
  lineHeight,
  markerMode,
  marks,
  searchQuery,
  activeSearchLineId,
  onPressLine,
  onLayout,
}: {
  scene: ScreenplayScene;
  active: boolean;
  page: (typeof PAGE_THEMES)[PageThemeKey];
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  markerMode: boolean;
  marks: Record<string, MarkState>;
  searchQuery: string;
  activeSearchLineId: string | null;
  onPressLine: (line: ScreenplayLine) => void;
  onLayout: (y: number) => void;
}) {
  return (
    <View
      style={styles.sceneBlock}
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
    >
      <View style={styles.sceneHeading}>
        <View style={[styles.sceneNumberBadge, active && styles.sceneNumberBadgeActive]}>
          <Text style={[styles.sceneNumberText, active && styles.sceneNumberTextActive]}>
            {scene.number}-SAHNA
          </Text>
        </View>
        <View style={styles.sceneHeadingTextWrap}>
          <Text style={[styles.sceneSlug, { color: page.text }]} numberOfLines={2}>
            {scene.identifier}. {scene.location} - {scene.time}
          </Text>
          <Text style={[styles.sceneSubtitle, { color: page.sub }]}>{scene.title}</Text>
        </View>
      </View>

      <View style={styles.scriptLines}>
        {scene.lines.map((line) => {
          const mark = marks[line.id];
          const activeSearch = activeSearchLineId === line.id;
          return (
            <Pressable
              key={line.id}
              onPress={() => onPressLine(line)}
              style={[
                styles.linePress,
                styles[`${line.type}Line`],
                markerMode && styles.markerLineReady,
                mark ? { backgroundColor: MARK_BG[mark.color] } : null,
                activeSearch ? styles.activeSearchLine : null,
              ]}
            >
              <Text
                style={[
                  styles.scriptLine,
                  styles[`${line.type}Text`],
                  {
                    color: line.type === "character" ? palette.primary : page.text,
                    fontFamily: line.type === "transition" ? FONT.mono : fontFamily,
                    fontSize: line.type === "character" ? fontSize * 0.86 : fontSize,
                    lineHeight: fontSize * lineHeight,
                  },
                ]}
              >
                {renderSearchSegments(line.text, searchQuery).map((segment, index) => (
                  <Text key={`${line.id}-${index}`} style={segment.hit ? styles.searchHitText : undefined}>
                    {segment.text}
                  </Text>
                ))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MusicBlock({
  track,
  playing,
  onPress,
}: {
  track: ScreenplayMusicTrack;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.musicBlock}>
      <Pressable onPress={onPress} style={[styles.musicPlayButton, playing && styles.musicPlayButtonActive]}>
        {playing ? (
          <Pause color="#fff" fill="#fff" size={15} />
        ) : (
          <Play color={palette.primary} fill={palette.primary} size={15} />
        )}
      </Pressable>
      <View style={styles.musicTextWrap}>
        <Text style={styles.musicTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.musicSubtitle} numberOfLines={1}>{track.mood}</Text>
      </View>
      <Text style={styles.musicDuration}>{track.duration}</Text>
    </View>
  );
}

function SceneImageBreak({ image }: { image: number }) {
  return (
    <View style={styles.imageBreak}>
      <Image source={image} style={styles.sceneImage} contentFit="cover" />
    </View>
  );
}

function SettingsSheet({
  visible,
  onClose,
  fontSize,
  setFontSize,
  fontKey,
  setFontKey,
  pageTheme,
  setPageTheme,
  markerMode,
  setMarkerMode,
  markColor,
  setMarkColor,
  marksCount,
  onClearMarks,
}: {
  visible: boolean;
  onClose: () => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  fontKey: FontKey;
  setFontKey: (value: FontKey) => void;
  pageTheme: PageThemeKey;
  setPageTheme: (value: PageThemeKey) => void;
  markerMode: boolean;
  setMarkerMode: (value: boolean) => void;
  markColor: MarkColor;
  setMarkColor: (value: MarkColor) => void;
  marksCount: number;
  onClearMarks: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>O'qish sozlamalari</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Yopish">
            <X color={palette.text} size={18} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <SettingBlock icon={<Type color={palette.primary} size={17} />} title="Matn kattaligi">
            <View style={styles.zoomRow}>
              <Pressable
                onPress={() => setFontSize(Math.max(13, fontSize - 1))}
                style={styles.iconSettingButton}
                accessibilityRole="button"
                accessibilityLabel="Matnni kichraytirish"
              >
                <Minus color={palette.primary} size={17} />
              </Pressable>
              <Text style={styles.settingValue}>{fontSize}px</Text>
              <Pressable
                onPress={() => setFontSize(Math.min(23, fontSize + 1))}
                style={styles.iconSettingButton}
                accessibilityRole="button"
                accessibilityLabel="Matnni kattalashtirish"
              >
                <Plus color={palette.primary} size={17} />
              </Pressable>
            </View>
          </SettingBlock>

          <SettingBlock icon={<Type color={palette.primary} size={17} />} title="Shrift tanlash">
            <View style={styles.segmentRow}>
              <SegmentButton label="Ssenariy" active={fontKey === "screenplay"} onPress={() => setFontKey("screenplay")} />
              <SegmentButton label="Serif" active={fontKey === "serif"} onPress={() => setFontKey("serif")} />
              <SegmentButton label="Klassik" active={fontKey === "classic"} onPress={() => setFontKey("classic")} />
            </View>
          </SettingBlock>

          <SettingBlock icon={<Palette color={palette.primary} size={17} />} title="Sahifa rangi">
            <View style={styles.swatchRow}>
              {(Object.keys(PAGE_THEMES) as PageThemeKey[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setPageTheme(key)}
                  style={[styles.swatchButton, pageTheme === key && styles.swatchButtonActive]}
                >
                  <View style={[styles.swatch, { backgroundColor: PAGE_THEMES[key].bg }]} />
                  <Text style={styles.swatchText}>{PAGE_THEMES[key].label}</Text>
                </Pressable>
              ))}
            </View>
          </SettingBlock>

          <SettingBlock icon={<Highlighter color={palette.primary} size={17} />} title="Marker">
            <Pressable
              onPress={() => setMarkerMode(!markerMode)}
              style={[styles.markerToggle, markerMode && styles.markerToggleActive]}
            >
              <Highlighter color={markerMode ? "#fff" : palette.primary} size={16} />
              <Text style={[styles.markerToggleText, markerMode && styles.markerToggleTextActive]}>
                {markerMode ? "Marker yoqilgan" : "Marker yoqish"}
              </Text>
            </Pressable>
            <View style={styles.markColorRow}>
              {(Object.keys(MARK_BG) as MarkColor[]).map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setMarkColor(color)}
                  style={[styles.markColorButton, markColor === color && styles.markColorButtonActive]}
                >
                  <View style={[styles.markColorDot, { backgroundColor: MARK_BG[color] }]} />
                  <Text style={styles.markColorText}>{MARK_LABELS[color]}</Text>
                </Pressable>
              ))}
            </View>
            {marksCount > 0 ? (
              <Pressable onPress={onClearMarks} style={styles.clearMarksButton}>
                <Text style={styles.clearMarksText}>Belgilarni tozalash</Text>
              </Pressable>
            ) : null}
          </SettingBlock>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SettingBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingBlock}>
      <View style={styles.settingBlockHeader}>
        {icon}
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TocSheet({
  visible,
  scenes,
  activeSceneId,
  onClose,
  onJump,
}: {
  visible: boolean;
  scenes: ScreenplayScene[];
  activeSceneId: string | null;
  onClose: () => void;
  onJump: (sceneId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Mundarija</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Yopish">
            <X color={palette.text} size={18} />
          </Pressable>
        </View>
        <View style={styles.tocList}>
          {scenes.map((scene) => {
            const active = activeSceneId === scene.id;
            return (
              <Pressable
                key={scene.id}
                onPress={() => onJump(scene.id)}
                style={[styles.tocRow, active && styles.tocRowActive]}
              >
                <Text style={[styles.tocSceneNumber, active && styles.tocSceneNumberActive]}>
                  {scene.number}-SAHNA
                </Text>
                <View style={styles.tocCopy}>
                  <Text style={[styles.tocTitle, active && styles.tocTitleActive]} numberOfLines={1}>
                    {scene.title}
                  </Text>
                  <Text style={styles.tocMeta} numberOfLines={1}>
                    {scene.identifier}. {scene.location} - {scene.time}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function SearchSheet({
  visible,
  query,
  setQuery,
  results,
  onClose,
  onJump,
}: {
  visible: boolean;
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  onClose: () => void;
  onJump: (result: SearchResult) => void;
}) {
  const hasQuery = query.trim().length >= 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Qidirish</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Yopish">
            <X color={palette.text} size={18} />
          </Pressable>
        </View>
        <View style={styles.searchInputWrap}>
          <Search color={palette.textMuted} size={17} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="So'z yoki ibora"
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <X color={palette.textMuted} size={16} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.searchResults}>
          {hasQuery && results.length > 0 ? (
            results.map((result) => (
              <Pressable
                key={`${result.lineId}-${result.sceneId}`}
                onPress={() => onJump(result)}
                style={styles.searchResultRow}
              >
                <Text style={styles.searchResultScene}>
                  {result.sceneNumber}-SAHNA · {result.sceneTitle}
                </Text>
                <Text style={styles.searchResultSnippet} numberOfLines={2}>{result.snippet}</Text>
              </Pressable>
            ))
          ) : hasQuery ? (
            <Text style={styles.emptySearch}>Natija topilmadi</Text>
          ) : (
            <Text style={styles.emptySearch}>Kamida 2 ta belgi kiriting</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function getMusicForScene(screenplay: Screenplay, sceneNumber: number): ScreenplayMusicTrack | null {
  if (sceneNumber === 1) return screenplay.recommendedMusic[0] ?? null;
  if (sceneNumber === 3) return screenplay.recommendedMusic[2] ?? screenplay.backgroundMusic[1] ?? null;
  return null;
}

function shouldShowSceneImage(scene: ScreenplayScene): boolean {
  return scene.number === 2 || scene.number === 4;
}

function buildSnippet(text: string, query: string): string {
  const q = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(q);
  if (index < 0) return text.slice(0, 126);
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + q.length + 68);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function renderSearchSegments(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (q.length < 2) return [{ text, hit: false }];

  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const segments: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  let index = lower.indexOf(needle);

  while (index >= 0) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), hit: false });
    segments.push({ text: text.slice(index, index + q.length), hit: true });
    cursor = index + q.length;
    index = lower.indexOf(needle, cursor);
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

function getMarksStorageKey(screenplayId: string): string {
  return `adabiyot.screenplay.reader.marks.${screenplayId}.v2`;
}

function getCharacterPreview(screenplay: Screenplay): { name: string; role: string }[] {
  const names = screenplay.scenes.flatMap((scene) =>
    scene.lines.filter((line) => line.type === "character").map((line) => line.text)
  );
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames.slice(0, 3).map((name) => ({
    name,
    role: CHARACTER_ROLES[name] ?? "Ssenariydagi asosiy qahramon",
  }));
}

function getMusicPreview(screenplay: Screenplay): ScreenplayMusicTrack[] {
  return [...screenplay.recommendedMusic, ...screenplay.backgroundMusic].slice(0, 3);
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function slugifyFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ssenariy";
}

function buildScreenplayPdf(screenplay: Screenplay, authorName: string): string {
  const lines: { text: string; font: "body" | "mono"; size: number }[] = [
    { text: screenplay.title, font: "body", size: 18 },
    { text: `${authorName} | ${screenplay.genre} | ${screenplay.readTime}`, font: "body", size: 11 },
    { text: "", font: "body", size: 11 },
  ];

  screenplay.scenes.forEach((scene) => {
    lines.push({ text: `${scene.number}-SAHNA`, font: "body", size: 13 });
    lines.push({ text: `${scene.identifier}. ${scene.location} - ${scene.time}`, font: "mono", size: 11 });
    scene.lines.forEach((line) => {
      const prefix = line.type === "character" ? "      " : line.type === "dialogue" ? "   " : "";
      splitPdfText(`${prefix}${line.text}`, 76).forEach((part) => {
        lines.push({ text: part, font: line.type === "transition" ? "mono" : "body", size: 10 });
      });
      if (line.type === "action" || line.type === "transition") {
        lines.push({ text: "", font: "body", size: 10 });
      }
    });
    lines.push({ text: "", font: "body", size: 10 });
  });

  const pageLines: typeof lines[] = [];
  const pageSize = 42;
  for (let index = 0; index < lines.length; index += pageSize) {
    pageLines.push(lines.slice(index, index + pageSize));
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const streamObjectIds: number[] = [];
  const fontBodyId = 3;
  const fontMonoId = 4;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  pageLines.forEach((page, index) => {
    const pageObjId = 5 + index * 2;
    const streamObjId = pageObjId + 1;
    pageObjectIds.push(pageObjId);
    streamObjectIds.push(streamObjId);

    const content = buildPdfPageStream(page);
    objects[pageObjId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontBodyId} 0 R /F2 ${fontMonoId} 0 R >> >> /Contents ${streamObjId} 0 R >>`;
    objects[streamObjId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
}

function buildPdfPageStream(pageLines: { text: string; font: "body" | "mono"; size: number }[]): string {
  return pageLines
    .map((line, index) => {
      const y = 742 - index * 16;
      const font = line.font === "mono" ? "F2" : "F1";
      return `BT /${font} ${line.size} Tf 72 ${y} Td (${escapePdfText(line.text)}) Tj ET`;
    })
    .join("\n");
}

function splitPdfText(value: string, maxLength: number): string[] {
  const normalized = normalizePdfText(value);
  const result: string[] = [];
  let current = "";

  normalized.split(" ").forEach((word) => {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) result.push(current);
      current = word;
      return;
    }
    current = `${current} ${word}`.trim();
  });

  if (current || normalized.length === 0) result.push(current);
  return result;
}

function normalizePdfText(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value: string): string {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function downloadPdfOnWeb(pdf: string, fileName: string) {
  const browser = globalThis as unknown as {
    Blob?: new (parts: string[], options?: { type?: string }) => unknown;
    URL?: { createObjectURL?: (blob: unknown) => string; revokeObjectURL?: (url: string) => void };
    document?: {
      createElement?: (tag: string) => { href?: string; download?: string; click?: () => void; remove?: () => void };
      body?: { appendChild?: (node: unknown) => void };
    };
    setTimeout?: (callback: () => void, ms: number) => void;
  };

  if (!browser.Blob || !browser.URL?.createObjectURL || !browser.document?.createElement) return;
  const blob = new browser.Blob([pdf], { type: "application/pdf" });
  const url = browser.URL.createObjectURL(blob);
  const link = browser.document.createElement("a");
  link.href = url;
  link.download = fileName;
  browser.document.body?.appendChild?.(link);
  link.click?.();
  link.remove?.();
  browser.setTimeout?.(() => browser.URL?.revokeObjectURL?.(url), 800);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.bg,
  },
  overviewContent: {
    paddingBottom: 42,
  },
  posterSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    position: "relative",
  },
  overviewBackButton: {
    position: "absolute",
    left: 18,
    top: 0,
    zIndex: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  posterCard: {
    width: Math.min(292, SCREEN_W * 0.72),
    aspectRatio: 0.68,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterBadge: {
    position: "absolute",
    top: 15,
    left: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    backgroundColor: "rgba(46,125,50,0.86)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  posterBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  posterCopy: {
    position: "absolute",
    left: 17,
    right: 17,
    bottom: 17,
  },
  posterTitle: {
    color: "#fff",
    fontFamily: FONT.serif,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: 0,
  },
  posterSubtitle: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 7,
  },
  overviewMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  overviewMetaBlock: {
    width: (SCREEN_W - 50) / 2,
    minHeight: 66,
    borderRadius: 16,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  overviewMetaIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewMetaCopy: {
    flex: 1,
    minWidth: 0,
  },
  overviewMetaValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "900",
  },
  overviewMetaLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
  overviewPrimaryCta: {
    minHeight: 58,
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
  },
  overviewPrimaryCtaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 20,
    marginTop: 11,
  },
  overviewSecondaryAction: {
    flex: 1,
    minHeight: 47,
    borderRadius: 15,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  overviewSecondaryActionActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  overviewSecondaryText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  overviewSecondaryTextActive: {
    color: "#fff",
  },
  overviewFeatureStack: {
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  overviewFeatureCard: {
    minHeight: 116,
    borderRadius: 20,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  overviewFeatureIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewFeatureCopy: {
    flex: 1,
    minWidth: 0,
  },
  overviewFeatureTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  overviewFeatureSubtitle: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 5,
  },
  overviewFeaturePreview: {
    color: palette.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 7,
  },
  overviewSectionTitle: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 12,
    letterSpacing: 0,
  },
  lavhaRow: {
    paddingHorizontal: 20,
    gap: 13,
  },
  lavhaCard: {
    width: Math.min(254, SCREEN_W * 0.66),
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.11,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lavhaImage: {
    width: "100%",
    height: "100%",
  },
  lavhaCopy: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
  },
  lavhaNumber: {
    color: "#DFF5E2",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
  lavhaTitle: {
    color: "#fff",
    fontFamily: FONT.serif,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 5,
    letterSpacing: 0,
  },
  lavhaMeta: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  infoProfile: {
    marginHorizontal: 20,
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  infoImage: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: palette.bgElevated,
  },
  infoImageFallback: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  infoTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
  },
  infoText: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  infoAccent: {
    color: palette.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 7,
  },
  reviewRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  reviewCard: {
    width: Math.min(318, SCREEN_W * 0.78),
    minHeight: 154,
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    color: palette.primary,
    fontSize: 17,
    fontWeight: "900",
  },
  reviewNameWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  reviewName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  reviewRole: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewRatingText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  reviewText: {
    color: palette.textDim,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  relatedScreenplayRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  relatedScreenplayCard: {
    width: Math.min(198, SCREEN_W * 0.52),
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  relatedScreenplayImage: {
    width: "100%",
    aspectRatio: 0.82,
    backgroundColor: palette.bgElevated,
  },
  relatedScreenplayBody: {
    padding: 12,
  },
  relatedScreenplayTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  relatedScreenplaySubtitle: {
    color: palette.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  readerTopBar: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  readerPrimaryActions: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  readerToolActions: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  topToolbar: {
    position: "absolute",
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  toolbarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  scrollContent: {
    minHeight: "100%",
  },
  paperWrap: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  paper: {
    width: "100%",
    maxWidth: PAPER_MAX_WIDTH,
    minHeight: 900,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: IS_WIDE ? 54 : 36,
    paddingBottom: IS_WIDE ? 70 : 46,
    shadowColor: "#3A3128",
    shadowOpacity: 0.08,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
    overflow: "hidden",
  },
  readerHeader: {
    paddingBottom: 34,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(46,125,50,0.16)",
  },
  readerTitle: {
    fontFamily: FONT.serif,
    fontSize: IS_WIDE ? 36 : 30,
    lineHeight: IS_WIDE ? 43 : 36,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0,
  },
  readerMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  readerMetaText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  readerMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(46,125,50,0.34)",
  },
  sceneList: {
    paddingTop: 34,
  },
  sceneBlock: {
    paddingBottom: 34,
  },
  sceneHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
  },
  sceneNumberBadge: {
    minWidth: 82,
    minHeight: 31,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sceneNumberBadgeActive: {
    backgroundColor: "rgba(46,125,50,0.14)",
    borderColor: "rgba(46,125,50,0.32)",
  },
  sceneNumberText: {
    color: palette.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  sceneNumberTextActive: {
    color: palette.primaryDim,
  },
  sceneHeadingTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  sceneSlug: {
    fontFamily: FONT.mono,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    letterSpacing: 0,
  },
  sceneSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.serif,
    fontStyle: "italic",
  },
  scriptLines: {
    gap: 2,
  },
  linePress: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginBottom: 5,
  },
  markerLineReady: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.10)",
  },
  activeSearchLine: {
    backgroundColor: "rgba(46,125,50,0.12)",
  },
  actionLine: {
    marginBottom: 14,
  },
  characterLine: {
    alignSelf: "center",
    minWidth: 120,
    marginTop: 8,
    marginBottom: 1,
  },
  dialogueLine: {
    marginHorizontal: IS_WIDE ? 118 : 28,
    marginBottom: 9,
  },
  parentheticalLine: {
    marginHorizontal: IS_WIDE ? 148 : 48,
    marginTop: -5,
    marginBottom: 4,
  },
  transitionLine: {
    alignSelf: "flex-end",
    marginTop: 8,
    marginBottom: 18,
  },
  scriptLine: {
    fontWeight: "500",
    letterSpacing: 0,
  },
  actionText: {
    fontWeight: "500",
  },
  characterText: {
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: 0,
  },
  dialogueText: {
    fontWeight: "500",
  },
  parentheticalText: {
    fontStyle: "italic",
    opacity: 0.82,
  },
  transitionText: {
    textAlign: "right",
    fontWeight: "800",
    letterSpacing: 0,
  },
  searchHitText: {
    backgroundColor: "rgba(255,213,79,0.46)",
    color: "#181713",
  },
  musicBlock: {
    minHeight: 58,
    marginTop: -8,
    marginBottom: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(46,125,50,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  musicPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.22)",
  },
  musicPlayButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  musicTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  musicTitle: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  musicSubtitle: {
    color: palette.textDim,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    fontWeight: "500",
  },
  musicDuration: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  imageBreak: {
    marginTop: -6,
    marginBottom: 40,
  },
  sceneImage: {
    width: "100%",
    aspectRatio: 1.62,
    borderRadius: 8,
    backgroundColor: palette.bgElevated,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "rgba(46,125,50,0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    zIndex: 50,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: Platform.OS === "web" ? 700 : "86%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#FBF7EF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.08)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(28,26,23,0.14)",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContent: {
    paddingBottom: 12,
    gap: 16,
  },
  settingBlock: {
    paddingVertical: 2,
  },
  settingBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
  },
  settingTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
  },
  zoomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconSettingButton: {
    width: 42,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingValue: {
    minWidth: 56,
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.09)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  segmentButtonText: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  segmentButtonTextActive: {
    color: "#FFFFFF",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 8,
  },
  swatchButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.09)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swatchButtonActive: {
    borderColor: palette.primary,
    backgroundColor: "rgba(46,125,50,0.06)",
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.18)",
  },
  swatchText: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: "700",
  },
  markerToggle: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  markerToggleActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  markerToggleText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  markerToggleTextActive: {
    color: "#FFFFFF",
  },
  markColorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  markColorButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.09)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  markColorButtonActive: {
    borderColor: palette.primary,
    backgroundColor: "rgba(46,125,50,0.06)",
  },
  markColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.14)",
  },
  markColorText: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: "800",
  },
  clearMarksButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.18)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  clearMarksText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  tocList: {
    gap: 7,
    paddingBottom: 10,
  },
  tocRow: {
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  tocRowActive: {
    backgroundColor: "rgba(46,125,50,0.08)",
    borderColor: "rgba(46,125,50,0.24)",
  },
  tocSceneNumber: {
    width: 72,
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  tocSceneNumberActive: {
    color: palette.primaryDim,
  },
  tocCopy: {
    flex: 1,
    minWidth: 0,
  },
  tocTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
  },
  tocTitleActive: {
    color: palette.primaryDim,
  },
  tocMeta: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  searchInputWrap: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,26,23,0.09)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    minHeight: 42,
  },
  searchResults: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchResultRow: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(46,125,50,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchResultScene: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  searchResultSnippet: {
    color: palette.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  emptySearch: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  notFoundTitle: {
    color: palette.text,
    fontFamily: FONT.serif,
    fontSize: 24,
    fontWeight: "700",
  },
  notFoundButton: {
    marginTop: 18,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
