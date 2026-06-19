import { Image } from "expo-image";
import { router } from "expo-router";
import {
  BookOpen,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Quote,
  Send,
  Share2,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@/constants/colors";
import { FONT, PressableScale } from "@/components/ui";
import { authors, books, getAuthor, getBookRoute } from "@/mocks/content";

const { width: SCREEN_W } = Dimensions.get("window");

type PostType = "thought" | "quote" | "review" | "discussion";

interface Post {
  id: string;
  authorId: string;
  type: PostType;
  text: string;
  bookId?: string;
  bookTitle?: string;
  likes: number;
  comments: number;
  ts: number;
  liked?: boolean;
}

const SAMPLE_POSTS: Post[] = [
  {
    id: "p1",
    authorId: "a1",
    type: "quote",
    text: "\"Tun yarmida shahar uxlar, faqat men uyg'oqman. Derazadan tushayotgan chiroq nuri xonami oltin rangga bo'yaydi.\"",
    bookId: "b1",
    bookTitle: "Sukunat Ovozi",
    likes: 342,
    comments: 28,
    ts: Date.now() - 1000 * 60 * 14,
  },
  {
    id: "p2",
    authorId: "a2",
    type: "thought",
    text: "Kitob o'qish — bu o'zingga qaytish. Har bir sahifa seni birozgina o'zingga yaqinlashtiradi.",
    likes: 517,
    comments: 43,
    ts: Date.now() - 1000 * 60 * 47,
  },
  {
    id: "p3",
    authorId: "a5",
    type: "review",
    text: "\"Shaharda Yolg'iz\" — bu faqat she'rlar to'plami emas. Bu zamonaviy shaharda yashayotgan har bir inson hissiyotining oyinasi. Sardor Rashidov tilni o'z qo'liga olib, undan tasvirlar to'qiydi.",
    bookId: "b2",
    bookTitle: "Shaharda Yolg'iz",
    likes: 289,
    comments: 61,
    ts: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "p4",
    authorId: "a4",
    type: "discussion",
    text: "Savol: Qaysi o'zbek romanini ingliz tiliga tarjima qilinishini xohlaysiz? Menga ko'ra, \"Qora Daryo\" jahon adabiyotiga munosib.",
    likes: 196,
    comments: 88,
    ts: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "p5",
    authorId: "a3",
    type: "quote",
    text: "\"Yurak tilida gapiring, tushunmasalar ham, bir kuni eshitadilar.\"",
    bookId: "b8",
    bookTitle: "Yurak Tilida",
    likes: 1204,
    comments: 132,
    ts: Date.now() - 1000 * 60 * 60 * 9,
  },
  {
    id: "p6",
    authorId: "a2",
    type: "thought",
    text: "Kuz kelib, men yana she'r yoza boshladim. Qish — roman, bahor — hikoya, yoz — tanaffus. Kuz esa har doim she'rga to'la.",
    likes: 437,
    comments: 55,
    ts: Date.now() - 1000 * 60 * 60 * 14,
  },
  {
    id: "p7",
    authorId: "a1",
    type: "review",
    text: "Bolalar adabiyotini past sanash noto'g'ri. Malika Yusupovaning \"Oy Bolasi\" — oddiy va chuqur asar. Kattalar ham o'qisin.",
    bookId: "b3",
    bookTitle: "Oy Bolasi",
    likes: 178,
    comments: 24,
    ts: Date.now() - 1000 * 60 * 60 * 22,
  },
];

const TYPE_LABELS: Record<PostType, string> = {
  thought: "FIKR",
  quote: "IQTIBOS",
  review: "TAHLIL",
  discussion: "MUHOKAMA",
};

const TYPE_COLORS: Record<PostType, string> = {
  thought: palette.primary,
  quote: palette.primary,
  review: palette.primary,
  discussion: palette.primary,
};

type FeedFilter = "Hammasi" | "Iqtiboslar" | "Tahlillar" | "Muhokama";
const FEED_FILTERS: FeedFilter[] = ["Hammasi", "Iqtiboslar", "Tahlillar", "Muhokama"];

export default function SozLabScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("Hammasi");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const filtered = SAMPLE_POSTS.filter((p) => {
    if (activeFilter === "Iqtiboslar") return p.type === "quote";
    if (activeFilter === "Tahlillar") return p.type === "review";
    if (activeFilter === "Muhokama") return p.type === "discussion";
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={styles.h1}>So'zLab</Text>
            <Text style={styles.h2}>Adabiy fikrlar maydoni</Text>
          </View>
          <PressableScale style={styles.writeBtn} onPress={() => {}}>
            <MessageCircle color="#fff" size={16} strokeWidth={2.5} />
            <Text style={styles.writeBtnText}>Yozish</Text>
          </PressableScale>
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FEED_FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                styles.filterPill,
                activeFilter === f && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === f && styles.filterPillTextActive,
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Feed */}
        {filtered.map((post, idx) => (
          <PostCard
            key={post.id}
            post={post}
            liked={likedIds.has(post.id)}
            onLike={() => toggleLike(post.id)}
            isLast={idx === filtered.length - 1}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PostCard({
  post,
  liked,
  onLike,
  isLast,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
  isLast: boolean;
}) {
  const author = getAuthor(post.authorId);
  const book = post.bookId ? books.find((b) => b.id === post.bookId) : undefined;
  const typeColor = TYPE_COLORS[post.type];

  return (
    <View style={[styles.card, isLast && { borderBottomWidth: 0 }]}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <Pressable onPress={() => router.push(`/author/${post.authorId}`)}>
          <Image source={{ uri: author?.photo }} style={styles.avatar} contentFit="cover" />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.authorMeta}>
            <Text style={styles.authorName}>{author?.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}18`, borderColor: `${typeColor}35` }]}>
              <Text style={[styles.typeLabel, { color: typeColor }]}>
                {TYPE_LABELS[post.type]}
              </Text>
            </View>
          </View>
          <Text style={styles.ts}>{relativeTime(post.ts)}</Text>
        </View>
        <Pressable hitSlop={10}>
          <MoreHorizontal color={palette.textMuted} size={18} />
        </Pressable>
      </View>

      {/* Post content */}
      {post.type === "quote" ? (
        <View style={styles.quoteWrap}>
          <Quote color={palette.primary} size={16} style={{ marginBottom: 6 }} />
          <Text style={styles.quoteText}>{post.text}</Text>
        </View>
      ) : (
        <Text style={styles.bodyText}>{post.text}</Text>
      )}

      {/* Linked book */}
      {book && (
        <PressableScale
          onPress={() => router.push(getBookRoute(book))}
          style={styles.bookRef}
        >
          <Image source={{ uri: book.cover }} style={styles.bookRefCover} contentFit="contain" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.bookRefLabel}>
              <BookOpen color={palette.secondary} size={11} />
              <Text style={styles.bookRefLabelText}>Kitobga havola</Text>
            </View>
            <Text style={styles.bookRefTitle} numberOfLines={1}>{book.title}</Text>
            <Text style={styles.bookRefAuthor} numberOfLines={1}>
              {getAuthor(book.authorId)?.name}
            </Text>
          </View>
        </PressableScale>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <PressableScale onPress={onLike} style={styles.action}>
          <Heart
            color={liked ? palette.primary : palette.textMuted}
            fill={liked ? palette.primary : "transparent"}
            size={18}
            strokeWidth={2}
          />
          <Text style={[styles.actionText, liked && { color: palette.primary }]}>
            {post.likes + (liked ? 1 : 0)}
          </Text>
        </PressableScale>
        <Pressable style={styles.action}>
          <MessageCircle color={palette.textMuted} size={18} strokeWidth={2} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </Pressable>
        <Pressable style={styles.action}>
          <Share2 color={palette.textMuted} size={18} strokeWidth={2} />
          <Text style={styles.actionText}>Ulash</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.action}>
          <Send color={palette.textMuted} size={16} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / (1000 * 60));
  if (m < 1) return "hozirgina";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  return `${d} kun oldin`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  h1: {
    color: palette.text,
    fontSize: 32,
    fontFamily: FONT.serif,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  h2: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  writeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    marginTop: 6,
  },
  writeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgCard,
  },
  filterPillActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  filterPillText: {
    color: palette.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#fff",
  },
  divider: {
    height: 0,
    backgroundColor: "transparent",
    marginHorizontal: 0,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: palette.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.bgElevated,
  },
  authorMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  authorName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: palette.soft,
    borderColor: palette.borderStrong,
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  ts: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  quoteWrap: {
    borderLeftWidth: 2,
    borderLeftColor: palette.primary,
    paddingLeft: 14,
    marginBottom: 14,
  },
  quoteText: {
    color: palette.text,
    fontSize: 15,
    fontFamily: FONT.serif,
    lineHeight: 24,
    fontStyle: "italic",
  },
  bodyText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 14,
  },
  bookRef: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.bgElevated,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  bookRefCover: {
    width: 36,
    height: 52,
    borderRadius: 6,
    backgroundColor: palette.bgCard,
  },
  bookRefLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  bookRefLabelText: {
    color: palette.secondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bookRefTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  bookRefAuthor: {
    color: palette.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    color: palette.textMuted,
    fontSize: 13,
  },
});
