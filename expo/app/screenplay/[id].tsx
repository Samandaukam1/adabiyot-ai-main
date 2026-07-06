import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Eye,
  Film,
  List,
  Lock,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Share2,
  Shield,
  ShoppingBag,
  Type,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RatingReviewBlock from "@/components/RatingReviewBlock";
import { FONT, PressableScale, Screen } from "@/components/ui";
import BuyConfirmSheet from "@/components/payments/BuyConfirmSheet";
import CardPaymentSheet from "@/components/payments/CardPaymentSheet";
import PromoPriceBlock from "@/components/payments/PromoPriceBlock";
import { formatUzs } from "@/constants/tariffs";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import {
  createOrderInputFromPaymentProduct,
  logCreateOrderDebug,
  showMissingPaymentProductAlert,
  useContentAccess,
  usePaymentProduct,
  usePurchaseFlow,
} from "@/hooks/usePayments";
import { usePromo } from "@/hooks/usePromo";
import { useScreenplay } from "@/hooks/useScreenplays";
import { usePlannedRead } from "@/hooks/useShelf";
import { recordScreenplayRead } from "@/lib/screenplays";
import type {
  DisplayScreenplay,
  ScreenplayCharacter,
  ScreenplayContentBlock,
  ScreenplayLineBlock,
  ScreenplaySceneBlock,
} from "@/lib/screenplays";
import { recordReading } from "@/lib/shelfStore";
import { shareContent } from "@/lib/share";
import { useAuth } from "@/providers/AuthProvider";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const IS_WIDE = SCREEN_W >= 720;
const PAPER_MAX = 720;
const PRIMARY = "#2F9E6E";

// Cream/soft-white reading surfaces — modelled on the article reader, kept calm
// and legible. White is the default.
const PAGE_THEMES = {
  oq: { label: "Oq", bg: "#FFFFFF", text: "#15171C", sub: "#69707B", border: "rgba(0,0,0,0.07)", soft: "#F5F6F8" },
  krem: { label: "Krem", bg: "#FBF8F2", text: "#1A1813", sub: "#6F695E", border: "rgba(0,0,0,0.07)", soft: "#F4F0E8" },
  yashil: { label: "Yashil", bg: "#F5FAF6", text: "#13201A", sub: "#5E6F66", border: "rgba(0,0,0,0.07)", soft: "#ECF5EF" },
  tungi: { label: "Tungi", bg: "#15181C", text: "#ECEFF3", sub: "#9BA4AF", border: "rgba(255,255,255,0.10)", soft: "#22272D" },
} as const;

type PageThemeKey = keyof typeof PAGE_THEMES;
type PageTheme = (typeof PAGE_THEMES)[PageThemeKey];
type ReaderFontKey = "serif" | "classic" | "sans";

const READER_FONTS: Record<ReaderFontKey, string> = {
  serif: FONT.serif,
  classic: FONT.classic,
  sans: FONT.sans,
};
const FONT_OPTIONS: { key: ReaderFontKey; label: string }[] = [
  { key: "serif", label: "Serif" },
  { key: "classic", label: "Klassik" },
  { key: "sans", label: "Sans" },
];

export default function ScreenplayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { screenplay, loading, error } = useScreenplay(typeof id === "string" ? id : undefined);
  const { isAuthenticated, userId } = useAuth();

  const access = useContentAccess("scenario", screenplay?.id);
  const purchaseFlow = usePurchaseFlow();
  const paymentProductQuery = usePaymentProduct("scenario", screenplay?.id);
  const paymentProduct = paymentProductQuery.data ?? null;
  const promo = usePromo({
    contentType: paymentProduct?.content_type ?? "scenario",
    contentId: paymentProduct?.content_id ?? screenplay?.id,
    productId: paymentProduct?.id,
  });

  const [readingStarted, setReadingStarted] = useState(false);
  const [initialAnchorId, setInitialAnchorId] = useState<string | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [pageThemeKey, setPageThemeKey] = useState<PageThemeKey>("oq");
  const [fontKey, setFontKey] = useState<ReaderFontKey>("serif");
  const [fontSize, setFontSize] = useState(18);

  // Background music (fon musiqasi) — NOT an audiobook. One track at a time,
  // never autoplays, and unloads when the screen unmounts (readerdan chiqsa to'xtaydi).
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const tracks = screenplay?.music ?? [];
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? tracks[0] ?? null;
  const music = useAudioPlayer(activeTrackId ? activeTrack?.audioUrl ?? null : null);

  const theme = PAGE_THEMES[pageThemeKey];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const price = screenplay?.requiresPurchase ? paymentProduct?.amount_uzs ?? screenplay.price : 0;
  const purchased = !screenplay?.requiresPurchase || access.hasAccess;

  const toggleTrack = useCallback(
    (trackId: string) => {
      if (activeTrackId === trackId) {
        void music.togglePlay();
      } else {
        setActiveTrackId(trackId);
      }
    },
    [activeTrackId, music]
  );

  const handleBuy = () => {
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

  const startReading = (anchorId: string | null = null) => {
    if (!screenplay) return;
    if (!purchased) {
      handleBuy();
      return;
    }
    setInitialAnchorId(anchorId);
    recordReading({
      contentType: "scenario",
      contentId: screenplay.id,
      title: screenplay.title,
      cover: screenplay.coverUrl,
      author: screenplay.author,
      progress: 0,
    });
    setReadingStarted(true);
  };

  if (loading && !screenplay) {
    return (
      <Screen style={{ backgroundColor: theme.bg }}>
        <View style={[styles.centerState, { paddingTop: insets.top + 60 }]}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={[styles.stateText, { color: theme.sub }]}>Ssenariy yuklanmoqda…</Text>
        </View>
      </Screen>
    );
  }

  if (!screenplay) {
    return (
      <Screen style={{ backgroundColor: theme.bg }}>
        <View style={[styles.centerState, { paddingTop: insets.top + 48 }]}>
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>{error || "Ssenariy topilmadi"}</Text>
          <PressableScale onPress={() => router.back()} style={styles.notFoundButton}>
            <Text style={styles.notFoundButtonText}>Orqaga</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  return (
    <>
      {readingStarted ? (
        <ScreenplayReader
          screenplay={screenplay}
          theme={theme}
          pageThemeKey={pageThemeKey}
          setPageThemeKey={setPageThemeKey}
          fontKey={fontKey}
          setFontKey={setFontKey}
          fontSize={fontSize}
          setFontSize={setFontSize}
          styles={styles}
          insetsTop={insets.top}
          insetsBottom={insets.bottom}
          activeTrack={activeTrack}
          activeTrackId={activeTrackId}
          musicPlaying={music.playing}
          onToggleTrack={toggleTrack}
          initialAnchorId={initialAnchorId}
          userId={userId}
          onExit={() => setReadingStarted(false)}
        />
      ) : (
        <ScreenplayOverview
          screenplay={screenplay}
          theme={theme}
          styles={styles}
          insetsTop={insets.top}
          insetsBottom={insets.bottom}
          purchased={purchased}
          priceUzs={price}
          promo={promo}
          activeTrackId={activeTrackId}
          musicPlaying={music.playing}
          onToggleTrack={toggleTrack}
          onStart={startReading}
          onBuy={handleBuy}
        />
      )}

      <BuyConfirmSheet
        visible={showBuy}
        title={screenplay.title}
        priceUzs={price}
        benefits={["Ssenariyni to'liq o'qish", "Doimiy kirish huquqi"]}
        onConfirm={confirmBuy}
        onClose={() => setShowBuy(false)}
        promo={promo}
      />
      <CardPaymentSheet
        flow={purchaseFlow}
        title={screenplay.title}
        success={{
          kind: "content",
          onPrimary: () => {
            purchaseFlow.reset();
            startReading();
          },
          onSecondary: () => {
            purchaseFlow.reset();
            router.push("/library");
          },
        }}
        onClose={purchaseFlow.reset}
      />
    </>
  );
}

type StylesType = ReturnType<typeof createStyles>;
type ActiveTrack = DisplayScreenplay["music"][number] | null;

// ─── Overview (detail) ───────────────────────────────────────────────────────

function ScreenplayOverview({
  screenplay,
  theme,
  styles,
  insetsTop,
  insetsBottom,
  purchased,
  priceUzs,
  promo,
  activeTrackId,
  musicPlaying,
  onToggleTrack,
  onStart,
  onBuy,
}: {
  screenplay: DisplayScreenplay;
  theme: PageTheme;
  styles: StylesType;
  insetsTop: number;
  insetsBottom: number;
  purchased: boolean;
  priceUzs: number;
  promo: ReturnType<typeof usePromo>;
  activeTrackId: string | null;
  musicPlaying: boolean;
  onToggleTrack: (id: string) => void;
  onStart: (anchorId?: string | null) => void;
  onBuy: () => void;
}) {
  const { planned, toggle } = usePlannedRead("scenario", screenplay.id);
  const heroWidth = Math.min(SCREEN_W, IS_WIDE ? PAPER_MAX : SCREEN_W);
  const heroHeight = Math.min(Math.round(heroWidth / 0.74), Math.round(SCREEN_H * 0.62));
  const [selectedCharacter, setSelectedCharacter] = useState<ScreenplayCharacter | null>(null);
  const [selectedScene, setSelectedScene] = useState<ScreenplaySceneBlock | null>(null);
  const tocItems = screenplay.toc.length > 0
    ? screenplay.toc
    : screenplay.scenes.map((scene) => ({
        id: `scene-${scene.id}`,
        title: scene.title,
        anchorId: scene.id,
        level: 2 as const,
        sortOrder: scene.number,
      }));

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insetsBottom + 42 }}
      >
        {/* Hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          {screenplay.coverUrl ? (
            <Image source={{ uri: screenplay.coverUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.heroFallback]}>
              <Film color="rgba(255,255,255,0.85)" size={44} strokeWidth={1.4} />
            </View>
          )}
          <LinearGradient
            colors={["rgba(8,12,16,0.32)", "rgba(8,12,16,0.05)", "rgba(8,12,16,0.55)", "rgba(8,12,16,0.92)"]}
            locations={[0, 0.32, 0.7, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.topBar, { paddingTop: insetsTop + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.heroIconButton} hitSlop={8}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => toggle({ title: screenplay.title, cover: screenplay.coverUrl, author: screenplay.author })}
                style={[styles.heroIconButton, planned && { backgroundColor: "rgba(47,158,110,0.92)" }]}
                hitSlop={8}
                accessibilityLabel="Tez orada o'qiyman"
              >
                <Clock color="#fff" size={19} />
              </Pressable>
              <Pressable
                onPress={() => shareContent({ title: screenplay.title, author: screenplay.author, description: screenplay.description })}
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
              <Film color="#fff" size={12} />
              <Text style={styles.heroBadgeText}>SSENARIY</Text>
            </View>
            <Text style={styles.heroTitle}>{screenplay.title}</Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {screenplay.author} · {screenplay.genre}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Meta pills */}
          <View style={styles.metaRow}>
            {screenplay.durationLabel ? (
              <MetaPill icon={<Clock color={theme.sub} size={14} />} text={screenplay.durationLabel} styles={styles} />
            ) : null}
            {screenplay.readCount > 0 ? (
              <MetaPill icon={<Eye color={theme.sub} size={14} />} text={`${formatCount(screenplay.readCount)} o'qildi`} styles={styles} />
            ) : null}
            {screenplay.ageRating ? (
              <MetaPill icon={<Shield color={theme.sub} size={14} />} text={screenplay.ageRating} styles={styles} />
            ) : null}
            <MetaPill
              icon={<ShoppingBag color={theme.sub} size={14} />}
              text={screenplay.isFree ? "Bepul" : formatUzs(priceUzs)}
              styles={styles}
            />
          </View>

          {screenplay.description ? <Text style={styles.lead}>{screenplay.description}</Text> : null}

          {/* Background music (fon musiqasi) — NOT an audiobook */}
          {screenplay.music.length > 0 ? (
            <View style={styles.musicSection}>
              <Text style={styles.sectionLabel}>Fon musiqasi</Text>
              {screenplay.music.map((track) => {
                const isActive = activeTrackId === track.id && musicPlaying;
                return (
                  <Pressable key={track.id} onPress={() => onToggleTrack(track.id)} style={styles.musicRow}>
                    <View style={[styles.musicPlay, isActive && styles.musicPlayActive]}>
                      {isActive ? <Pause color="#fff" size={15} fill="#fff" /> : <Play color={PRIMARY} size={15} fill={PRIMARY} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.musicTitle} numberOfLines={1}>{track.title}</Text>
                      {track.mood || track.usagePlace ? (
                        <Text style={styles.musicSub} numberOfLines={1}>
                          {[track.mood, track.usagePlace].filter(Boolean).join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                    {track.durationLabel ? <Text style={styles.musicSub}>{track.durationLabel}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Primary CTA */}
          {!purchased && promo.isActive ? (
            <View style={{ marginTop: 20 }}>
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

          <PressableScale onPress={purchased ? onStart : onBuy} style={styles.primaryCta}>
            {purchased ? <BookOpen color="#fff" size={19} /> : <Lock color="#fff" size={18} />}
            <Text style={styles.primaryCtaText}>
              {purchased ? "O'qishni boshlash" : `${formatUzs(priceUzs)} ga ochish`}
            </Text>
          </PressableScale>

          {/* Mundarija */}
          {tocItems.length > 0 ? (
            <Section title="Mundarija" styles={styles}>
              <View style={styles.tocCard}>
                {tocItems.map((item, index) => (
                  <Pressable key={item.id} onPress={() => onStart(item.anchorId)} style={styles.tocRow}>
                    <Text style={styles.tocNumber}>{index + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tocTitle, item.level === 1 ? styles.tocTitleStrong : null]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.tocMeta} numberOfLines={1}>
                        {item.level === 1 ? "Parda" : "Sahna / bo'lim"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Manzaralar */}
          {screenplay.scenes.length > 0 ? (
            <Section title="Manzaralar" styles={styles}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {screenplay.scenes.map((scene) => (
                  <Pressable key={scene.id} onPress={() => setSelectedScene(scene)} style={styles.sceneCard}>
                    {scene.imageUrl ? (
                      <Image source={{ uri: scene.imageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, styles.sceneCardFallback]}>
                        <Film color={PRIMARY} size={24} />
                      </View>
                    )}
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.74)"]} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.sceneCardCopy}>
                      <Text style={styles.sceneCardNum}>{scene.number}-SAHNA</Text>
                      <Text style={styles.sceneCardTitle} numberOfLines={1}>{scene.title}</Text>
                      {scene.requirements ? (
                        <Text style={styles.sceneRequirements} numberOfLines={2}>{scene.requirements}</Text>
                      ) : scene.description ? (
                        <Text style={styles.sceneCardMeta} numberOfLines={2}>{scene.description}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Qatnashuvchilar */}
          {screenplay.characters.length > 0 ? (
            <Section title="Qatnashuvchilar" styles={styles}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {screenplay.characters.map((ch) => (
                  <Pressable key={ch.id} onPress={() => setSelectedCharacter(ch)} style={styles.charCard}>
                    {ch.imageUrl ? (
                      <Image source={{ uri: ch.imageUrl }} style={styles.charAvatarImage} contentFit="cover" />
                    ) : (
                      <View style={styles.charAvatar}>
                        <Users color={PRIMARY} size={22} />
                      </View>
                    )}
                    <Text style={styles.charName} numberOfLines={1}>{ch.name}</Text>
                    {ch.role ? <Text style={styles.charRole} numberOfLines={1}>{ch.role}</Text> : null}
                    {ch.actingNote ? <Text style={styles.charActor} numberOfLines={1}>{ch.actingNote}</Text> : null}
                    {ch.description ? <Text style={styles.charDesc} numberOfLines={3}>{ch.description}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Rasmlar (gallery) */}
          {screenplay.gallery.length > 0 ? (
            <Section title="Rasmlar" styles={styles}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {screenplay.gallery.map((img) => (
                  <View key={img.id} style={styles.galleryCard}>
                    <Image source={{ uri: img.url }} style={styles.galleryImage} contentFit="cover" />
                    {img.caption ? <Text style={styles.galleryCaption} numberOfLines={1}>{img.caption}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </Section>
          ) : null}
        </View>

        <RatingReviewBlock
          contentType="script"
          contentId={screenplay.id}
          title={screenplay.title}
          author={screenplay.author}
          coverUrl={screenplay.coverUrl ?? undefined}
        />
      </ScrollView>
      <CharacterDetailSheet character={selectedCharacter} theme={theme} styles={styles} onClose={() => setSelectedCharacter(null)} />
      <SceneDetailSheet scene={selectedScene} theme={theme} styles={styles} onClose={() => setSelectedScene(null)} />
    </Screen>
  );
}

function MetaPill({ icon, text, styles }: { icon: React.ReactNode; text: string; styles: StylesType }) {
  return (
    <View style={styles.metaPill}>
      {icon}
      <Text style={styles.metaPillText}>{text}</Text>
    </View>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: StylesType }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CharacterDetailSheet({
  character,
  theme,
  styles,
  onClose,
}: {
  character: ScreenplayCharacter | null;
  theme: PageTheme;
  styles: StylesType;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!character} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.bg }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Qatnashuvchi</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X color={theme.sub} size={20} />
          </Pressable>
        </View>
        {character ? (
          <View style={styles.detailSheetBody}>
            {character.imageUrl ? (
              <Image source={{ uri: character.imageUrl }} style={styles.detailAvatar} contentFit="cover" />
            ) : (
              <View style={styles.detailAvatarFallback}>
                <Users color={PRIMARY} size={30} />
              </View>
            )}
            <Text style={[styles.detailTitle, { color: theme.text }]}>{character.name}</Text>
            {character.role ? <Text style={styles.detailRole}>{character.role}</Text> : null}
            {character.actingNote ? <Text style={[styles.detailMeta, { color: theme.sub }]}>{character.actingNote}</Text> : null}
            {character.description ? (
              <Text style={[styles.detailText, { color: theme.text }]}>{character.description}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function SceneDetailSheet({
  scene,
  theme,
  styles,
  onClose,
}: {
  scene: ScreenplaySceneBlock | null;
  theme: PageTheme;
  styles: StylesType;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!scene} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.bg }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>Manzara</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X color={theme.sub} size={20} />
          </Pressable>
        </View>
        {scene ? (
          <View style={styles.detailSheetBody}>
            {scene.imageUrl ? (
              <Image source={{ uri: scene.imageUrl }} style={styles.detailSceneImage} contentFit="cover" />
            ) : null}
            <Text style={[styles.detailTitle, { color: theme.text }]}>{scene.title}</Text>
            {scene.description ? (
              <Text style={[styles.detailText, { color: theme.text }]}>{scene.description}</Text>
            ) : null}
            {scene.requirements ? (
              <Text style={[styles.detailRequirements, { color: theme.sub }]}>
                {scene.requirements}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// ─── Reader ──────────────────────────────────────────────────────────────────

function ScreenplayReader({
  screenplay,
  theme,
  pageThemeKey,
  setPageThemeKey,
  fontKey,
  setFontKey,
  fontSize,
  setFontSize,
  styles,
  insetsTop,
  insetsBottom,
  activeTrack,
  activeTrackId,
  musicPlaying,
  onToggleTrack,
  initialAnchorId,
  userId,
  onExit,
}: {
  screenplay: DisplayScreenplay;
  theme: PageTheme;
  pageThemeKey: PageThemeKey;
  setPageThemeKey: (k: PageThemeKey) => void;
  fontKey: ReaderFontKey;
  setFontKey: (k: ReaderFontKey) => void;
  fontSize: number;
  setFontSize: (updater: (v: number) => number) => void;
  styles: StylesType;
  insetsTop: number;
  insetsBottom: number;
  activeTrack: ActiveTrack;
  activeTrackId: string | null;
  musicPlaying: boolean;
  onToggleTrack: (id: string) => void;
  initialAnchorId: string | null;
  userId: string | null | undefined;
  onExit: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const anchorOffsets = useRef<Record<string, number>>({});
  const blockOffsets = useRef<Record<string, number>>({});
  const lastBlockId = useRef<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<ScreenplayCharacter | null>(null);
  const [selectedScene, setSelectedScene] = useState<ScreenplaySceneBlock | null>(null);
  const fontFamily = READER_FONTS[fontKey];
  const hasBlocks = screenplay.blocks.length > 0;
  const hasScenes = screenplay.scenes.length > 0;
  const tocItems = screenplay.toc.length > 0
    ? screenplay.toc
    : screenplay.scenes.map((scene) => ({
        id: `scene-${scene.id}`,
        title: scene.title,
        anchorId: scene.id,
        level: 2 as const,
        sortOrder: scene.number,
      }));
  const fallbackParas = useMemo(
    () => (screenplay.fallbackBody ? screenplay.fallbackBody.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : []),
    [screenplay.fallbackBody]
  );

  // Persist reading progress (reading_progress table via recordReading).
  const savedRef = useRef(0);
  const persistProgress = useCallback(
    (pct: number) => {
      if (Math.abs(pct - savedRef.current) < 0.08 && pct < 0.98) return;
      savedRef.current = pct;
      recordReading({
        contentType: "scenario",
        contentId: screenplay.id,
        title: screenplay.title,
        cover: screenplay.coverUrl,
        author: screenplay.author,
        progress: pct,
        finished: pct >= 0.98,
      });
      void recordScreenplayRead({
        userId,
        screenplayId: screenplay.id,
        progressPercent: pct * 100,
        lastBlockId: lastBlockId.current,
        completed: pct >= 0.98,
      });
    },
    [screenplay, userId]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const scrollable = Math.max(1, contentSize.height - layoutMeasurement.height);
    const pct = Math.max(0, Math.min(1, contentOffset.y / scrollable));
    const y = contentOffset.y + 80;
    const current = Object.entries(blockOffsets.current)
      .filter(([, offset]) => offset <= y)
      .sort((a, b) => b[1] - a[1])[0];
    if (current) lastBlockId.current = current[0];
    setProgress(pct);
    persistProgress(pct);
  };

  const jumpToAnchor = useCallback((anchorId: string) => {
    const y = anchorOffsets.current[anchorId] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    setTocOpen(false);
  }, []);

  useEffect(() => {
    if (!initialAnchorId) return;
    const timer = setTimeout(() => jumpToAnchor(initialAnchorId), 360);
    return () => clearTimeout(timer);
  }, [initialAnchorId, jumpToAnchor]);

  const openCharacterRef = useCallback((title: string) => {
    const found = screenplay.characters.find((ch) => ch.name.toLowerCase() === title.toLowerCase());
    if (found) setSelectedCharacter(found);
  }, [screenplay.characters]);

  const openSceneRef = useCallback((title: string) => {
    const found = screenplay.scenes.find((scene) => scene.title.toLowerCase() === title.toLowerCase());
    if (found) setSelectedScene(found);
  }, [screenplay.scenes]);

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      {/* Top bar */}
      <View style={[styles.readerBar, { paddingTop: insetsTop + 8, backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={onExit} style={styles.readerBarBtn} hitSlop={8}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text style={[styles.readerBarTitle, { color: theme.text }]} numberOfLines={1}>{screenplay.title}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable onPress={() => setSettingsOpen((v) => !v)} style={styles.readerBarBtn} hitSlop={8}>
            <Type color={theme.text} size={19} />
          </Pressable>
          {tocItems.length > 0 ? (
            <Pressable onPress={() => setTocOpen(true)} style={styles.readerBarBtn} hitSlop={8}>
              <List color={theme.text} size={20} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.soft }]}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {settingsOpen ? (
        <ReaderSettings
          theme={theme}
          styles={styles}
          fontSize={fontSize}
          fontKey={fontKey}
          pageThemeKey={pageThemeKey}
          onFontMinus={() => setFontSize((v) => Math.max(15, v - 1))}
          onFontPlus={() => setFontSize((v) => Math.min(24, v + 1))}
          onFont={setFontKey}
          onTheme={setPageThemeKey}
        />
      ) : null}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={[styles.readerContent, { paddingBottom: insetsBottom + (activeTrack ? 96 : 40) }]}
      >
        <View style={styles.paper}>
          <Text style={[styles.docTitle, { color: theme.text, fontFamily }]}>{screenplay.title}</Text>
          <Text style={[styles.docMeta, { color: theme.sub }]}>{screenplay.author} · {screenplay.genre}</Text>

          {hasBlocks ? (
            screenplay.blocks.map((block, index) => (
              <View
                key={block.id}
                onLayout={(e) => {
                  blockOffsets.current[block.id] = e.nativeEvent.layout.y;
                  if (block.anchorId) anchorOffsets.current[block.anchorId] = e.nativeEvent.layout.y;
                }}
              >
                <ScriptBlockView
                  block={block}
                  theme={theme}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  styles={styles}
                  activeTrackId={activeTrackId}
                  musicPlaying={musicPlaying}
                  onCharacter={openCharacterRef}
                  onScene={openSceneRef}
                  onMusic={onToggleTrack}
                />
                {index < screenplay.blocks.length - 1 && block.type === "act" ? (
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                ) : null}
              </View>
            ))
          ) : hasScenes ? (
            screenplay.scenes.map((scene, index) => (
              <View
                key={scene.id}
                onLayout={(e) => {
                  blockOffsets.current[scene.id] = e.nativeEvent.layout.y;
                  anchorOffsets.current[scene.id] = e.nativeEvent.layout.y;
                }}
              >
                {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                <SceneBlockView scene={scene} theme={theme} fontFamily={fontFamily} fontSize={fontSize} styles={styles} />
              </View>
            ))
          ) : fallbackParas.length > 0 ? (
            fallbackParas.map((para, i) => (
              <Text
                key={i}
                style={[styles.actionText, { color: theme.text, fontFamily, fontSize, lineHeight: fontSize * 1.6 }]}
              >
                {para}
              </Text>
            ))
          ) : (
            <View style={styles.readerEmpty}>
              <Text style={[styles.readerEmptyText, { color: theme.sub }]}>
                Ssenariy matni hozircha mavjud emas
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky background-music bar */}
      {activeTrack ? (
        <View style={[styles.musicBar, { bottom: insetsBottom + 12 }]}>
          <Pressable onPress={() => onToggleTrack(activeTrack.id)} style={styles.musicBarPlay}>
            {activeTrackId === activeTrack.id && musicPlaying ? (
              <Pause color="#fff" size={16} fill="#fff" />
            ) : (
              <Play color="#fff" size={16} fill="#fff" />
            )}
          </Pressable>
          <Music2 color="#fff" size={15} />
          <Text style={styles.musicBarText} numberOfLines={1}>{activeTrack.title}</Text>
        </View>
      ) : null}

      {/* Mundarija bottom sheet */}
      <Modal visible={tocOpen} transparent animationType="slide" onRequestClose={() => setTocOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTocOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insetsBottom + 16 }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Mundarija</Text>
            <Pressable onPress={() => setTocOpen(false)} hitSlop={8}>
              <X color={theme.sub} size={20} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: SCREEN_H * 0.6 }}>
            {tocItems.map((item, index) => (
              <Pressable key={item.id} onPress={() => jumpToAnchor(item.anchorId)} style={styles.sheetRow}>
                <Text style={styles.tocNumber}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tocTitle, { color: theme.text }, item.level === 1 ? styles.tocTitleStrong : null]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.tocMeta, { color: theme.sub }]} numberOfLines={1}>
                    {item.level === 1 ? "Parda" : "Sahna / bo'lim"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <CharacterDetailSheet character={selectedCharacter} theme={theme} styles={styles} onClose={() => setSelectedCharacter(null)} />
      <SceneDetailSheet scene={selectedScene} theme={theme} styles={styles} onClose={() => setSelectedScene(null)} />
    </Screen>
  );
}

function SceneBlockView({
  scene,
  theme,
  fontFamily,
  fontSize,
  styles,
}: {
  scene: ScreenplaySceneBlock;
  theme: PageTheme;
  fontFamily: string;
  fontSize: number;
  styles: StylesType;
}) {
  return (
    <View style={styles.sceneBlock}>
      {/* Scene heading — uppercase/bold on a soft card */}
      <View style={[styles.sceneHeading, { backgroundColor: theme.soft, borderColor: theme.border }]}>
        <Text style={styles.sceneHeadingText}>{scene.heading}</Text>
        {scene.title && scene.title !== scene.heading ? (
          <Text style={[styles.sceneHeadingSub, { color: theme.sub }]}>{scene.title}</Text>
        ) : null}
      </View>

      {scene.imageUrl ? (
        <Image source={{ uri: scene.imageUrl }} style={styles.sceneInlineImage} contentFit="cover" />
      ) : null}

      {scene.lines.map((line) => (
        <LineView key={line.id} line={line} theme={theme} fontFamily={fontFamily} fontSize={fontSize} styles={styles} />
      ))}
    </View>
  );
}

function ScriptBlockView({
  block,
  theme,
  fontFamily,
  fontSize,
  styles,
  activeTrackId,
  musicPlaying,
  onCharacter,
  onScene,
  onMusic,
}: {
  block: ScreenplayContentBlock;
  theme: PageTheme;
  fontFamily: string;
  fontSize: number;
  styles: StylesType;
  activeTrackId: string | null;
  musicPlaying: boolean;
  onCharacter: (title: string) => void;
  onScene: (title: string) => void;
  onMusic: (id: string) => void;
}) {
  const lineHeight = fontSize * 1.6;
  const text = block.displayText || block.text;

  if (block.type === "divider") {
    return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
  }

  if (block.type === "image") {
    return (
      <View style={styles.blockImageWrap}>
        {block.imageUrl ? (
          <Image source={{ uri: block.imageUrl }} style={styles.blockImage} contentFit="cover" />
        ) : null}
        {block.caption ? <Text style={[styles.blockCaption, { color: theme.sub }]}>{block.caption}</Text> : null}
      </View>
    );
  }

  if (block.type === "act") {
    return (
      <View style={styles.actBlock}>
        <Text style={[styles.actText, { color: theme.text, fontFamily }]}>{block.title || text}</Text>
      </View>
    );
  }

  if (block.type === "section" || block.type === "heading") {
    return (
      <View style={[styles.sectionBlock, { backgroundColor: theme.soft, borderColor: theme.border }]}>
        <Text style={styles.sectionBlockText}>{block.title || text}</Text>
      </View>
    );
  }

  if (block.type === "dialogue") {
    return (
      <View style={styles.dialogueBlock}>
        {block.character ? (
          <Text onPress={() => onCharacter(block.character as string)} style={styles.dialogueSpeaker}>
            {block.character}
          </Text>
        ) : null}
        <ReferenceText
          text={text}
          block={block}
          style={[styles.dialogueText, { color: theme.text, fontFamily, fontSize, lineHeight: fontSize * 1.55 }]}
          onCharacter={onCharacter}
          onScene={onScene}
        />
        <ReferencePills
          block={block}
          styles={styles}
          activeTrackId={activeTrackId}
          musicPlaying={musicPlaying}
          onCharacter={onCharacter}
          onScene={onScene}
          onMusic={onMusic}
        />
      </View>
    );
  }

  if (block.type === "note") {
    return (
      <View style={[styles.noteBlock, { backgroundColor: theme.soft, borderColor: theme.border }]}>
        <ReferenceText
          text={text}
          block={block}
          style={[styles.noteText, { color: theme.sub, fontFamily, fontSize: fontSize * 0.95, lineHeight: fontSize * 1.5 }]}
          onCharacter={onCharacter}
          onScene={onScene}
        />
      </View>
    );
  }

  return (
    <View style={styles.paragraphBlock}>
      <ReferenceText
        text={text}
        block={block}
        style={[styles.actionText, { color: theme.text, fontFamily, fontSize, lineHeight }]}
        onCharacter={onCharacter}
        onScene={onScene}
      />
      <ReferencePills
        block={block}
        styles={styles}
        activeTrackId={activeTrackId}
        musicPlaying={musicPlaying}
        onCharacter={onCharacter}
        onScene={onScene}
        onMusic={onMusic}
      />
    </View>
  );
}

function ReferenceText({
  text,
  block,
  style,
  onCharacter,
  onScene,
}: {
  text: string;
  block: ScreenplayContentBlock;
  style: any;
  onCharacter: (title: string) => void;
  onScene: (title: string) => void;
}) {
  const clickable = block.refs.filter((ref) => ref.type === "character" || ref.type === "scene");
  if (clickable.length === 0 || !text) return <Text style={style}>{text}</Text>;

  const byTitle = new Map(clickable.map((ref) => [ref.title.toLowerCase(), ref]));
  const names = clickable
    .map((ref) => ref.title)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${names.map(escapeLocalRe).join("|")})`, "gi");
  const parts = text.split(re).filter((part) => part.length > 0);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const ref = byTitle.get(part.toLowerCase());
        if (!ref) return <Text key={`${part}-${index}`}>{part}</Text>;
        return (
          <Text
            key={`${ref.id}-${index}`}
            onPress={() => (ref.type === "character" ? onCharacter(ref.title) : onScene(ref.title))}
            style={{ color: PRIMARY, fontWeight: "900" }}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function ReferencePills({
  block,
  styles,
  activeTrackId,
  musicPlaying,
  onCharacter,
  onScene,
  onMusic,
}: {
  block: ScreenplayContentBlock;
  styles: StylesType;
  activeTrackId: string | null;
  musicPlaying: boolean;
  onCharacter: (title: string) => void;
  onScene: (title: string) => void;
  onMusic: (id: string) => void;
}) {
  const refs = block.refs.filter((ref) => ref.type === "music" || ref.type === "scene");
  if (refs.length === 0) return null;
  return (
    <View style={styles.refRow}>
      {refs.map((ref) => {
        const active = ref.type === "music" && activeTrackId === ref.targetId && musicPlaying;
        return (
          <Pressable
            key={ref.id}
            onPress={() => {
              if (ref.type === "character") onCharacter(ref.title);
              else if (ref.type === "scene") onScene(ref.title);
              else if (ref.targetId) onMusic(ref.targetId);
            }}
            style={[styles.refPill, active ? styles.refPillActive : null]}
          >
            {ref.type === "music" ? (
              active ? <Pause color={active ? "#fff" : PRIMARY} size={12} /> : <Music2 color={active ? "#fff" : PRIMARY} size={12} />
            ) : (
              <Film color={active ? "#fff" : PRIMARY} size={12} />
            )}
            <Text style={[styles.refPillText, active ? styles.refPillTextActive : null]} numberOfLines={1}>
              {ref.type === "music" ? "Fon musiqasi" : ref.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function escapeLocalRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function LineView({
  line,
  theme,
  fontFamily,
  fontSize,
  styles,
}: {
  line: ScreenplayLineBlock;
  theme: PageTheme;
  fontFamily: string;
  fontSize: number;
  styles: StylesType;
}) {
  const lineHeight = fontSize * 1.55;
  switch (line.type) {
    case "character":
      return <Text style={[styles.characterText, { fontSize: fontSize * 0.94 }]}>{line.text}</Text>;
    case "parenthetical":
      return (
        <Text style={[styles.parentheticalText, { color: theme.sub, fontSize: fontSize * 0.9 }]}>{line.text}</Text>
      );
    case "dialogue":
      return (
        <Text style={[styles.dialogueText, { color: theme.text, fontFamily, fontSize, lineHeight }]}>{line.text}</Text>
      );
    case "transition":
      return <Text style={[styles.transitionText, { color: theme.sub }]}>{line.text}</Text>;
    default:
      return (
        <Text style={[styles.actionText, { color: theme.text, fontFamily, fontSize, lineHeight: fontSize * 1.6 }]}>
          {line.text}
        </Text>
      );
  }
}

function ReaderSettings({
  theme,
  styles,
  fontSize,
  fontKey,
  pageThemeKey,
  onFontMinus,
  onFontPlus,
  onFont,
  onTheme,
}: {
  theme: PageTheme;
  styles: StylesType;
  fontSize: number;
  fontKey: ReaderFontKey;
  pageThemeKey: PageThemeKey;
  onFontMinus: () => void;
  onFontPlus: () => void;
  onFont: (k: ReaderFontKey) => void;
  onTheme: (k: PageThemeKey) => void;
}) {
  return (
    <View style={[styles.settingsPanel, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
      <View style={styles.settingsRow}>
        <Text style={[styles.settingsLabel, { color: theme.sub }]}>Matn kattaligi</Text>
        <View style={styles.stepper}>
          <Pressable onPress={onFontMinus} style={[styles.stepperBtn, { borderColor: theme.border, backgroundColor: theme.soft }]}>
            <Minus color={theme.text} size={15} />
          </Pressable>
          <Text style={[styles.stepperValue, { color: theme.text }]}>{fontSize}</Text>
          <Pressable onPress={onFontPlus} style={[styles.stepperBtn, { borderColor: theme.border, backgroundColor: theme.soft }]}>
            <Plus color={theme.text} size={15} />
          </Pressable>
        </View>
      </View>
      <View style={styles.settingsRow}>
        <Text style={[styles.settingsLabel, { color: theme.sub }]}>Shrift</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {FONT_OPTIONS.map((opt) => {
            const active = fontKey === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => onFont(opt.key)}
                style={[styles.chip, { borderColor: theme.border }, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, { color: theme.text }, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.settingsRow}>
        <Text style={[styles.settingsLabel, { color: theme.sub }]}>Sahifa rangi</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(Object.keys(PAGE_THEMES) as PageThemeKey[]).map((key) => {
            const active = pageThemeKey === key;
            return (
              <Pressable
                key={key}
                onPress={() => onTheme(key)}
                style={[styles.swatch, { backgroundColor: PAGE_THEMES[key].bg, borderColor: theme.border }, active && styles.swatchActive]}
              >
                <View style={[styles.swatchDot, { backgroundColor: PAGE_THEMES[key].text }]} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function createStyles(theme: PageTheme) {
  return StyleSheet.create({
    centerState: { flex: 1, alignItems: "center", gap: 14, paddingHorizontal: 24 },
    stateText: { fontSize: 14, fontWeight: "600" },
    notFoundTitle: { fontSize: 21, fontWeight: "800", marginBottom: 16, textAlign: "center" },
    notFoundButton: { height: 44, borderRadius: 14, backgroundColor: PRIMARY, paddingHorizontal: 22, justifyContent: "center" },
    notFoundButtonText: { color: "#fff", fontWeight: "800" },

    // Hero
    hero: { width: "100%", maxWidth: PAPER_MAX, alignSelf: "center", overflow: "hidden", backgroundColor: "#0E1318" },
    heroFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#132019" },
    topBar: { paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    heroIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center" },
    heroCopy: { marginTop: "auto", paddingHorizontal: 22, paddingBottom: 30, maxWidth: PAPER_MAX, alignSelf: "center", width: "100%" },
    heroBadge: {
      alignSelf: "flex-start",
      height: 26,
      borderRadius: 7,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(47,158,110,0.95)",
    },
    heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
    heroTitle: { color: "#fff", fontFamily: FONT.serif, fontSize: IS_WIDE ? 40 : 30, lineHeight: IS_WIDE ? 46 : 36, fontWeight: "800", marginTop: 12 },
    heroMeta: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: "700", marginTop: 8 },

    body: { width: "100%", maxWidth: PAPER_MAX, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, backgroundColor: theme.bg, marginTop: -16, borderTopLeftRadius: 18, borderTopRightRadius: 18 },

    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaPill: { flexDirection: "row", alignItems: "center", gap: 5, height: 30, borderRadius: 999, paddingHorizontal: 12, backgroundColor: theme.soft },
    metaPillText: { color: theme.sub, fontSize: 12, fontWeight: "700" },

    lead: { color: theme.sub, fontFamily: FONT.serif, fontSize: 17, lineHeight: 27, fontWeight: "500", marginTop: 18 },

    musicSection: { marginTop: 22 },
    sectionLabel: { color: theme.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.3, marginBottom: 10 },
    musicRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
    musicPlay: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.soft, borderWidth: 1, borderColor: theme.border },
    musicPlayActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    musicTitle: { color: theme.text, fontSize: 14, fontWeight: "700" },
    musicSub: { color: theme.sub, fontSize: 12, fontWeight: "600", marginTop: 2 },

    primaryCta: {
      height: 52,
      borderRadius: 15,
      backgroundColor: PRIMARY,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      marginTop: 22,
    },
    primaryCtaText: { color: "#fff", fontSize: 15, fontWeight: "800" },

    section: { marginTop: 30 },
    sectionTitle: { color: theme.text, fontSize: 19, fontFamily: FONT.serif, fontWeight: "800", marginBottom: 14 },

    tocCard: { borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.soft, overflow: "hidden" },
    tocRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
    tocNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: PRIMARY, color: "#fff", fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 26, overflow: "hidden" },
    tocTitle: { color: theme.text, fontSize: 14, fontWeight: "700" },
    tocTitleStrong: { fontWeight: "900" },
    tocMeta: { color: theme.sub, fontSize: 12, fontWeight: "600", marginTop: 2 },

    hRow: { gap: 12, paddingRight: 8 },
    sceneCard: { width: 200, height: 128, borderRadius: 14, overflow: "hidden", backgroundColor: theme.soft },
    sceneCardFallback: { alignItems: "center", justifyContent: "center", backgroundColor: theme.soft },
    sceneCardCopy: { marginTop: "auto", padding: 12 },
    sceneCardNum: { color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    sceneCardTitle: { color: "#fff", fontSize: 14, fontWeight: "800", marginTop: 3 },
    sceneCardMeta: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "600", marginTop: 1 },
    sceneRequirements: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "600", fontStyle: "italic", marginTop: 2 },

    charCard: { width: 156, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.soft, padding: 14 },
    charAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
    charAvatarImage: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.bg },
    charName: { color: theme.text, fontSize: 14, fontWeight: "800", marginTop: 10 },
    charRole: { color: PRIMARY, fontSize: 12, fontWeight: "700", marginTop: 2 },
    charActor: { color: theme.sub, fontSize: 11, fontWeight: "600", marginTop: 1 },
    charDesc: { color: theme.sub, fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 6 },

    galleryCard: { width: 150 },
    galleryImage: { width: 150, height: 150, borderRadius: 14, backgroundColor: theme.soft },
    galleryCaption: { color: theme.sub, fontSize: 12, fontWeight: "600", marginTop: 6 },

    // Reader
    readerBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    readerBarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    readerBarTitle: { flex: 1, fontSize: 15, fontWeight: "800", textAlign: "center" },
    progressTrack: { height: 3, width: "100%" },
    progressFill: { height: 3, backgroundColor: PRIMARY },

    readerContent: { paddingTop: 18, alignItems: "center" },
    paper: { width: "100%", maxWidth: 680, paddingHorizontal: 22 },
    docTitle: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
    docMeta: { fontSize: 13, fontWeight: "600", marginTop: 6, marginBottom: 18 },
    divider: { height: StyleSheet.hairlineWidth, width: "100%", marginVertical: 22 },

    sceneBlock: { marginBottom: 4 },
    actBlock: { alignItems: "center", paddingVertical: 28 },
    actText: { fontSize: 25, lineHeight: 32, fontWeight: "900", textAlign: "center" },
    sectionBlock: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 },
    sectionBlockText: { color: PRIMARY, fontSize: 14, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" },
    sceneHeading: { borderRadius: 12, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 14 },
    sceneHeadingText: { color: PRIMARY, fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
    sceneHeadingSub: { fontSize: 12, fontWeight: "600", marginTop: 3 },
    sceneInlineImage: { width: "100%", height: 200, borderRadius: 14, marginBottom: 16, backgroundColor: "rgba(0,0,0,0.05)" },

    actionText: { marginBottom: 14 },
    paragraphBlock: { marginBottom: 2 },
    noteBlock: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
    noteText: { fontStyle: "italic" },
    blockImageWrap: { marginBottom: 18 },
    blockImage: { width: "100%", height: 220, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.05)" },
    blockCaption: { fontSize: 12, fontWeight: "600", marginTop: 7, textAlign: "center" },
    dialogueBlock: { marginBottom: 6 },
    dialogueSpeaker: { color: PRIMARY, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 6, marginBottom: 2, marginLeft: "18%" },
    characterText: { color: PRIMARY, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 6, marginBottom: 2, marginLeft: "18%" },
    dialogueText: { marginBottom: 12, marginLeft: "12%", marginRight: "6%" },
    parentheticalText: { fontStyle: "italic", marginBottom: 4, marginLeft: "16%" },
    transitionText: { fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", textAlign: "right", marginTop: 6, marginBottom: 16, fontFamily: FONT.mono },
    refRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: -4, marginBottom: 12 },
    refPill: {
      minHeight: 28,
      maxWidth: "100%",
      borderRadius: 999,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: theme.soft,
      borderWidth: 1,
      borderColor: theme.border,
    },
    refPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    refPillText: { color: PRIMARY, fontSize: 11, fontWeight: "800", flexShrink: 1 },
    refPillTextActive: { color: "#fff" },

    readerEmpty: { paddingVertical: 60, alignItems: "center" },
    readerEmptyText: { fontSize: 15, fontWeight: "600" },

    musicBar: {
      position: "absolute",
      left: 22,
      right: 22,
      height: 52,
      borderRadius: 16,
      backgroundColor: "rgba(20,26,22,0.94)",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
    },
    musicBarPlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
    musicBarText: { color: "#fff", fontSize: 13, fontWeight: "700", flex: 1 },

    // Settings panel
    settingsPanel: { paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    settingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    settingsLabel: { fontSize: 13, fontWeight: "700" },
    stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
    stepperBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
    stepperValue: { fontSize: 14, fontWeight: "800", minWidth: 22, textAlign: "center" },
    chip: { height: 34, borderRadius: 999, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
    chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    chipText: { fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: "#fff" },
    swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    swatchActive: { borderColor: PRIMARY, borderWidth: 2 },
    swatchDot: { width: 12, height: 12, borderRadius: 6 },

    // Sheet
    sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16 },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    sheetTitle: { fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },
    sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
    detailSheetBody: { paddingTop: 10, paddingBottom: 28, alignItems: "center" },
    detailAvatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: theme.soft, marginBottom: 14 },
    detailAvatarFallback: { width: 92, height: 92, borderRadius: 46, backgroundColor: theme.soft, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    detailSceneImage: { width: "100%", height: 190, borderRadius: 16, backgroundColor: theme.soft, marginBottom: 16 },
    detailTitle: { fontSize: 22, lineHeight: 28, fontWeight: "900", fontFamily: FONT.serif, textAlign: "center" },
    detailRole: { color: PRIMARY, fontSize: 13, fontWeight: "900", marginTop: 5, textAlign: "center" },
    detailMeta: { fontSize: 12, fontWeight: "700", marginTop: 3, textAlign: "center" },
    detailText: { fontSize: 15, lineHeight: 23, fontWeight: "500", marginTop: 14, textAlign: "left", alignSelf: "stretch" },
    detailRequirements: { fontSize: 14, lineHeight: 21, fontStyle: "italic", marginTop: 14, alignSelf: "stretch" },
  });
}
