import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bookmark,
  ChevronDown,
  List,
  Mic,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import AudioTocList from "@/components/audio/AudioTocList";
import { FONT, PressableScale } from "@/components/ui";
import { usePublishedBook } from "@/hooks/usePublishedBooks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useBookAudio, type AudioTocItem } from "@/hooks/useBookAudio";
import { formatTimecode } from "@/lib/media";
import { useApp } from "@/providers/AppProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthGate } from "@/providers/AuthGateProvider";
import BuyConfirmSheet from "@/components/payments/BuyConfirmSheet";
import CardPaymentSheet from "@/components/payments/CardPaymentSheet";
import PremiumPaywallCard from "@/components/payments/PremiumPaywallCard";
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

const { width: SCREEN_W } = Dimensions.get("window");
const BAR_COUNT = 56;
const SPEEDS: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];

export default function AudioPlayer() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const { book, loading, error } = usePublishedBook(String(id));
  const { savedBookIds, toggleSaveBook } = useApp();
  const { isAuthenticated } = useAuth();
  const { promptLogin } = useAuthGate();
  const access = useContentAccess("book", book?.id, { isFree: book?.isFree });
  const purchaseFlow = usePurchaseFlow();
  const paymentProductQuery = usePaymentProduct("book", book?.id);
  const paymentProduct = paymentProductQuery.data ?? null;
  const promo = usePromo({
    contentType: paymentProduct?.content_type ?? "book",
    contentId: paymentProduct?.content_id ?? book?.id,
    productId: paymentProduct?.id,
  });
  const [showBuy, setShowBuy] = useState(false);

  // Audio file + table of contents (falls back to legacy book.audioUrl).
  const audioData = useBookAudio(String(id), book?.audioUrl ?? null);

  const {
    playing,
    position,
    duration,
    speed,
    loading: audioLoading,
    error: audioError,
    togglePlay,
    startScrub,
    endScrub,
    seekDelta,
    seekTo,
    changeSpeed,
  } = useAudioPlayer(audioData.audioUrl);

  const [tocOpen, setTocOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedStartRef = useRef(false);

  const saved = book ? savedBookIds.includes(book.id) : false;
  const progress = duration > 0 ? position / duration : 0;
  const displayDuration = duration > 0 ? duration : audioData.durationSeconds ?? 0;

  // Active TOC item = last item whose start time has been reached.
  const activeTocId = useMemo(() => {
    let active: string | null = null;
    for (const item of audioData.tocItems) {
      if (item.startSeconds == null) continue;
      if (item.startSeconds <= position + 0.3) {
        if (item.endSeconds != null && position >= item.endSeconds) continue;
        active = item.id;
      }
    }
    return active;
  }, [audioData.tocItems, position]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(
        () => setToast(null)
      );
    }, 1800);
  }, [toastAnim]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const handleSelectToc = useCallback((item: AudioTocItem) => {
    if (item.startSeconds == null) return;
    seekTo(item.startSeconds, true);
    setTocOpen(false);
    showToast("Audio shu joydan boshlandi");
  }, [seekTo, showToast]);

  // Apply ?start= deep-link once the audio is loaded (duration known).
  useEffect(() => {
    if (appliedStartRef.current) return;
    const startSec = start != null ? Number(start) : NaN;
    if (!Number.isFinite(startSec)) {
      appliedStartRef.current = true;
      return;
    }
    if (duration > 0) {
      seekTo(startSec, true);
      appliedStartRef.current = true;
    }
  }, [start, duration, seekTo]);

  const onShare = useCallback(async () => {
    try {
      await Share.share({ message: `${book?.title ?? "AdabiyotX"} — ${book?.authorName ?? ""}` });
    } catch { }
  }, [book?.title, book?.authorName]);

  const bars = useMemo(
    () => Array.from({ length: BAR_COUNT }).map((_, i) => 6 + Math.abs(Math.sin(i * 0.65)) * 30 + (i % 4) * 2),
    []
  );
  const animatedBars = useRef(bars.map((h) => new Animated.Value(h))).current;

  useEffect(() => {
    if (!playing) return;
    const loops = animatedBars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: bars[i] * (0.35 + Math.random() * 0.65), duration: 380 + (i % 5) * 80, useNativeDriver: false }),
          Animated.timing(v, { toValue: bars[i], duration: 380 + (i % 7) * 60, useNativeDriver: false }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing, animatedBars, bars]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ color: c.text, fontSize: 16, textAlign: "center", fontWeight: "600" }}>
          {error ?? "Kitob topilmadi"}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: c.primary, fontSize: 14 }}>Orqaga qaytish</Text>
        </Pressable>
      </View>
    );
  }

  if (!audioData.loading && !audioData.audioUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ color: c.text, fontSize: 16, textAlign: "center", fontWeight: "600" }}>
          Bu kitob uchun audio mavjud emas
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: c.primary, fontSize: 14 }}>Orqaga qaytish</Text>
        </Pressable>
      </View>
    );
  }

  // Entitlements not resolved yet — show a neutral wait instead of the paywall,
  // otherwise a listener who already bought the book is told to buy it again.
  if (access.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <ActivityIndicator color={c.primary} />
        <Text style={{ color: c.textDim, fontSize: 14, fontWeight: "600", marginTop: 14 }}>
          Xarid holati tekshirilmoqda…
        </Text>
      </View>
    );
  }

  // Paid audio (part of the book purchase) opens only after backend access.
  const locked = !book.isFree && !access.hasAccess;
  const bookPrice = book.isFree ? 0 : paymentProduct?.amount_uzs ?? book.price;
  // Keep the paywall layout (and its payment sheet) mounted until the purchase
  // flow is fully dismissed, so the "Tabriklaymiz" success screen isn't
  // unmounted the instant backend access is granted.
  if (locked || purchaseFlow.state !== "idle") {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={{ color: c.primary, fontSize: 14, fontWeight: "700" }}>Orqaga</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <PremiumPaywallCard
            contentType="book"
            title={book.title}
            priceUzs={bookPrice}
            onBuy={() => {
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
            }}
          />
          {promo.isActive ? (
            <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
              <PromoPriceBlock
                isActive={promo.isActive}
                originalAmount={promo.pricing?.original_amount_uzs ?? bookPrice}
                finalAmount={promo.pricing?.final_amount_uzs ?? bookPrice}
                discountPercent={promo.pricing?.discount_percent ?? 0}
                promoCode={promo.appliedCode ?? ""}
                endsAt={promo.endsAt}
              />
            </View>
          ) : null}
        </View>
        <BuyConfirmSheet
          visible={showBuy}
          title={book.title}
          priceUzs={bookPrice}
          benefits={["Audio talqin", "Kitobni to'liq o'qish"]}
          onConfirm={() => {
            if (!paymentProduct) {
              setShowBuy(false);
              showMissingPaymentProductAlert();
              return;
            }
            setShowBuy(false);
            logCreateOrderDebug(paymentProduct);
            void purchaseFlow.start(createOrderInputFromPaymentProduct(paymentProduct), { promoCode: promo.appliedCode });
          }}
          onClose={() => setShowBuy(false)}
          promo={promo}
        />
        <CardPaymentSheet
          flow={purchaseFlow}
          title={book.title}
          success={{
            kind: "audio",
            onPrimary: () => {
              purchaseFlow.reset();
              if (!playing) togglePlay();
            },
            onSecondary: () => {
              purchaseFlow.reset();
              router.push("/library");
            },
          }}
          onClose={purchaseFlow.reset}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {book.cover ? (
        <Image
          source={{ uri: book.cover }}
          style={StyleSheet.absoluteFillObject}
          blurRadius={Platform.OS === "web" ? 25 : 80}
        />
      ) : null}
      <LinearGradient
        colors={isDark
          ? ["rgba(13,17,23,0.80)", "rgba(13,17,23,0.94)", "rgba(13,17,23,0.97)"] as any
          : ["rgba(255,255,255,0.78)", "rgba(255,255,255,0.94)", "rgba(240,240,240,0.96)"] as any
        }
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronDown color={c.text} size={22} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.topLabel}>HOZIR TINGLANMOQDA</Text>
          <Text style={styles.topTitle} numberOfLines={1}>{book.title}</Text>
        </View>
        <Pressable onPress={onShare} style={styles.iconBtn}>
          <Share2 color={c.text} size={18} />
        </Pressable>
      </View>

      <View style={styles.coverWrap}>
        {book.cover ? (
          <Image source={{ uri: book.cover }} style={styles.cover} contentFit="contain" />
        ) : (
          <View style={[styles.cover, { backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 48 }}>📖</Text>
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>{book.authorName}</Text>
        {(audioData.narratorName || displayDuration > 0) && (
          <View style={styles.audioMetaRow}>
            {audioData.narratorName ? (
              <View style={styles.audioMetaChip}>
                <Mic color={c.secondary} size={12} />
                <Text style={styles.audioMetaText} numberOfLines={1}>
                  {audioData.narratorName}
                </Text>
              </View>
            ) : null}
            {displayDuration > 0 ? (
              <Text style={styles.audioMetaText}>{formatTimecode(displayDuration)}</Text>
            ) : null}
          </View>
        )}
        {audioLoading && (
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>Audio yuklanmoqda...</Text>
        )}
        {audioError && (
          <Text style={{ color: "#E63946", fontSize: 12, marginTop: 4 }}>{audioError}</Text>
        )}
      </View>

      <View style={styles.waveWrap}>
        {animatedBars.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: v,
                backgroundColor: i / BAR_COUNT < progress
                  ? c.primary
                  : isDark ? "rgba(255,255,255,0.12)" : "rgba(17,17,17,0.10)",
              },
            ]}
          />
        ))}
      </View>

      <Seekbar
        value={progress}
        duration={duration}
        onScrubStart={startScrub}
        onScrubEnd={endScrub}
        c={c}
      />

      <View style={styles.controls}>
        <Pressable onPress={() => seekDelta(-15)} style={styles.sideBtn}>
          <View style={styles.skipInner}>
            <RotateCcw color={c.text} size={26} />
            <Text style={styles.skipLabel}>15</Text>
          </View>
        </Pressable>
        <PressableScale onPress={togglePlay} style={styles.playBtn}>
          {audioLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : playing ? (
            <Pause color="#fff" size={30} fill="#fff" />
          ) : (
            <Play color="#fff" size={30} fill="#fff" style={{ marginLeft: 3 }} />
          )}
        </PressableScale>
        <Pressable onPress={() => seekDelta(15)} style={styles.sideBtn}>
          <View style={styles.skipInner}>
            <RotateCw color={c.text} size={26} />
            <Text style={styles.skipLabel}>15</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.speedRow}>
        {SPEEDS.map((s) => {
          const active = speed === s;
          return (
            <Pressable key={s} onPress={() => changeSpeed(s)} style={[styles.speedChip, active && styles.speedChipActive]}>
              <Text style={[styles.speedText, active && styles.speedTextActive]}>{s}x</Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setTocOpen(true)} style={styles.tocBtn}>
          <List color={c.primary} size={15} />
          <Text style={styles.tocBtnText}>Mundarija</Text>
        </Pressable>
        <Pressable onPress={() => toggleSaveBook(book.id)} style={styles.likeBtn}>
          <Bookmark
            color={saved ? c.primary : c.textDim}
            fill={saved ? c.primary : "transparent"}
            size={18}
          />
        </Pressable>
      </View>

      <View style={[styles.bottomWrap, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable onPress={() => router.back()} style={styles.readBtn}>
          <Text style={styles.readText}>Kitobga qaytish</Text>
        </Pressable>
      </View>

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 90,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <Modal visible={tocOpen} transparent animationType="slide" onRequestClose={() => setTocOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setTocOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Audio mundarija</Text>
              <Pressable onPress={() => setTocOpen(false)} hitSlop={12} style={styles.sheetClose}>
                <X color={c.textMuted} size={20} />
              </Pressable>
            </View>
            <Text style={styles.sheetHelper}>
              Bob yoki mavzuni tanlang, audio o'sha joydan boshlanadi.
            </Text>
            {audioData.tocItems.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                <AudioTocList
                  items={audioData.tocItems}
                  activeId={activeTocId}
                  onSelect={handleSelectToc}
                  c={c}
                  isDark={isDark}
                />
              </ScrollView>
            ) : (
              <View style={styles.tocEmpty}>
                <List color={c.textMuted} size={30} />
                <Text style={styles.tocEmptyText}>
                  Bu audio uchun mundarija hali qo'shilmagan.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Seekbar({
  value,
  duration,
  onScrubStart,
  onScrubEnd,
  c,
}: {
  value: number;
  duration: number;
  onScrubStart: () => void;
  onScrubEnd: (ratio: number) => void;
  c: AppTheme;
}) {
  const trackRef = useRef<View>(null);
  const trackPageX = useRef(0);
  const trackWidth = useRef(SCREEN_W - 56);
  const dragRatioRef = useRef<number | null>(null);
  const onScrubStartRef = useRef(onScrubStart);
  const onScrubEndRef = useRef(onScrubEnd);
  onScrubStartRef.current = onScrubStart;
  onScrubEndRef.current = onScrubEnd;

  const [dragRatio, setDragRatioState] = useState<number | null>(null);

  const setDragRatio = (r: number | null) => {
    dragRatioRef.current = r;
    setDragRatioState(r);
  };

  const clamp = useRef((pageX: number) =>
    Math.max(0, Math.min(1, (pageX - trackPageX.current) / trackWidth.current))
  ).current;

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      if (w > 0) { trackPageX.current = x; trackWidth.current = w; }
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => { onScrubStartRef.current(); setDragRatio(clamp(e.nativeEvent.pageX)); },
      onPanResponderMove: (e) => { setDragRatio(clamp(e.nativeEvent.pageX)); },
      onPanResponderRelease: (e) => { const r = clamp(e.nativeEvent.pageX); setDragRatio(null); onScrubEndRef.current(r); },
      onPanResponderTerminate: () => { const r = dragRatioRef.current ?? 0; setDragRatio(null); onScrubEndRef.current(r); },
    })
  ).current;

  const shown = dragRatio ?? value;
  const fillW = shown * trackWidth.current;

  return (
    <View style={{ paddingHorizontal: 28, marginTop: 10 }}>
      <View
        ref={trackRef}
        style={{ height: 44, justifyContent: "center" }}
        onLayout={measureTrack}
        {...pan.panHandlers}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.border, overflow: "hidden" }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.primary, width: fillW }} />
        </View>
        <View
          style={{
            position: "absolute",
            top: 14,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: "#fff",
            borderWidth: 2.5,
            borderColor: c.primary,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
            left: Math.max(0, fillW - 9),
          }}
        />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>{fmt(shown * duration)}</Text>
        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "600" }}>
          -{fmt(duration - shown * duration)}
        </Text>
      </View>
    </View>
  );
}

function fmt(s: number): string {
  const total = Math.max(0, Math.floor(s));
  const m = Math.floor(total / 60);
  const sec = (total % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? c.bgCard : "rgba(255,255,255,0.82)",
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    topLabel: { color: c.primary, fontSize: 9, letterSpacing: 2.5, fontWeight: "800" },
    topTitle: { color: c.text, fontSize: 13, fontWeight: "700", marginTop: 2, maxWidth: SCREEN_W * 0.55 },
    coverWrap: { alignItems: "center", marginTop: 18 },
    cover: {
      width: 200,
      height: 280,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      shadowColor: "#000",
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
    },
    meta: { alignItems: "center", paddingHorizontal: 30, marginTop: 20 },
    title: { color: c.text, fontFamily: FONT.serif, fontSize: 24, fontWeight: "700", marginTop: 8, letterSpacing: -0.4, textAlign: "center" },
    author: { color: c.secondary, fontSize: 13, marginTop: 4 },
    audioMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    audioMetaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: SCREEN_W * 0.5,
    },
    audioMetaText: { color: c.textDim, fontSize: 12, fontWeight: "600" },
    waveWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 28,
      height: 52,
      marginTop: 18,
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.44)",
      marginHorizontal: 18,
      borderRadius: 22,
    },
    bar: { width: 3, borderRadius: 2, marginHorizontal: 1 },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 30,
      marginTop: 20,
      gap: 34,
    },
    sideBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
    skipInner: { alignItems: "center", justifyContent: "center" },
    skipLabel: { position: "absolute", color: c.text, fontSize: 9, fontWeight: "800", marginTop: 1 },
    playBtn: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primary,
      shadowOpacity: 0.5,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
      elevation: 14,
    },
    speedRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 28, marginTop: 24, gap: 8 },
    speedChip: {
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    speedChipActive: { backgroundColor: c.soft, borderColor: c.primary },
    speedText: { color: c.textDim, fontSize: 12, fontWeight: "700" },
    speedTextActive: { color: c.primary },
    tocBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: c.soft,
      borderWidth: 1,
      borderColor: c.primary,
    },
    tocBtnText: { color: c.primary, fontSize: 12, fontWeight: "700" },
    likeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    toast: {
      position: "absolute",
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 22,
      backgroundColor: isDark ? "rgba(28,33,40,0.96)" : "rgba(17,17,17,0.92)",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    toastText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "76%",
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: 12,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sheetTitle: { color: c.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
    sheetClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    sheetHelper: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginBottom: 14 },
    tocEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },
    tocEmptyText: { color: c.textMuted, fontSize: 14, fontWeight: "500", textAlign: "center", paddingHorizontal: 30, lineHeight: 20 },
    bottomWrap: { marginTop: "auto" as any, paddingHorizontal: 24, paddingTop: 14 },
    readBtn: {
      height: 52,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    readText: { color: c.textDim, fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  });
}
