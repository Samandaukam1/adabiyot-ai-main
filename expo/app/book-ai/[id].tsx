import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/colors";
import { FONT } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { getAuthor, getBook } from "@/mocks/content";
import { usePublishedBook } from "@/hooks/usePublishedBooks";
import { useJaxongirAvatarPoster } from "@/hooks/useJaxongirAvatarPoster";
import { useTheme } from "@/providers/ThemeProvider";

const QUESTION_LIMIT = 5;

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface BookInfo {
  id: string;
  cover: string;
  title: string;
  author: string;
  description: string;
  genre: string;
}

export default function BookAiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const mock = useMemo(() => getBook(String(id)), [id]);
  const { book: supaBook, loading } = usePublishedBook(mock ? "" : String(id ?? ""));
  const poster = useJaxongirAvatarPoster();

  const book: BookInfo | null = useMemo(() => {
    if (mock) {
      return {
        id: mock.id,
        cover: mock.cover,
        title: mock.title,
        author: getAuthor(mock.authorId)?.name ?? "",
        description: mock.description,
        genre: mock.category,
      };
    }
    if (supaBook) {
      return {
        id: supaBook.id,
        cover: supaBook.cover,
        title: supaBook.title,
        author: supaBook.authorName,
        description: supaBook.description,
        genre: supaBook.genre,
      };
    }
    return null;
  }, [mock, supaBook]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const questionsAsked = messages.filter((m) => m.role === "user").length;
  const limitReached = questionsAsked >= QUESTION_LIMIT;

  useEffect(() => {
    if (book && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          text: `Salom! Men Jaxongir AI. «${book.title}» kitobi haqida ${QUESTION_LIMIT} tagacha savol berishingiz mumkin. Nimani bilmoqchisiz?`,
        },
      ]);
    }
  }, [book, messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || limitReached || !book) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", text }]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data, error } = await supabase.functions.invoke("jaxongir-ai-chat", {
        body: {
          message: text,
          source_screen: "book_ai",
          prompt_context: "book_help",
          related_content_type: "book",
          related_content_id: book.id,
          current_book: {
            id: book.id,
            title: book.title,
            author: book.author,
            description: book.description,
            genre: book.genre,
          },
        },
      }) as { data: { answer?: string; error?: string } | null; error: { message: string } | null };

      const answer = !error && data?.answer ? data.answer : "Kechirasiz, hozir javob olishda muammo yuz berdi. Internetni tekshiring.";
      setMessages((p) => [...p, { role: "assistant", text: answer }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", text: "Internet aloqasini tekshiring." }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  if (loading && !book) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", gap: 14 }]}>
        <Text style={{ color: c.textMuted }}>Kitob topilmadi</Text>
        <Pressable onPress={() => router.back()} style={styles.backInline}>
          <Text style={styles.backInlineText}>Orqaga</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header — only cover, title, author remain */}
      <LinearGradient
        colors={isDark ? ["rgba(82,183,136,0.12)", "rgba(13,17,23,0)"] : ["rgba(82,183,136,0.10)", "rgba(255,255,255,0)"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={c.text} size={20} />
        </Pressable>
        <Image source={{ uri: book.cover }} style={styles.cover} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={styles.aiTag}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.aiTagAvatar} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name="robot-happy-outline" size={13} color={c.primary} />
            )}
            <Text style={styles.aiTagText}>Jaxongir AI</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAi]}>
            {m.role === "assistant" ? <AiAvatar poster={poster} styles={styles} /> : null}
            <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAi]}>
              <Text style={[styles.bubbleText, m.role === "user" && { color: "#fff" }]}>{m.text}</Text>
            </View>
          </View>
        ))}
        {sending ? (
          <View style={[styles.bubbleRow, styles.bubbleRowAi]}>
            <AiAvatar poster={poster} styles={styles} />
            <View style={[styles.bubble, styles.bubbleAi]}>
              <ActivityIndicator color={c.primary} size="small" />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Input + 5-question limit */}
      <View style={[styles.inputWrap, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={styles.counter}>
          {limitReached ? "Savol limiti tugadi" : `Savollar: ${questionsAsked}/${QUESTION_LIMIT}`}
        </Text>
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={limitReached ? "5 ta savol berib bo'ldingiz" : "Kitob haqida so'rang..."}
            placeholderTextColor={c.textMuted}
            style={styles.input}
            editable={!limitReached}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sending || limitReached}
            style={[styles.sendBtn, (!input.trim() || sending || limitReached) && { opacity: 0.4 }]}
          >
            <Send color="#fff" size={18} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function AiAvatar({ poster, styles }: { poster: string | null; styles: ReturnType<typeof createStyles> }) {
  if (poster) {
    return <Image source={{ uri: poster }} style={styles.bubbleAvatar} contentFit="cover" />;
  }
  return (
    <LinearGradient colors={["#52B788", "#2D9B6F"]} style={styles.bubbleAvatar}>
      <MaterialCommunityIcons name="robot-happy-outline" size={15} color="#fff" />
    </LinearGradient>
  );
}

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backInline: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: c.primary },
    backInlineText: { color: "#fff", fontWeight: "800" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    cover: { width: 52, height: 74, borderRadius: 8, backgroundColor: c.bgElevated },
    aiTag: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
    aiTagAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.soft },
    aiTagText: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
    title: { color: c.text, fontSize: 17, fontWeight: "900", fontFamily: FONT.serif, lineHeight: 21 },
    author: { color: c.primary, fontSize: 12.5, fontWeight: "700", marginTop: 2 },
    bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12, maxWidth: "100%" },
    bubbleRowUser: { justifyContent: "flex-end" },
    bubbleRowAi: { justifyContent: "flex-start" },
    bubbleAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    bubble: { maxWidth: "82%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleAi: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 5 },
    bubbleUser: { backgroundColor: c.primary, borderBottomRightRadius: 5 },
    bubbleText: { color: c.textDim, fontSize: 14.5, lineHeight: 21, fontWeight: "500" },
    inputWrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    counter: { color: c.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 6, marginLeft: 6 },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      backgroundColor: c.bgCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      paddingLeft: 16,
      paddingRight: 6,
      paddingVertical: 6,
    },
    input: { flex: 1, color: c.text, fontSize: 15, fontWeight: "500", maxHeight: 110, paddingVertical: Platform.OS === "ios" ? 8 : 4 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
  });
}
