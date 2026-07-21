import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  BookOpen,
  Feather,
  Headphones,
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
import type { AppTheme } from "@/constants/colors";
import { FONT, PressableScale, Screen } from "@/components/ui";
import { books, getAuthor, getBook, getBookRoute, getPublisher, type Author, type Book } from "@/mocks/content";
import { usePublishedBook } from "@/hooks/usePublishedBooks";
import RatingReviewBlock from "@/components/RatingReviewBlock";
import BookCover from "@/components/BookCover";
import ContentHeaderActions from "@/components/ContentHeaderActions";
import JaxongirAskBar from "@/components/JaxongirAskBar";
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
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthGate } from "@/providers/AuthGateProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { type DisplayBook, publisherTypeLabel } from "@/types/database";
import WebBookHero, { type WebBookHeroChip } from "@/components/web/WebBookHero";
import { getApplicationCtaLabel, mapContentTypeToApplicationType } from "@/utils/applicationCta";

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
  const { isAuthenticated } = useAuth();
  const { promptLogin } = useAuthGate();
  const access = useContentAccess("book", mockBook?.id);
  const purchaseFlow = usePurchaseFlow();
  const paymentProductQuery = usePaymentProduct("book", mockBook?.id);
  const paymentProduct = paymentProductQuery.data ?? null;
  const promo = usePromo({
    contentType: paymentProduct?.content_type ?? "book",
    contentId: paymentProduct?.content_id ?? mockBook?.id,
    productId: paymentProduct?.id,
  });
  const [showBuy, setShowBuy] = useState(false);
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isWebLayout } = useResponsive();

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
              <ArrowLeft color={c.text} size={20} />
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={c.primary} size="large" />
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
            <ArrowLeft color={c.text} size={20} />
          </Pressable>
        </View>
        <Text style={{ color: c.text, padding: 40 }}>
          Bu material hali AdabiyotX tomonidan tasdiqlanmagan.
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
  const purchased = book.free || access.hasAccess;
  const totalReaders = deriveTotalReaders(book, author);
  const audioDuration = deriveAudioDuration(book);
  const ageRating = deriveAgeRating(book);
  // One combined price covers the e-book AND its audio narration — audio is
  // never sold (or priced) separately.
  const bookPrice = book.free ? 0 : paymentProduct?.amount_uzs ?? book.price;

  const statItems = [
    {
      key: "rating",
      icon: <Star color={c.primary} size={15} fill={c.primary} />,
      text: `${book.rating.toFixed(1)} Reyting`,
      highlight: true,
    },
    {
      key: "duration",
      icon: <Headphones color={c.primary} size={15} />,
      text: audioDuration ?? "Audio yo'q",
    },
    {
      key: "readers",
      icon: <Users color={c.primary} size={15} />,
      text: `${formatCompactCount(totalReaders)} o'qilish`,
    },
    {
      key: "publisher",
      icon: <BookOpen color={c.primary} size={15} />,
      text: publisher?.name ? `Nashr: ${publisher.name}` : "Nashriyot",
    },
    {
      key: "age",
      icon: <Shield color={c.primary} size={15} />,
      text: ageRating,
    },
    {
      key: "audio",
      icon: <Headphones color={c.primary} size={15} />,
      text: book.audioAvailable ? "Audio mavjud" : "Audio yo'q",
    },
  ];
  const hasLongDescription = book.description.length > 140;
  const openBuy = () => {
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
  const openReader = () => {
    // Poems gate themselves (1/4 preview for paid, full for owned/free).
    if (book.category === "She'r") {
      router.push(`/poem/${book.id}`);
      return;
    }
    // Mock file books have no in-reader paywall, so keep the purchase gate.
    if (!purchased) {
      openBuy();
      return;
    }
    router.push(`/book-reader/${book.id}`);
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 170 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {isWebLayout ? (
          <WebBookHero
            cover={book.cover}
            category={book.category}
            title={book.title}
            author={author?.name}
            onAuthorPress={() => router.push(`/author/${book.authorId}`)}
            description={book.description}
            chips={statItems as WebBookHeroChip[]}
            primaryLabel={book.category === "She'r" ? "She'rni o'qish" : "E-adabiyot"}
            onPrimary={openReader}
            audioLabel={book.audioAvailable ? "Audio talqin" : null}
            onAudio={
              book.audioAvailable
                ? purchased
                  ? () => router.push(`/audio/${book.id}`)
                  : openBuy
                : undefined
            }
            priceLabel={!purchased && !book.free ? formatPrice(bookPrice) : null}
            onAiPress={() => router.push(`/book-ai/${book.id}`)}
            onBack={() => router.back()}
            headerActions={
              <ContentHeaderActions
                contentType="book"
                contentId={book.id}
                title={book.title}
                author={author?.name}
                cover={book.cover}
                description={book.description}
                c={c}
                isDark={isDark}
              />
            }
          />
        ) : (
          <>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: book.cover }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 20 : 40}
          />
          <LinearGradient
            colors={isDark
              ? ["rgba(13,17,23,0.55)", "rgba(13,17,23,0.90)", c.bg] as any
              : ["rgba(245,241,234,0.82)", "rgba(245,241,234,0.95)", c.bg] as any
            }
            style={StyleSheet.absoluteFillObject}
            locations={[0, 0.6, 1]}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={c.text} size={20} />
            </Pressable>
            <HeaderArizaButton
              label={getApplicationCtaLabel(book.category)}
              onPress={() =>
                router.push({
                  pathname: "/author-application",
                  params: { content_type: mapContentTypeToApplicationType(book.category) },
                })
              }
              styles={styles}
              c={c}
            />
            <ContentHeaderActions
              contentType="book"
              contentId={book.id}
              title={book.title}
              author={author?.name}
              cover={book.cover}
              description={book.description}
              c={c}
              isDark={isDark}
            />
          </View>

          <View style={styles.heroInner}>
            <BookCover uri={book.cover} width={HERO_COVER_W} radius={14} size="large" />
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

        <StatBar items={statItems} styles={styles} c={c} />

        {promo.isActive && !purchased && !book.free ? (
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
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

        {!purchased ? (
          <PressableScale onPress={openBuy}>
            <CombinedPriceCard
              price={bookPrice}
              audioAvailable={book.audioAvailable}
              styles={styles}
              c={c}
            />
          </PressableScale>
        ) : null}

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
            label="E-adabiyot"
            icon="book-open-page-variant"
            gradient={["#11998E", "#38EF7D"]}
            shadowColor="#11998E"
            onPress={openReader}
            styles={styles}
          />

          {book.audioAvailable ? (
            <CtaButton
              label="Audio talqin"
              icon="headphones"
              gradient={["#3B6FF7", "#22D3EE"]}
              shadowColor="#3B6FF7"
              onPress={purchased ? () => router.push(`/audio/${book.id}`) : openBuy}
              styles={styles}
            />
          ) : null}
        </View>

        <JaxongirAskBar onPress={() => router.push(`/book-ai/${book.id}`)} />
          </>
        )}

        <View style={isWebLayout ? styles.webBelow : undefined}>
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

        <PublishCtaCard contentType={book.category} styles={styles} />

        <Text style={styles.sectionTitle}>Parcha</Text>
        <View style={styles.previewActions}>
          <PressableScale onPress={() => setExcerptVisible((value) => !value)} style={styles.previewBtn}>
            <BookOpen color={c.primary} size={19} />
            <Text style={styles.previewBtnText}>Matn parchasi</Text>
          </PressableScale>
          <PressableScale
            onPress={() => {
              if (book.audioAvailable) router.push(`/audio/${book.id}`);
            }}
            style={[styles.previewBtn, book.audioAvailable ? {} : styles.previewBtnDisabled]}
          >
            <Headphones color={c.primary} size={19} />
            <Text style={styles.previewBtnText}>{book.audioAvailable ? "Audio parchasi" : "Audio yo'q"}</Text>
          </PressableScale>
        </View>
        {excerptVisible ? (
          <View style={styles.excerptBox}>
            <Text style={styles.excerptText} numberOfLines={5}>{book.excerpt}</Text>
          </View>
        ) : null}

        <SectionHeader title="Kitobdan lavhalar" action="Barchasi" styles={styles} c={c} />
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
              styles={styles}
            />
          ))}
        </ScrollView>

        <SectionHeader title="O'quvchilar fikri" action="Barchasi" styles={styles} c={c} />
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
                      <Star key={i} color={c.primary} fill={c.primary} size={12} />
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.reviewText} numberOfLines={2}>{review.text}</Text>
            </View>
          ))}
        </ScrollView>

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
            <SectionHeader title="Shunga o'xshash" action="Barchasi" styles={styles} c={c} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
              {related.map((r) => {
                const a = getAuthor(r.authorId);
                return (
                  <PressableScale
                    key={r.id}
                    onPress={() => router.replace(getBookRoute(r))}
                    style={styles.relatedItem}
                  >
                    <BookCover uri={r.cover} width={116} radius={10} />
                    <Text style={styles.relatedTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.relatedAuthor} numberOfLines={1}>{a?.name}</Text>
                    <View style={styles.relatedRating}>
                      <Star color={c.gold} fill={c.gold} size={11} />
                      <Text style={styles.relatedRatingText}>{r.rating.toFixed(1)}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </>
        ) : null}
        </View>
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
        styles={styles}
        c={c}
        isDark={isDark}
      />
      <BuyConfirmSheet
        visible={showBuy}
        title={book.title}
        priceUzs={bookPrice}
        benefits={["Kitobni to'liq o'qish", book.audioAvailable ? "Audio talqin" : "Doimiy kirish huquqi"]}
        onConfirm={confirmBuy}
        onClose={() => setShowBuy(false)}
        promo={promo}
      />
      <CardPaymentSheet
        flow={purchaseFlow}
        title={book.title}
        success={{
          kind: "content",
          onPrimary: () => {
            purchaseFlow.reset();
            openReader();
          },
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

/**
 * A single wide, white header button that invites the reader to publish their own
 * work. Its text is typed out like on a keyboard, cycling through a few phrases
 * (the content-specific "Menda ham roman bor", then "Siz ham asaringizni chop
 * eting", then "Ariza qoldiring"), and a soft green light sweeps around its rim
 * with a pulsing glow shadow. Tapping opens the application form pre-selected.
 */
function HeaderArizaButton({
  label,
  onPress,
  styles,
  c,
}: {
  label: string;
  onPress: () => void;
  styles: StylesType;
  c: AppTheme;
}) {
  const phrases = useMemo(
    () => [label, "Siz ham asaringizni chop eting", "Ariza qoldiring"],
    [label]
  );
  const [display, setDisplay] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Typewriter: type → hold → erase → next phrase → repeat.
  useEffect(() => {
    const full = phrases[phraseIdx % phrases.length];
    if (!deleting && display === full) {
      const t = setTimeout(() => setDeleting(true), 1600);
      return () => clearTimeout(t);
    }
    if (deleting && display === "") {
      const t = setTimeout(() => {
        setDeleting(false);
        setPhraseIdx((i) => (i + 1) % phrases.length);
      }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () =>
        setDisplay((d) => (deleting ? full.slice(0, d.length - 1) : full.slice(0, d.length + 1))),
      deleting ? 34 : 62
    );
    return () => clearTimeout(t);
  }, [display, deleting, phraseIdx, phrases]);

  // Rotating light sweep + pulsing glow shadow + blinking caret.
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const caret = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const s = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true })
    );
    const g = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    );
    const cc = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 480, useNativeDriver: true }),
        Animated.timing(caret, { toValue: 1, duration: 480, useNativeDriver: true }),
      ])
    );
    s.start();
    g.start();
    cc.start();
    return () => {
      s.stop();
      g.stop();
      cc.stop();
    };
  }, [spin, glow, caret]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [4, 13] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  return (
    <Animated.View style={[styles.arizaShadow, { shadowRadius, shadowOpacity }]}>
      <View style={styles.arizaFrame}>
        <AnimatedLinearGradient
          colors={[
            "rgba(82,183,136,0)",
            "rgba(82,183,136,0.9)",
            "rgba(56,239,125,0.15)",
            "rgba(82,183,136,0.9)",
            "rgba(82,183,136,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.arizaSweep, { transform: [{ rotate }] }]}
          pointerEvents="none"
        />
        <Pressable onPress={onPress} style={styles.headerArizaBtn} hitSlop={6} accessibilityLabel="Ariza qoldirish">
          <Feather color={c.primary} size={15} strokeWidth={2.2} />
          <Text style={styles.headerArizaText} numberOfLines={1}>
            {display}
          </Text>
          <Animated.Text style={[styles.headerArizaCaret, { opacity: caret }]}>|</Animated.Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * "Menda ham … bor" — invites the reader to publish their own work of the same
 * kind. The label adapts to the content type and tapping opens the application
 * form pre-selected to that content_type.
 */
function PublishCtaCard({
  contentType,
  styles,
}: {
  contentType?: string;
  styles: StylesType;
}) {
  const label = getApplicationCtaLabel(contentType);
  return (
    <View style={styles.publishCard}>
      <Text style={styles.publishTitle}>Siz ham ijodkormisiz?</Text>
      <Text style={styles.publishSub}>
        Asaringizni AdabiyotX platformasida chop ettiring — ariza qoldiring.
      </Text>
      <PressableScale
        onPress={() =>
          router.push({
            pathname: "/author-application",
            params: { content_type: mapContentTypeToApplicationType(contentType) },
          })
        }
        style={styles.publishBtn}
      >
        <LinearGradient
          colors={["#11998E", "#38EF7D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.publishBtnInner}
        >
          <MaterialCommunityIcons name="feather" size={17} color="#fff" />
          <Text style={styles.publishBtnText}>{label}</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

function StatBar({
  items,
  styles,
  c,
}: {
  items: { key: string; icon: React.ReactNode; text: string; highlight?: boolean }[];
  styles: StylesType;
  c: AppTheme;
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

/**
 * Single combined price for the e-book + (when present) its audio narration.
 * Audio is bundled into the one purchase — never shown as a separate price.
 */
function CombinedPriceCard({
  price,
  audioAvailable,
  styles,
  c,
}: {
  price: number;
  audioAvailable: boolean;
  styles: StylesType;
  c: AppTheme;
}) {
  return (
    <View style={styles.purchaseBlock}>
      <View style={styles.bundleOption}>
        <View style={styles.bundleIconRow}>
          <BookOpen color={c.primary} size={18} />
          {audioAvailable ? (
            <>
              <Text style={styles.bundlePlus}>+</Text>
              <Headphones color={c.primary} size={18} />
            </>
          ) : null}
        </View>
        <View style={styles.bundleTextWrap}>
          <Text style={styles.purchaseTitle}>
            {audioAvailable ? "E-adabiyot + audio talqin" : "E-adabiyot"}
          </Text>
          <Text style={styles.purchaseSub}>
            {audioAvailable ? "Bitta xarid — o'qish va tinglash" : "To'liq asarni o'qish"}
          </Text>
        </View>
        <View style={styles.bundlePriceWrap}>
          <Text style={styles.purchasePrice}>{formatPrice(price)}</Text>
        </View>
      </View>
    </View>
  );
}

function CtaButton({
  label,
  icon,
  gradient,
  shadowColor,
  onPress,
  styles,
}: {
  label: string;
  icon: string;
  gradient: [string, string];
  shadowColor: string;
  onPress: () => void;
  styles: StylesType;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    Animated.timing(scale, { toValue: 0.97, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [scale]);

  const pressOut = useCallback(() => {
    Animated.timing(scale, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.ctaEqualWrap, { transform: [{ scale }], shadowColor }]}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={styles.ctaPressable}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaButton}>
          <View style={styles.ctaIconCircle}>
            <MaterialCommunityIcons name={icon as any} size={18} color="#fff" />
          </View>
          <Text
            style={styles.ctaButtonText}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {label}
          </Text>
        </LinearGradient>
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
  styles,
  c,
  isDark,
}: {
  visible: boolean;
  opacity: Animated.Value;
  translateY: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
  bottomInset: number;
  rotation: Animated.AnimatedInterpolation<string>;
  pulse: Animated.Value;
  onPress: () => void;
  styles: StylesType;
  c: AppTheme;
  isDark: boolean;
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
      <BlurView intensity={24} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={isDark
          ? ["rgba(13,17,23,0)", "rgba(46,125,50,0.15)", "rgba(46,125,50,0.20)"] as any
          : ["rgba(245,241,234,0)", "rgba(46,125,50,0.18)", "rgba(46,125,50,0.23)"] as any
        }
        style={StyleSheet.absoluteFillObject}
      />
      <AnimatedLinearGradient
        colors={["rgba(129,199,132,0)", "rgba(129,199,132,0.18)", "rgba(214,168,79,0.10)", "rgba(129,199,132,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.stickyMovingGlow, { transform: [{ rotate: rotation }] }]}
      />
      <PressableScale onPress={onPress} style={styles.stickyButton}>
        <BookOpen color={c.primary} size={19} />
        <Animated.Text style={[styles.stickyButtonText, { opacity: textOpacity }]}>
          Varaqlab ko'ramizmi?
        </Animated.Text>
      </PressableScale>
    </Animated.View>
  );
}

function SectionHeader({ title, action, styles, c }: { title: string; action?: string; styles: StylesType; c: AppTheme }) {
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

function LavhaCard({ imageUri, quote, styles }: { imageUri: string; quote: string; styles: StylesType }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

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
          <Text style={styles.lavhaQuoteText} numberOfLines={3}>{quote}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return value.toString();
}

function formatPrice(value: number): string {
  if (value <= 0) return "Bepul";
  return `${value.toLocaleString()} so'm`;
}

function formatAudioDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} soat ${minutes} daq`;
  if (hours > 0) return `${hours} soat`;
  return `${minutes} daq`;
}

function deriveAudioDuration(book: Book): string | null {
  if (!book.audioAvailable) return null;
  const bookIndex = Number.parseInt(book.id.replace("b", ""), 10) || 1;
  const baseMinutesByCategory: Record<Book["category"], number> = {
    Hikoya: 135, Roman: 180, "She'r": 105, "Qo'llanma": 160,
    Darslik: 190, Ertak: 95, Ssenariy: 125, Qissa: 195,
  };
  const totalMinutes = baseMinutesByCategory[book.category] + bookIndex * 7 + (book.trending ? 15 : 0);
  return formatAudioDuration(totalMinutes);
}

function deriveAgeRating(book: Book): string {
  switch (book.category) {
    case "Ertak": return "6+";
    case "She'r": case "Hikoya": return "12+";
    case "Roman": case "Qissa": return "16+";
    default: return "12+";
  }
}

function deriveAgeFromGenre(genre: string): string {
  const g = (genre || "").toLowerCase();
  if (g.includes("ertak") || g.includes("bola")) return "6+";
  if (g.includes("she'r") || g.includes("sher") || g.includes("hikoya")) return "12+";
  if (g.includes("roman") || g.includes("qissa")) return "16+";
  return "12+";
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
  pubTypeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
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
  noContentText: { color: "#888", fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 18 },
});

function SupabaseBookDetail({
  book,
  insets,
}: {
  book: DisplayBook;
  insets: { top: number; bottom: number };
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  const { isWebLayout } = useResponsive();
  const { isAuthenticated } = useAuth();
  const { promptLogin } = useAuthGate();
  const access = useContentAccess("book", book.id, { isFree: book.isFree });
  const purchaseFlow = usePurchaseFlow();
  const paymentProductQuery = usePaymentProduct("book", book.id);
  const paymentProduct = paymentProductQuery.data ?? null;
  const promo = usePromo({
    contentType: paymentProduct?.content_type ?? "book",
    contentId: paymentProduct?.content_id ?? book.id,
    productId: paymentProduct?.id,
  });
  const [showBuy, setShowBuy] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const hasAudio = !!book.audioUrl;
  const hasLongDesc = book.description.length > 140;
  const hasRichContent = book.hasInternalReader || !!book.cleanedContent;

  // ── "Varaqlab ko'ramizmi?" sticky CTA (appears on scroll) ───────────────
  const ctaGlowAnim = useRef(new Animated.Value(0)).current;
  const stickyAnim = useRef(new Animated.Value(0)).current;
  const stickyVisibleRef = useRef(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [ctaLayout, setCtaLayout] = useState<{ y: number; height: number } | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ctaGlowAnim, { toValue: 1, duration: 7200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [ctaGlowAnim]);
  const ctaGlowRotation = ctaGlowAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  useEffect(() => {
    Animated.timing(stickyAnim, {
      toValue: stickyVisible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [stickyAnim, stickyVisible]);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!ctaLayout) return;
      const scrollY = event.nativeEvent.contentOffset.y;
      const ctaBottom = ctaLayout.y + ctaLayout.height;
      const shouldShow =
        (scrollY > ctaLayout.y - 12 || ctaBottom < scrollY) &&
        ctaLayout.y <= scrollY + SCREEN_H - 120;
      if (shouldShow !== stickyVisibleRef.current) {
        stickyVisibleRef.current = shouldShow;
        setStickyVisible(shouldShow);
      }
    },
    [ctaLayout]
  );
  const hasFile = !!book.fileUrl || !!book.pdfUrl;
  const isPoem = book.genre === "She'r" || book.contentMode === "poem";
  const canRead = hasRichContent || hasFile || book.source === "supabase";
  const purchased = book.isFree || access.hasAccess;
  // Entitlements still in flight — we must not claim the book is unpurchased yet.
  const checkingAccess = access.isLoading;
  const bookPrice = book.isFree ? 0 : paymentProduct?.amount_uzs ?? book.price;
  const openBuy = useCallback(() => {
    if (!isAuthenticated) {
      promptLogin();
      return;
    }
    if (checkingAccess) return;
    if (paymentProductQuery.isLoading || paymentProductQuery.isFetching) return;
    if (!paymentProduct) {
      showMissingPaymentProductAlert();
      return;
    }
    setShowBuy(true);
  }, [isAuthenticated, checkingAccess, paymentProduct, paymentProductQuery.isFetching, paymentProductQuery.isLoading, promptLogin]);
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

  const supaStatItems = [
    { key: "genre", icon: <BookOpen color={c.primary} size={15} />, text: book.genre || "Kitob", highlight: true },
    { key: "age", icon: <Shield color={c.primary} size={15} />, text: deriveAgeFromGenre(book.genre) },
    { key: "publisher", icon: <Users color={c.primary} size={15} />, text: book.publisherName ? `Nashr: ${book.publisherName}` : "Nashriyot" },
    { key: "audio", icon: <Headphones color={c.primary} size={15} />, text: hasAudio ? "Audio mavjud" : "Audio yo'q" },
    { key: "price", icon: <Star color={c.primary} size={15} fill={c.primary} />, text: book.isFree ? "Bepul" : formatPrice(bookPrice) },
  ];

  const openReader = useCallback(() => {
    if (isPoem) {
      router.push(`/poem/${book.id}`);
    } else if (hasRichContent || (!hasFile && book.source === "supabase")) {
      router.push(`/rich-reader/${book.id}`);
    } else if (hasFile) {
      router.push(`/book-reader/${book.id}`);
    }
  }, [book, hasRichContent, hasFile, isPoem]);

  // The poem + rich-text readers show a 1/4 "parcha" preview themselves, so we
  // can open them straight away. File (PDF) books have no in-reader paywall, so
  // those still require a purchase first.
  const canPreviewInReader = isPoem || hasRichContent || (!hasFile && book.source === "supabase");
  const openReaderOrBuy = useCallback(() => {
    if (canPreviewInReader || purchased) openReader();
    else openBuy();
  }, [canPreviewInReader, purchased, openReader, openBuy]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 170 }}
      >
        {isWebLayout ? (
          <WebBookHero
            cover={book.cover}
            category={book.genre}
            title={book.title}
            author={book.authorName}
            description={book.description}
            chips={supaStatItems as WebBookHeroChip[]}
            primaryLabel={canRead ? (isPoem ? "She'rni o'qish" : "E-adabiyot") : "Tez kunda"}
            onPrimary={canRead ? openReaderOrBuy : () => {}}
            audioLabel={hasAudio ? "Audio talqin" : null}
            onAudio={hasAudio ? (purchased ? () => router.push(`/audio/${book.id}`) : openBuy) : undefined}
            priceLabel={null}
            onAiPress={() => router.push(`/book-ai/${book.id}`)}
            onBack={() => router.back()}
            headerActions={
              <ContentHeaderActions
                contentType="book"
                contentId={book.id}
                title={book.title}
                author={book.authorName}
                cover={book.cover}
                description={book.description}
                c={c}
                isDark={isDark}
              />
            }
          />
        ) : (
          <>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: book.cover }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 20 : 40}
          />
          <LinearGradient
            colors={isDark
              ? ["rgba(13,17,23,0.55)", "rgba(13,17,23,0.90)", c.bg] as any
              : ["rgba(245,241,234,0.82)", "rgba(245,241,234,0.95)", c.bg] as any
            }
            style={StyleSheet.absoluteFillObject}
            locations={[0, 0.6, 1]}
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ArrowLeft color={c.text} size={20} />
            </Pressable>
            <HeaderArizaButton
              label={getApplicationCtaLabel(book.genre)}
              onPress={() =>
                router.push({
                  pathname: "/author-application",
                  params: { content_type: mapContentTypeToApplicationType(book.genre) },
                })
              }
              styles={styles}
              c={c}
            />
            <ContentHeaderActions
              contentType="book"
              contentId={book.id}
              title={book.title}
              author={book.authorName}
              cover={book.cover}
              description={book.description}
              c={c}
              isDark={isDark}
            />
          </View>
          <View style={styles.heroInner}>
            <BookCover uri={book.cover} width={HERO_COVER_W} radius={14} size="large" />
            <View style={styles.category}>
              <Text style={styles.categoryText}>{book.genre.toUpperCase()}</Text>
            </View>
            <Text style={styles.title}>{book.title}</Text>
            <View style={styles.byline}>
              <Text
                style={styles.author}
                onPress={() => {
                  const target = book.authorId ?? book.authorProfileId ?? book.authorName;
                  if (target) router.push(`/author/${encodeURIComponent(target)}` as never);
                }}
              >
                {book.authorName}
              </Text>
            </View>
          </View>
        </View>

        <StatBar items={supaStatItems} styles={styles} c={c} />

        <View
          style={styles.actionsRow}
          onLayout={(event) =>
            setCtaLayout({ y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height })
          }
        >
          {canRead ? (
            <CtaButton
              label={
                checkingAccess
                  ? "Tekshirilmoqda…"
                  : purchased
                  ? "O'qishni davom ettirish"
                  : isPoem
                  ? "She'rni o'qish"
                  : "E-adabiyot"
              }
              icon={checkingAccess ? "progress-clock" : "book-open-page-variant"}
              gradient={checkingAccess ? ["#94A3B8", "#CBD5E1"] : ["#11998E", "#38EF7D"]}
              shadowColor={checkingAccess ? "#94A3B8" : "#11998E"}
              onPress={checkingAccess ? () => {} : openReaderOrBuy}
              styles={styles}
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
              label={
                checkingAccess
                  ? "Tekshirilmoqda…"
                  : purchased
                  ? "Tinglashni davom ettirish"
                  : "Audio talqin"
              }
              icon={checkingAccess ? "progress-clock" : "headphones"}
              gradient={checkingAccess ? ["#94A3B8", "#CBD5E1"] : ["#3B6FF7", "#22D3EE"]}
              shadowColor={checkingAccess ? "#94A3B8" : "#3B6FF7"}
              onPress={
                checkingAccess
                  ? () => {}
                  : purchased
                  ? () => router.push(`/audio/${book.id}`)
                  : openBuy
              }
              styles={styles}
            />
          )}
        </View>

        <JaxongirAskBar onPress={() => router.push(`/book-ai/${book.id}`)} />

        {promo.isActive && !purchased && !book.isFree && !checkingAccess ? (
          <View style={{ marginTop: 14 }}>
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

        {/* The buy card appears only once access is settled — a user who already
            owns the book must never be asked to pay for it again. */}
        {!book.isFree && checkingAccess ? (
          <View style={[supaStyles.noContentBox, { marginTop: 14 }]}>
            <Text style={supaStyles.noContentText}>Xarid holati tekshirilmoqda…</Text>
          </View>
        ) : null}
        {!book.isFree && !purchased && !checkingAccess && (
          <PressableScale onPress={openBuy} style={{ marginTop: 14 }}>
            <CombinedPriceCard price={bookPrice} audioAvailable={hasAudio} styles={styles} c={c} />
          </PressableScale>
        )}
          </>
        )}

        <View style={isWebLayout ? styles.webBelow : undefined}>
        <Text style={styles.sectionTitle}>Kitob haqida</Text>
        <View style={styles.shortDescBox}>
          <Text style={styles.shortDescText} numberOfLines={descExpanded ? undefined : 3}>
            {book.description || "Tavsif mavjud emas."}
          </Text>
          {hasLongDesc && (
            <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={8}>
              <Text style={styles.readMoreText}>{descExpanded ? "Yopish" : "Batafsil"}</Text>
            </Pressable>
          )}
        </View>

        <PublishCtaCard contentType={book.genre} styles={styles} />

        {(book.authorName || book.publisherName) && (
          <>
            <Text style={styles.sectionTitle}>Muallif</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.authorName}
                    onPress={() => {
                      const target = book.authorId ?? book.authorProfileId ?? book.authorName;
                      if (target) router.push(`/author/${encodeURIComponent(target)}` as never);
                    }}
                  >
                    {book.authorName}
                  </Text>
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
        <RatingReviewBlock
          contentType="book"
          contentId={book.id}
          title={book.title}
          author={book.authorName}
          coverUrl={book.cover}
        />
        </View>
      </ScrollView>
      {canRead ? (
        <StickyReadingCta
          visible={stickyVisible}
          opacity={stickyAnim}
          translateY={stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [34, 0] })}
          scale={stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] })}
          bottomInset={insets.bottom}
          rotation={ctaGlowRotation}
          pulse={ctaGlowAnim}
          onPress={openReaderOrBuy}
          styles={styles}
          c={c}
          isDark={isDark}
        />
      ) : null}
      <BuyConfirmSheet
        visible={showBuy}
        title={book.title}
        priceUzs={bookPrice}
        benefits={["Kitobni to'liq o'qish", hasAudio ? "Audio talqin" : "Doimiy kirish huquqi"]}
        onConfirm={confirmBuy}
        onClose={() => setShowBuy(false)}
        promo={promo}
      />
      <CardPaymentSheet
        flow={purchaseFlow}
        title={book.title}
        success={{
          kind: "content",
          onPrimary: () => {
            purchaseFlow.reset();
            openReader();
          },
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

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    heroWrap: { paddingBottom: 12, minHeight: 430 },
    // On web the descriptive sections below the cinematic hero are centred to a
    // comfortable reading column instead of stretching edge-to-edge.
    webBelow: { width: "100%", maxWidth: 1100, alignSelf: "center", marginTop: 10 },
    publishCard: {
      marginHorizontal: 20,
      marginTop: 22,
      padding: 18,
      borderRadius: 20,
      backgroundColor: isDark ? "rgba(82,183,136,0.08)" : "rgba(82,183,136,0.06)",
      borderWidth: 1,
      borderColor: "rgba(82,183,136,0.28)",
    },
    publishTitle: { color: c.text, fontSize: 16, fontWeight: "800", fontFamily: FONT.serif },
    publishSub: { color: c.textDim, fontSize: 13, lineHeight: 19, marginTop: 6, fontWeight: "500" },
    publishBtn: { marginTop: 14, borderRadius: 14, overflow: "hidden" },
    publishBtnInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 50,
      borderRadius: 14,
    },
    publishBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
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
      backgroundColor: isDark ? "rgba(28,33,40,0.92)" : "rgba(255,255,255,0.92)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    // Outer layer only carries the pulsing green glow shadow (needs a shape to
    // cast from, hence the tinted background that the frame fully covers).
    arizaShadow: {
      flex: 1,
      marginHorizontal: 10,
      height: 40,
      borderRadius: 22,
      backgroundColor: isDark ? "rgba(82,183,136,0.30)" : "rgba(82,183,136,0.38)",
      shadowColor: "#52B788",
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    // Clips the rotating light sweep into the pill; the 2px padding leaves a
    // glowing animated rim around the white button.
    arizaFrame: {
      flex: 1,
      borderRadius: 22,
      overflow: "hidden",
      padding: 2,
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(82,183,136,0.30)" : "rgba(82,183,136,0.38)",
    },
    arizaSweep: {
      position: "absolute",
      width: 340,
      height: 340,
      top: "50%",
      left: "50%",
      marginTop: -170,
      marginLeft: -170,
    },
    headerArizaBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 20,
      paddingHorizontal: 12,
      backgroundColor: isDark ? "rgba(28,33,40,0.96)" : "rgba(255,255,255,0.97)",
    },
    headerArizaText: { color: c.primary, fontSize: 13, fontWeight: "800", flexShrink: 1 },
    headerArizaCaret: { color: c.primary, fontSize: 14, fontWeight: "700", marginLeft: -2 },
    heroInner: { alignItems: "center", paddingHorizontal: 26, marginTop: 14 },
    cover: {
      width: HERO_COVER_W,
      aspectRatio: 5 / 7,
      borderRadius: 14,
      backgroundColor: c.bgCard,
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
      backgroundColor: isDark ? "rgba(244,162,97,0.15)" : "#FFF4D6",
      borderWidth: 1,
      borderColor: isDark ? "rgba(244,162,97,0.35)" : "#D6A84F",
    },
    categoryText: { color: isDark ? "#F4A261" : "#A87500", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
    title: {
      color: c.text,
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
    author: { color: c.primary, fontSize: 14, fontWeight: "700" },
    bylineDot: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
    publisherInline: { color: c.textMuted, fontSize: 13, fontWeight: "500" },
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
      backgroundColor: isDark ? c.bgCard : "rgba(255,255,255,0.78)",
      borderWidth: 1,
      borderColor: c.border,
    },
    statChipHighlight: {
      backgroundColor: isDark ? "rgba(82,183,136,0.12)" : "rgba(232,245,233,0.82)",
    },
    statChipText: {
      color: c.textDim,
      fontSize: 12,
      fontWeight: "500",
    },
    statChipTextHighlight: {
      color: c.primary,
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
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
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
      backgroundColor: c.soft,
      marginBottom: 8,
    },
    purchaseTitle: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    purchaseSub: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    purchasePrice: {
      color: c.primary,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },
    bundleOption: {
      minHeight: 64,
      borderRadius: 18,
      backgroundColor: c.soft,
      borderWidth: 1,
      borderColor: c.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    bundleIconRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    bundlePlus: { color: c.primary, fontSize: 13, fontWeight: "700" },
    bundleTextWrap: { flex: 1 },
    bundlePriceWrap: { alignItems: "flex-end" },
    oldPrice: {
      color: c.textMuted,
      fontSize: 11,
      textDecorationLine: "line-through",
      marginTop: 2,
    },
    actionsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginTop: 16 },
    // Two of these sit side by side (each flex:1), so on a 390pt screen a button
    // is only ~169pt wide. Labels like "Tinglashni davom ettirish" need to wrap
    // to two lines inside that: the icon must never shrink, the text must never
    // push the icon out, hence flexShrink on one and not the other.
    ctaEqualWrap: {
      flex: 1,
      height: 60,
      borderRadius: 20,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.32,
      shadowRadius: 13,
      elevation: 6,
    },
    ctaPressable: { flex: 1, borderRadius: 20, overflow: "hidden" },
    ctaButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 11,
    },
    ctaIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      flexShrink: 0,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    ctaButtonText: {
      flexShrink: 1,
      color: "#FFFFFF",
      fontSize: 14,
      lineHeight: 17,
      fontWeight: "800",
      letterSpacing: 0.1,
    },
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
      backgroundColor: c.bgCard,
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
      color: c.primary,
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
      borderColor: c.borderStrong,
    },
    buyText: { color: c.text, fontSize: 14, fontWeight: "800" },
    shortDescBox: {
      marginHorizontal: 20,
      paddingHorizontal: 15,
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.045,
      shadowRadius: 12,
      elevation: 2,
    },
    shortDescText: {
      color: c.textDim,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "500",
    },
    readMoreText: {
      color: c.primary,
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
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
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
    previewBtnDisabled: { opacity: 0.55 },
    previewBtnText: {
      color: c.text,
      fontSize: 14,
      fontWeight: "600",
    },
    lavhaCard: {
      width: LAVHA_CARD_W,
      height: LAVHA_CARD_H,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: c.bgCard,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.09,
      shadowRadius: 14,
      elevation: 4,
    },
    lavhaCardImg: { width: "100%", height: "100%" },
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
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.055,
      shadowRadius: 12,
      elevation: 3,
    },
    reviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
    reviewAvatar: { width: 40, height: 40, borderRadius: 20 },
    reviewName: { color: c.text, fontSize: 14, fontWeight: "800" },
    reviewText: { color: c.textDim, fontSize: 13, lineHeight: 19 },
    authorMeta: { color: c.secondary, fontSize: 12, fontWeight: "700", marginTop: 3 },
    infoCard: {
      marginHorizontal: 20,
      padding: 14,
      borderRadius: 18,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.055,
      shadowRadius: 12,
      elevation: 3,
    },
    infoCardRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
    infoCardBtn: {
      marginTop: 12,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.2,
      borderColor: c.borderStrong,
      backgroundColor: "transparent",
    },
    infoCardBtnText: { color: c.primary, fontSize: 13, fontWeight: "800" },
    sectionHeader: {
      paddingHorizontal: 20,
      marginTop: 22,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitleInline: { color: c.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
    sectionAction: { color: c.primary, fontSize: 13, fontWeight: "800" },
    sectionTitle: {
      color: c.text,
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
      backgroundColor: c.bgCard,
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.045,
      shadowRadius: 12,
      elevation: 2,
    },
    excerptText: {
      color: c.text,
      fontSize: 14,
      lineHeight: 22,
      fontStyle: "italic",
      fontFamily: FONT.serif,
    },
    authorPhoto: { width: 48, height: 48, borderRadius: 24 },
    authorName: { color: c.text, fontSize: 15, fontWeight: "800" },
    authorBio: { color: c.textDim, fontSize: 13, lineHeight: 19 },
    pubLogo: { width: 44, height: 44, borderRadius: 12 },
    pubName: { color: c.text, fontSize: 15, fontWeight: "800" },
    pubAbout: { color: c.textDim, fontSize: 13, lineHeight: 19 },
    relatedItem: { width: 116, paddingBottom: 4 },
    relatedCover: {
      width: 116,
      height: 166,
      borderRadius: 10,
      backgroundColor: c.bgCard,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    relatedTitle: { color: c.text, fontSize: 13, fontWeight: "800", marginTop: 8 },
    relatedAuthor: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    relatedRating: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    relatedRatingText: { color: c.gold, fontSize: 11, fontWeight: "800" },
  });
}
