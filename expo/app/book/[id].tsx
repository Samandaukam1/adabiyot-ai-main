import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Headphones,
  Share2,
  Shield,
  Star,
  Users,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { books, getAuthor, getBook, getBookRoute, getPublisher, type Author, type Book } from "@/mocks/content";
import { useApp } from "@/providers/AppProvider";
import { usePublishedBook } from "@/hooks/usePublishedBooks";
import { type DisplayBook, publisherTypeLabel } from "@/types/database";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_COVER_W = Math.min(198, Math.round(SCREEN_W * 0.48));
const LAVHA_CARD_W = Math.round(SCREEN_W * 0.74);
const LAVHA_CARD_H = Math.min(250, Math.round(SCREEN_W * 0.66));
const REVIEW_CARD_W = Math.round(SCREEN_W * 0.78);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const MOCK_REVIEWS = [
  {
    id: "r1",
    name: "Kamola Yusupova",
    avatar: "https://i.pravatar.cc/80?img=47",
    rating: 5,
    text: "Hayotimda o'qigan eng yaxshi kitoblardan biri. Har bir sahifa qalbimga yetdi.",
  },
  {
    id: "r2",
    name: "Jasur Mirzayev",
    avatar: "https://i.pravatar.cc/80?img=12",
    rating: 4,
    text: "Uslub juda chiroyli, syujet oxirigacha qiziqarli. Barchaga tavsiya qilaman!",
  },
  {
    id: "r3",
    name: "Nilufar Rashidova",
    avatar: "https://i.pravatar.cc/80?img=56",
    rating: 5,
    text: "Muallif inson psixologiyasini nihoyatda nozik tasvirlagan. Zo'r asar.",
  },
];

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const mockBook = useMemo(() => getBook(String(id)), [id]);
  const { book: supabaseBook, loading: supabaseLoading } = usePublishedBook(
    mockBook ? "" : String(id ?? "")
  );
  const { savedBookIds, purchasedBookIds, toggleSaveBook } = useApp();
  const ctaGlowAnim = useRef(new Animated.Value(0)).current;
  const stickyAnim = useRef(new Animated.Value(0)).current;
  const stickyVisibleRef = useRef(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [excerptVisible, setExcerptVisible] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [ctaLayout, setCtaLayout] = useState<{ y: number; height: number } | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ctaGlowAnim, {
        toValue: 1,
        duration: 7200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [ctaGlowAnim]);

  const ctaGlowRotation = ctaGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  useEffect(() => {
    Animated.timing(stickyAnim, {
      toValue: stickyVisible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [stickyAnim, stickyVisible]);

  const stickyOpacity = stickyAnim;
  const stickyTranslateY = stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [34, 0] });
  const stickyScale = stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!ctaLayout) return;

      const scrollY = event.nativeEvent.contentOffset.y;
      const ctaBottom = ctaLayout.y + ctaLayout.height;
      const ctaNearTopExit = scrollY > ctaLayout.y - 12;
      const ctaAboveViewport = ctaBottom < scrollY;
      const ctaStillBelowFirstViewport = ctaLayout.y > scrollY + SCREEN_H - 120;
      const shouldShow = (ctaNearTopExit || ctaAboveViewport) && !ctaStillBelowFirstViewport;

      if (shouldShow !== stickyVisibleRef.current) {
        stickyVisibleRef.current = shouldShow;
        setStickyVisible(shouldShow);
      }
    },
    [ctaLayout]
  );

  if (!mockBook) {
    if (supabaseLoading) {
      return (
        <Screen>
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={palette.text} size={20} />
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={palette.primary} size="large" />
          </View>
        </Screen>
      );
    }
    if (supabaseBook) {
      return <SupabaseBookDetail book={supabaseBook} insets={insets} />;
    }
    return (
      <Screen>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
        </View>
        <Text style={{ color: palette.text, padding: 40 }}>
          Bu material hali Adabiyot AI Kompaniyasi tomonidan tasdiqlanmagan.
        </Text>
      </Screen>
    );
  }
  const book = mockBook;

  if (book.category === "Ssenariy") {
    return <Redirect href={`/screenplay/${book.id}`} />;
  }

  const author = getAuthor(book.authorId);
  const publisher = getPublisher(book.publisherId);
  const sameCategory = books.filter((b) => b.category === book.category && b.id !== book.id);
  const fallback = books.filter((b) => b.id !== book.id && b.category !== book.category);
  const related = [...sameCategory, ...fallback].slice(0, 5);
  const saved = savedBookIds.includes(book.id);
  const purchased = purchasedBookIds.includes(book.id) || book.free;
  const totalReaders = deriveTotalReaders(book, author);
  const audioDuration = deriveAudioDuration(book);
  const ageRating = deriveAgeRating(book);
  const bookPrice = book.free ? 0 : book.price;
  const audioPrice = book.audioAvailable ? deriveAudioPrice(book) : 0;
  const bundlePrice = deriveBundlePrice(bookPrice, audioPrice);
  const originalBundlePrice = bookPrice + audioPrice;

  const statItems = [
    {
      key: "rating",
      icon: <Star color={palette.primary} size={15} fill={palette.primary} />,
      text: `${book.rating.toFixed(1)} Reyting`,
      highlight: true,
    },
    {
      key: "duration",
      icon: <Headphones color={palette.primary} size={15} />,
      text: audioDuration ?? "Audio yo'q",
    },
    {
      key: "readers",
      icon: <Users color={palette.primary} size={15} />,
      text: `${formatCompactCount(totalReaders)} o'qilish`,
    },
    {
      key: "publisher",
      icon: <BookOpen color={palette.primary} size={15} />,
      text: publisher?.name ? `Nashr: ${publisher.name}` : "Nashriyot",
    },
    {
      key: "age",
      icon: <Shield color={palette.primary} size={15} />,
      text: ageRating,
    },
    {
      key: "audio",
      icon: <Headphones color={palette.primary} size={15} />,
      text: book.audioAvailable ? "Audio mavjud" : "Audio yo'q",
    },
  ];
  const hasLongDescription = book.description.length > 140;
  const openReader = () => {
    router.push(book.category === "She'r" ? `/poem/${book.id}` : `/book-reader/${book.id}`);
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 170 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: book.cover }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 20 : 40}
          />
          <LinearGradient
            colors={["rgba(245,241,234,0.82)", "rgba(245,241,234,0.95)", palette.bg]}
            style={StyleSheet.absoluteFillObject}
            locations={[0, 0.6, 1]}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={palette.text} size={20} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={styles.iconBtn}><Share2 color={palette.text} size={18} /></Pressable>
              <Pressable onPress={() => toggleSaveBook(book.id)} style={styles.iconBtn}>
                <Bookmark color={saved ? palette.gold : palette.text} fill={saved ? palette.gold : "transparent"} size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroInner}>
            <Image source={{ uri: book.cover }} style={styles.cover} contentFit="contain" />
            <View style={styles.category}>
              <Text style={styles.categoryText}>{book.category.toUpperCase()}</Text>
            </View>
            <Text style={styles.title}>{book.title}</Text>
            <View style={styles.byline}>
              <Pressable onPress={() => router.push(`/author/${book.authorId}`)}>
                <Text style={styles.author}>{author?.name}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <StatBar items={statItems} />

        {!purchased ? (
          <PurchaseOptions
            bookPrice={bookPrice}
            audioPrice={audioPrice}
            bundlePrice={bundlePrice}
            originalBundlePrice={originalBundlePrice}
            audioAvailable={book.audioAvailable}
          />
        ) : null}

        {/* CTA Buttons */}
        <View
          style={styles.actionsRow}
          onLayout={(event) =>
            setCtaLayout({
              y: event.nativeEvent.layout.y,
              height: event.nativeEvent.layout.height,
            })
          }
        >
          <CtaButton
            label="O'qishni boshlash"
            icon={<BookOpen color="#FFFFFF" size={18} />}
            backgroundColor={palette.primary}
            glowColors={["rgba(46,125,50,0.45)", "rgba(214,168,79,0.40)", "rgba(46,125,50,0.18)"]}
            shadowColor={palette.primary}
            rotation={ctaGlowRotation}
            onPress={openReader}
          />

          {book.audioAvailable ? (
            <CtaButton
              label="Audio tinglash"
              icon={<Headphones color="#FFFFFF" size={18} />}
              backgroundColor="#2563EB"
              glowColors={["rgba(37,99,235,0.45)", "rgba(214,168,79,0.40)", "rgba(37,99,235,0.16)"]}
              shadowColor="#2563EB"
              rotation={ctaGlowRotation}
              onPress={() => router.push(`/audio/${book.id}`)}
            />
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Kitob haqida</Text>
        <View style={styles.shortDescBox}>
          <Text style={styles.shortDescText} numberOfLines={descriptionExpanded ? undefined : 3}>
            {book.description}
          </Text>
          {hasLongDescription ? (
            <Pressable onPress={() => setDescriptionExpanded((value) => !value)} hitSlop={8}>
              <Text style={styles.readMoreText}>{descriptionExpanded ? "Yopish" : "Batafsil"}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Parcha</Text>
        <View style={styles.previewActions}>
          <PressableScale onPress={() => setExcerptVisible((value) => !value)} style={styles.previewBtn}>
            <BookOpen color={palette.primary} size={19} />
            <Text style={styles.previewBtnText}>Matn parchasi</Text>
          </PressableScale>
          <PressableScale
            onPress={() => {
              if (book.audioAvailable) router.push(`/audio/${book.id}`);
            }}
            style={[styles.previewBtn, book.audioAvailable ? {} : styles.previewBtnDisabled]}
          >
            <Headphones color={palette.primary} size={19} />
            <Text style={styles.previewBtnText}>{book.audioAvailable ? "Audio parchasi" : "Audio yo'q"}</Text>
          </PressableScale>
        </View>
        {excerptVisible ? (
          <View style={styles.excerptBox}>
            <Text style={styles.excerptText} numberOfLines={5}>{book.excerpt}</Text>
          </View>
        ) : null}

        <SectionHeader title="Kitobdan lavhalar" action="Barchasi" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={LAVHA_CARD_W + 14}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        >
          {[book, ...related.slice(0, 3)].map((item, i) => (
            <LavhaCard
              key={item.id + i}
              imageUri={item.cover}
              quote={item.excerpt}
            />
          ))}
        </ScrollView>

        <SectionHeader title="O'quvchilar fikri" action="Barchasi" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={REVIEW_CARD_W + 14}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
        >
          {MOCK_REVIEWS.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Image source={{ uri: review.avatar }} style={styles.reviewAvatar} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.reviewName}>{review.name}</Text>
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 3 }}>
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={i} color={palette.primary} fill={palette.primary} size={12} />
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.reviewText} numberOfLines={2}>{review.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Muallif */}
        {author && (
          <>
            <Text style={styles.sectionTitle}>Muallif</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <Image source={{ uri: author.photo }} style={styles.authorPhoto} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.authorName}>{author.name}</Text>
                  <Text style={styles.authorMeta}>{author.works.length} asar · {formatCompactCount(author.followers)} obunachilar</Text>
                </View>
              </View>
              <Text style={styles.authorBio} numberOfLines={2}>{author.bio}</Text>
              <PressableScale onPress={() => router.push(`/author/${book.authorId}`)} style={styles.infoCardBtn}>
                <Text style={styles.infoCardBtnText}>Muallif sahifasi</Text>
              </PressableScale>
            </View>
          </>
        )}

        {/* Nashriyot */}
        {publisher && (
          <>
            <Text style={styles.sectionTitle}>Nashriyot</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <Image source={{ uri: publisher.logo }} style={styles.pubLogo} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.pubName}>{publisher.name}</Text>
                </View>
              </View>
              <Text style={styles.pubAbout} numberOfLines={2}>{publisher.about}</Text>
              <PressableScale onPress={() => router.push(`/publisher/${book.publisherId}`)} style={styles.infoCardBtn}>
                <Text style={styles.infoCardBtnText}>Nashriyotni ko'rish</Text>
              </PressableScale>
            </View>
          </>
        )}

        {related.length > 0 ? (
          <>
            <SectionHeader title="Shunga o'xshash" action="Barchasi" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
              {related.map((r) => {
                const a = getAuthor(r.authorId);
                return (
                  <PressableScale
                    key={r.id}
                    onPress={() => router.replace(getBookRoute(r))}
                    style={styles.relatedItem}
                  >
                    <Image source={{ uri: r.cover }} style={styles.relatedCover} contentFit="cover" />
                    <Text style={styles.relatedTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.relatedAuthor} numberOfLines={1}>
                      {a?.name}
                    </Text>
                    <View style={styles.relatedRating}>
                      <Star color={palette.gold} fill={palette.gold} size={11} />
                      <Text style={styles.relatedRatingText}>{r.rating.toFixed(1)}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
      <StickyReadingCta
        visible={stickyVisible}
        opacity={stickyOpacity}
        translateY={stickyTranslateY}
        scale={stickyScale}
        bottomInset={insets.bottom}
        rotation={ctaGlowRotation}
        pulse={ctaGlowAnim}
        onPress={openReader}
      />
    </Screen>
  );
}

function StatBar({
  items,
}: {
  items: {
    key: string;
    icon: React.ReactNode;
    text: string;
    highlight?: boolean;
  }[];
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statBar}
    >
      {items.map((item) => (
        <View key={item.key} style={[styles.statChip, item.highlight && styles.statChipHighlight]}>
          {item.icon}
          <Text style={[styles.statChipText, item.highlight && styles.statChipTextHighlight]} numberOfLines={1}>
            {item.text}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function PurchaseOptions({
  bookPrice,
  audioPrice,
  bundlePrice,
  originalBundlePrice,
  audioAvailable,
}: {
  bookPrice: number;
  audioPrice: number;
  bundlePrice: number;
  originalBundlePrice: number;
  audioAvailable: boolean;
}) {
  return (
    <View style={styles.purchaseBlock}>
      <View style={styles.purchaseRow}>
        <PurchaseOption
          icon={<BookOpen color={palette.primary} size={18} />}
          title="Kitobni xarid qilish"
          price={bookPrice}
        />
        {audioAvailable ? (
          <PurchaseOption
            icon={<Headphones color={palette.primary} size={18} />}
            title="Audio xarid qilish"
            price={audioPrice}
          />
        ) : null}
      </View>
      {audioAvailable ? (
        <View style={styles.bundleOption}>
          <View style={styles.bundleIconRow}>
            <BookOpen color={palette.primary} size={18} />
            <Text style={styles.bundlePlus}>+</Text>
            <Headphones color={palette.primary} size={18} />
          </View>
          <View style={styles.bundleTextWrap}>
            <Text style={styles.purchaseTitle}>Tejamkor xarid</Text>
            <Text style={styles.purchaseSub}>Kitob + audio birga</Text>
          </View>
          <View style={styles.bundlePriceWrap}>
            <Text style={styles.purchasePrice}>{formatPrice(bundlePrice)}</Text>
            <Text style={styles.oldPrice}>{formatPrice(originalBundlePrice)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PurchaseOption({
  icon,
  title,
  price,
}: {
  icon: React.ReactNode;
  title: string;
  price: number;
}) {
  return (
    <View style={styles.purchaseOption}>
      <View style={styles.purchaseIcon}>{icon}</View>
      <Text style={styles.purchaseTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.purchasePrice}>{formatPrice(price)}</Text>
    </View>
  );
}

function CtaButton({
  label,
  icon,
  backgroundColor,
  glowColors,
  shadowColor,
  rotation,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  backgroundColor: string;
  glowColors: [string, string, string];
  shadowColor: string;
  rotation: Animated.AnimatedInterpolation<string>;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    Animated.timing(scale, {
      toValue: 0.98,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const pressOut = useCallback(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.ctaEqualWrap, { transform: [{ scale }] }]}>
      <View style={styles.ctaGlowClip}>
        <AnimatedLinearGradient
          colors={glowColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ctaRotatingGlow, { transform: [{ rotate: rotation }] }]}
        />
      </View>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.ctaButton,
          {
            backgroundColor,
            shadowColor,
          },
        ]}
      >
        {icon}
        <Text style={styles.ctaButtonText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function StickyReadingCta({
  visible,
  opacity,
  translateY,
  scale,
  bottomInset,
  rotation,
  pulse,
  onPress,
}: {
  visible: boolean;
  opacity: Animated.Value;
  translateY: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
  bottomInset: number;
  rotation: Animated.AnimatedInterpolation<string>;
  pulse: Animated.Value;
  onPress: () => void;
}) {
  const textOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.82, 1, 0.82],
  });

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.stickyCtaWrap,
        {
          paddingBottom: bottomInset + 10,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={["rgba(245,241,234,0)", "rgba(46,125,50,0.18)", "rgba(46,125,50,0.23)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <AnimatedLinearGradient
        colors={["rgba(129,199,132,0)", "rgba(129,199,132,0.18)", "rgba(214,168,79,0.10)", "rgba(129,199,132,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.stickyMovingGlow, { transform: [{ rotate: rotation }] }]}
      />
      <PressableScale onPress={onPress} style={styles.stickyButton}>
        <BookOpen color={palette.primary} size={19} />
        <Animated.Text style={[styles.stickyButtonText, { opacity: textOpacity }]}>
          Varaqlab ko'ramizmi?
        </Animated.Text>
      </PressableScale>
    </Animated.View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitleInline}>{title}</Text>
      {action ? (
        <Pressable hitSlop={10}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LavhaCard({ imageUri, quote }: { imageUri: string; quote: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.lavhaCard, { transform: [{ scale }] }]}>
        <Image source={{ uri: imageUri }} style={styles.lavhaCardImg} contentFit="cover" />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          style={styles.lavhaOverlay}
          locations={[0, 1]}
        />
        <View style={styles.lavhaQuote}>
          <Text style={styles.lavhaQuoteText} numberOfLines={3}>
            {quote}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return value.toString();
}

function formatPrice(value: number): string {
  if (value <= 0) return "Bepul";
  return `${value.toLocaleString()} so'm`;
}

function deriveAudioPrice(book: Book): number {
  if (!book.audioAvailable) return 0;
  const base = Math.round((book.price * 0.62) / 1000) * 1000;
  return Math.max(8_000, Math.min(18_000, base));
}

function deriveBundlePrice(bookPrice: number, audioPrice: number): number {
  if (bookPrice <= 0) return audioPrice;
  if (audioPrice <= 0) return bookPrice;
  return Math.round(((bookPrice + audioPrice) * 0.82) / 1000) * 1000;
}

function formatAudioDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} soat ${minutes} daq`;
  }
  if (hours > 0) {
    return `${hours} soat`;
  }
  return `${minutes} daq`;
}

function deriveAudioDuration(book: Book): string | null {
  if (!book.audioAvailable) return null;

  const bookIndex = Number.parseInt(book.id.replace("b", ""), 10) || 1;
  const baseMinutesByCategory: Record<Book["category"], number> = {
    Hikoya: 135,
    Roman: 180,
    "She'r": 105,
    "Qo'llanma": 160,
    Darslik: 190,
    Ertak: 95,
    Ssenariy: 125,
    Qissa: 195,
  };

  const totalMinutes =
    baseMinutesByCategory[book.category] + bookIndex * 7 + (book.trending ? 15 : 0);

  return formatAudioDuration(totalMinutes);
}

function deriveAgeRating(book: Book): string {
  switch (book.category) {
    case "Ertak":
      return "6+";
    case "She'r":
    case "Hikoya":
      return "12+";
    case "Roman":
    case "Qissa":
      return "16+";
    default:
      return "12+";
  }
}

function deriveTotalReaders(book: Book, author?: Author): number {
  if (!author) return 0;

  const scale = 0.08 + (book.trending ? 0.03 : 0) + (book.free ? 0.02 : 0);
  return Math.max(18_000, Math.round((author.reads * scale) / 1000) * 1000);
}

const supaStyles = StyleSheet.create({
  pubTypeBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pubTypeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  noContentBox: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.10)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noContentText: {
    color: "#888",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
});

function SupabaseBookDetail({
  book,
  insets,
}: {
  book: DisplayBook;
  insets: { top: number; bottom: number };
}) {
  const ctaGlowAnim = useRef(new Animated.Value(0)).current;
  const [descExpanded, setDescExpanded] = useState(false);
  const hasAudio = !!book.audioUrl;
  const hasLongDesc = book.description.length > 140;
  const audioPrice = Math.max(8_000, Math.round((book.price * 0.62) / 1_000) * 1_000);

  // A Supabase book always has at minimum an ID — let the reader figure out
  // whether content blocks exist. This avoids hiding readable books just because
  // has_internal_reader flag wasn't set by the admin.
  const hasRichContent = book.hasInternalReader || !!book.cleanedContent;
  const hasFile = !!book.fileUrl || !!book.pdfUrl;
  const canRead = hasRichContent || hasFile || book.source === "supabase";

  const openReader = useCallback(() => {
    console.log("📘 OPEN READER CLICKED:", {
      bookId: book.id,
      title: book.title,
      status: book.status,
      has_internal_reader: book.hasInternalReader,
      content_mode: book.contentMode,
      cleanedContent: !!book.cleanedContent,
      fileUrl: book.fileUrl,
      pdfUrl: book.pdfUrl,
      source: book.source,
    });

    if (hasRichContent || (!hasFile && book.source === "supabase")) {
      console.log("📘 Routing to rich-reader:", `/rich-reader/${book.id}`);
      router.push(`/rich-reader/${book.id}`);
    } else if (hasFile) {
      console.log("📘 Routing to book-reader (file):", `/book-reader/${book.id}`);
      router.push(`/book-reader/${book.id}`);
    } else {
      console.warn("⚠️ openReader: no readable content found for book", book.id);
    }
  }, [book, hasRichContent, hasFile]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ctaGlowAnim, {
        toValue: 1,
        duration: 7200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [ctaGlowAnim]);

  const ctaGlowRotation = ctaGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: book.cover }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 20 : 40}
          />
          <LinearGradient
            colors={["rgba(245,241,234,0.82)", "rgba(245,241,234,0.95)", palette.bg]}
            style={StyleSheet.absoluteFillObject}
            locations={[0, 0.6, 1]}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={palette.text} size={20} />
            </Pressable>
          </View>
          <View style={styles.heroInner}>
            <Image source={{ uri: book.cover }} style={styles.cover} contentFit="contain" />
            <View style={styles.category}>
              <Text style={styles.categoryText}>{book.genre.toUpperCase()}</Text>
            </View>
            <Text style={styles.title}>{book.title}</Text>
            <View style={styles.byline}>
              <Text style={styles.author}>{book.authorName}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {canRead ? (
            <CtaButton
              label="O'qishni boshlash"
              icon={<BookOpen color="#FFFFFF" size={18} />}
              backgroundColor={palette.primary}
              glowColors={["rgba(46,125,50,0.45)", "rgba(214,168,79,0.40)", "rgba(46,125,50,0.18)"]}
              shadowColor={palette.primary}
              rotation={ctaGlowRotation}
              onPress={openReader}
            />
          ) : (
            <View style={supaStyles.noContentBox}>
              <Text style={supaStyles.noContentText}>
                Bu kitob uchun o'qish materiali hali yuklanmagan.
              </Text>
            </View>
          )}
          {hasAudio && (
            <CtaButton
              label="Audio tinglash"
              icon={<Headphones color="#FFFFFF" size={18} />}
              backgroundColor="#2563EB"
              glowColors={["rgba(37,99,235,0.45)", "rgba(214,168,79,0.40)", "rgba(37,99,235,0.16)"]}
              shadowColor="#2563EB"
              rotation={ctaGlowRotation}
              onPress={() => router.push(`/audio/${book.id}`)}
            />
          )}
        </View>

        {!book.isFree && (
          <View style={[styles.purchaseBlock, { marginTop: 14 }]}>
            <View style={styles.purchaseRow}>
              <PurchaseOption
                icon={<BookOpen color={palette.primary} size={18} />}
                title="Kitobni xarid qilish"
                price={book.price}
              />
              {hasAudio && (
                <PurchaseOption
                  icon={<Headphones color={palette.primary} size={18} />}
                  title="Audio xarid qilish"
                  price={audioPrice}
                />
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Kitob haqida</Text>
        <View style={styles.shortDescBox}>
          <Text
            style={styles.shortDescText}
            numberOfLines={descExpanded ? undefined : 3}
          >
            {book.description || "Tavsif mavjud emas."}
          </Text>
          {hasLongDesc && (
            <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={8}>
              <Text style={styles.readMoreText}>
                {descExpanded ? "Yopish" : "Batafsil"}
              </Text>
            </Pressable>
          )}
        </View>

        {(book.authorName || book.publisherName) && (
          <>
            <Text style={styles.sectionTitle}>Muallif</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName}>{book.authorName}</Text>
                  {book.publisherName ? (
                    <Text style={styles.authorMeta}>{book.publisherName}</Text>
                  ) : null}
                  {publisherTypeLabel(book.publisherType) && (() => {
                    const pt = publisherTypeLabel(book.publisherType)!;
                    return (
                      <View style={[supaStyles.pubTypeBadge, { backgroundColor: pt.bg }]}>
                        <Text style={[supaStyles.pubTypeBadgeText, { color: pt.color }]}>
                          {pt.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroWrap: { paddingBottom: 12, minHeight: 430 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    zIndex: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  heroInner: { alignItems: "center", paddingHorizontal: 26, marginTop: 14 },
  cover: {
    width: HERO_COVER_W,
    aspectRatio: 5 / 7,
    borderRadius: 14,
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
  category: {
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFF4D6",
    borderWidth: 1,
    borderColor: "#D6A84F",
  },
  categoryText: { color: "#A87500", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: {
    color: palette.text,
    fontSize: 27,
    lineHeight: 32,
    fontFamily: FONT.serif,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    letterSpacing: -0.3,
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 6,
  },
  author: { color: palette.primary, fontSize: 14, fontWeight: "700" },
  bylineDot: { color: palette.textMuted, fontSize: 13, fontWeight: "600" },
  publisherInline: { color: palette.textMuted, fontSize: 13, fontWeight: "500" },
  statBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingRight: 28,
    gap: 8,
    marginTop: 8,
  },
  statChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.09)",
  },
  statChipHighlight: {
    backgroundColor: "rgba(232,245,233,0.82)",
  },
  statChipText: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "500",
  },
  statChipTextHighlight: {
    color: palette.primary,
    fontWeight: "600",
  },
  purchaseBlock: {
    marginHorizontal: 20,
    marginTop: 14,
    gap: 10,
  },
  purchaseRow: {
    flexDirection: "row",
    gap: 10,
  },
  purchaseOption: {
    flex: 1,
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.10)",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  purchaseIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
    marginBottom: 8,
  },
  purchaseTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
  },
  purchaseSub: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  purchasePrice: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  bundleOption: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "rgba(232,245,233,0.84)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.13)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bundleIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  bundlePlus: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  bundleTextWrap: { flex: 1 },
  bundlePriceWrap: {
    alignItems: "flex-end",
  },
  oldPrice: {
    color: palette.textMuted,
    fontSize: 11,
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  actionsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginTop: 16 },
  ctaEqualWrap: {
    flex: 1,
    height: 56,
    position: "relative",
  },
  ctaGlowClip: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 22,
    overflow: "hidden",
    opacity: 0.72,
  },
  ctaRotatingGlow: {
    position: "absolute",
    width: "150%",
    height: "190%",
    top: "-45%",
    left: "-25%",
  },
  ctaButton: {
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  ctaButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600", letterSpacing: 0.1 },
  stickyCtaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 108,
    paddingTop: 22,
    paddingHorizontal: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 12,
  },
  stickyMovingGlow: {
    position: "absolute",
    width: "150%",
    height: 160,
    left: "-25%",
    bottom: -76,
    opacity: 0.55,
  },
  stickyButton: {
    height: 56,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  stickyButtonText: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  buyBtn: {
    marginHorizontal: 20,
    marginTop: 10,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1.2,
    borderColor: "rgba(46,125,50,0.25)",
  },
  buyText: { color: palette.text, fontSize: 14, fontWeight: "800" },
  shortDescBox: {
    marginHorizontal: 20,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  shortDescText: {
    color: "#444",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  readMoreText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  previewActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
  },
  previewBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  previewBtnDisabled: {
    opacity: 0.55,
  },
  previewBtnText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "600",
  },
  lavhaCard: {
    width: LAVHA_CARD_W,
    height: LAVHA_CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 4,
  },
  lavhaCardImg: {
    width: "100%",
    height: "100%",
  },
  lavhaOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "58%",
  },
  lavhaQuote: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  lavhaQuoteText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontFamily: FONT.serif,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reviewCard: {
    width: REVIEW_CARD_W,
    minHeight: 132,
    padding: 15,
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewName: { color: palette.text, fontSize: 14, fontWeight: "800" },
  reviewText: { color: "#444", fontSize: 13, lineHeight: 19 },
  authorMeta: { color: palette.secondary, fontSize: 12, fontWeight: "700", marginTop: 3 },
  infoCard: {
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 3,
  },
  infoCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  infoCardBtn: {
    marginTop: 12,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "rgba(46,125,50,0.25)",
    backgroundColor: "transparent",
  },
  infoCardBtnText: { color: palette.primary, fontSize: 13, fontWeight: "800" },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleInline: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionAction: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  excerptBox: {
    marginHorizontal: 20,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: palette.bgCard,
    borderLeftWidth: 3,
    borderLeftColor: palette.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  excerptText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
    fontFamily: FONT.serif,
  },
  authorPhoto: { width: 48, height: 48, borderRadius: 24 },
  authorName: { color: palette.text, fontSize: 15, fontWeight: "800" },
  authorBio: { color: "#444", fontSize: 13, lineHeight: 19 },
  pubLogo: { width: 44, height: 44, borderRadius: 12 },
  pubName: { color: palette.text, fontSize: 15, fontWeight: "800" },
  pubAbout: { color: "#444", fontSize: 13, lineHeight: 19 },
  relatedItem: {
    width: 116,
    paddingBottom: 4,
  },
  relatedCover: {
    width: 116,
    height: 166,
    borderRadius: 10,
    backgroundColor: palette.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  relatedTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  relatedAuthor: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  relatedRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  relatedRatingText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "800",
  },
});
