import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import type { BookContext } from "@/utils/jaxongirContext";
import { supabase } from "@/lib/supabase";
import { type AvatarVideoState, useJaxongirAvatarVideos } from "@/hooks/useJaxongirAvatarVideos";
import { TransparentVideoView, isTransparentVideoAvailable } from "@/modules/transparent-video";

const { width: W } = Dimensions.get("window");
const KEYBOARD_BAR_GAP = 18;
const AVATAR_W = Math.round((W - 48) * 0.80);
const ITEM_W = AVATAR_W;
const MSGS_MAX_H = 160;

type UiState = "greeting" | "idle" | "listening" | "thinking" | "talking" | "error";
const UI_TO_AVATAR: Record<UiState, AvatarVideoState> = {
  greeting: "greeting", idle: "idle", listening: "listening",
  thinking: "thinking", talking: "talking", error: "error",
};

interface Message { role: "user" | "assistant"; text: string; }
interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceScreen?: string;
  promptContext?: string;
  relatedContentType?: string;
  relatedContentId?: string;
  currentBook?: BookContext;
}

export default function JaxongirAIAssistant({ isOpen, onClose, sourceScreen, promptContext, relatedContentType, relatedContentId, currentBook }: Props) {
  const { getVideo, refetchIfStale } = useJaxongirAvatarVideos();

  const [uiState, setUiState]       = useState<UiState>("greeting");
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Web layout ────────────────────────────────────────────────────────────
  // The mobile design fills ~80% of the (phone) screen width. In a wide browser
  // that constant blows up, so on web ≥768px we render a compact, screen-fitted
  // chat card instead: avatar on top, a growing chat area in the middle and a
  // small input bar at the bottom. Native phone layout is untouched.
  const { width: winW, height: winH } = useWindowDimensions();
  const isWebPanel = Platform.OS === "web" && winW >= 768;
  const webPanelW = Math.min(460, winW - 40);
  const webAvatar = Math.min(300, webPanelW - 40);
  const webCardH = Math.min(Math.round(winH * 0.86), 760);

  // Animations
  const slideX    = useRef(new Animated.Value(-W)).current;
  const backdrop  = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const contentY  = useRef(new Animated.Value(30)).current;

  // Glow pulse loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    );
    if (isOpen) loop.start();
    return () => loop.stop();
  }, [glowAnim, isOpen]);

  const glowShadowR = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 24] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.0] });
  const glowColor   = glowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["#1E8A55", "#52FFB0", "#1E8A55"] });

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Open/close
  useEffect(() => {
    if (isOpen) {
      setUiState("greeting"); setMessages([]); setInput(""); setVideoError(false);
      refetchIfStale(); // refresh videos if cache has expired
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideX,   { toValue: 0, useNativeDriver: true, tension: 100, friction: 11 }),
        Animated.spring(contentY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start(() => {
        setTimeout(() => setUiState(s => s === "greeting" ? "idle" : s), 2600);
      });
    } else {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(slideX,   { toValue: -W, duration: 280, useNativeDriver: true }),
        Animated.timing(contentY, { toValue: 30, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [backdrop, contentY, isOpen, refetchIfStale, slideX]);

  // Thinking pulse
  useEffect(() => {
    if (uiState === "thinking") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.80, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 7 }).start();
  }, [pulseAnim, uiState]);

  // Video — the gapless two-player queue lives in <GaplessAvatarVideo/>, which
  // plays every clip fully and pre-buffers the next so state changes never cut.
  const video = getVideo(UI_TO_AVATAR[uiState]);

  const handleVideoError = useCallback(() => setVideoError(true), []);

  // Clear the error flag whenever a (new) valid video URL becomes available.
  useEffect(() => {
    if (video?.video_url) setVideoError(false);
  }, [video?.video_url]);

  // Send
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput(""); setSending(true); setUiState("thinking");
    setMessages(p => [...p, { role: "user", text }]);

    const requestBody = {
      message: text,
      source_screen: sourceScreen ?? "unknown",
      prompt_context: promptContext ?? "global",
      related_content_type: relatedContentType ?? null,
      related_content_id: relatedContentId ?? null,
      current_book: currentBook ?? null,
    };

    if (__DEV__) console.log("JAXONGIR AI SEND:", {
      message: text,
      source_screen: requestBody.source_screen,
      prompt_context: requestBody.prompt_context,
      related_content_type: requestBody.related_content_type,
      related_content_id: requestBody.related_content_id,
      hasCurrentBook: !!currentBook?.title,
    });

    try {
      const { data, error } = await supabase.functions.invoke("jaxongir-ai-chat", { body: requestBody });

      if (error) {
        console.error("JAXONGIR AI ERROR:", error);
        const isNetworkError = error.message?.toLowerCase().includes("network") || error.message?.toLowerCase().includes("fetch");
        const errorText = isNetworkError
          ? "Internet aloqasini tekshiring."
          : error.message?.includes("not found") || error.message?.includes("404")
          ? "Jaxongir AI serveri hali sozlanmagan."
          : "Kechirasiz, hozir javob berishda muammo yuz berdi.";
        setUiState("error");
        setMessages(p => [...p, { role: "assistant", text: errorText }]);
      } else if (!data?.answer) {
        console.warn("JAXONGIR AI: empty answer", data);
        setUiState("error");
        setMessages(p => [...p, { role: "assistant", text: "Kechirasiz, hozir javob olishda muammo yuz berdi." }]);
      } else {
        if (__DEV__) console.log("JAXONGIR AI RESPONSE:", { prompt_type: data.prompt_type, answerLength: data.answer.length });
        setUiState("talking");
        setMessages(p => [...p, { role: "assistant", text: data.answer }]);
        setTimeout(() => setUiState("idle"), 3600);
      }
    } catch (err) {
      console.error("JAXONGIR AI ERROR:", err);
      setUiState("error");
      setMessages(p => [...p, { role: "assistant", text: "Internet aloqasini tekshiring." }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, sending, sourceScreen, promptContext, relatedContentType, relatedContentId, currentBook]);

  const handleInputChange = (text: string) => {
    setInput(text);
    if (text.length > 0 && uiState === "idle")       setUiState("listening");
    if (text.length === 0 && uiState === "listening") setUiState("idle");
  };

  // Play every valid admin video. The poster is only a fallback for missing or
  // failed video; it must not replace normal MP4/composite avatar animation.
  const showVideo = !videoError && !!video?.video_url;
  // iOS: a transparent .mov is rendered by the native AVPlayerLayer view so its
  // alpha actually composites (expo-video would show the opaque key colour).
  // Guard with isTransparentVideoAvailable so builds that lack the native module
  // fall through to the poster image instead of crashing.
  const useNativeTransparent =
    Platform.OS === "ios" && isTransparentVideoAvailable && showVideo && !!video?.is_transparent;

  const showVideoPlayer = showVideo && !useNativeTransparent;

  if (!isOpen) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Full screen dark backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, isWebPanel && { backgroundColor: "rgba(0,0,0,0.5)" }, { opacity: backdrop }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Close button top-right */}
      <Animated.View style={[styles.closeBtnWrap, { opacity: backdrop }]} pointerEvents="box-none">
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={16}>
          <MaterialCommunityIcons name="close" size={16} color="rgba(255,255,255,0.55)" />
        </Pressable>
      </Animated.View>

      <KeyboardAvoidingView
        style={[styles.keyboardView, keyboardOpen && styles.keyboardViewWithKeyboard]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.content,
            keyboardOpen && styles.contentWithKeyboard,
            isWebPanel && ({
              width: webPanelW,
              height: webCardH,
              gap: 12,
              padding: 14,
              borderRadius: 26,
              backgroundColor: "rgba(9,18,14,0.42)",
              borderWidth: 1,
              borderColor: "rgba(82,183,136,0.26)",
              justifyContent: "flex-start",
              backdropFilter: "blur(22px)",
              WebkitBackdropFilter: "blur(22px)",
            } as any),
            {
              transform: isWebPanel
                ? [{ translateY: contentY }]
                : [{ translateX: slideX }, { translateY: contentY }],
            },
          ]}
        >
          {/* ── 1:1 video / avatar ── */}
          <Animated.View
            style={[
              styles.videoFrame,
              isWebPanel && { width: webAvatar, flexShrink: 0 },
              {
                shadowColor: glowColor as any,
                shadowRadius: glowShadowR as any,
                shadowOpacity: glowOpacity as any,
                shadowOffset: { width: 0, height: 0 },
                elevation: 22,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.videoGlowRing, { borderColor: glowColor as any, opacity: glowOpacity }]}
            />

            <View style={[styles.videoWrap, isWebPanel && { width: webAvatar }]}>
              {useNativeTransparent ? (
                // iOS HEVC-alpha → native AVPlayerLayer view (alpha composites)
                <TransparentVideoView
                  source={video!.video_url}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              ) : showVideoPlayer ? (
                isWebPanel ? (
                  // Web: a raw <video> autoplays the WebM/VP9-alpha reliably
                  // (expo-video's web wrapper often stalls on the first frame).
                  <WebAvatarVideo url={video!.video_url} poster={video?.poster_url} onError={handleVideoError} />
                ) : (
                  <>
                    <GaplessAvatarVideo url={video!.video_url} onError={handleVideoError} />
                    <View style={styles.videoDimmer} pointerEvents="none" />
                    {/* Blocks iOS native play-button tap overlay */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />
                  </>
                )
              ) : video?.poster_url ? (
                <Image
                  source={{ uri: video.poster_url }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              ) : (
                <Animated.View style={[styles.avatarFloat, { transform: [{ scale: pulseAnim }] }]}>
                  <MaterialCommunityIcons
                    name={
                      uiState === "thinking"  ? "brain" :
                      uiState === "talking" || uiState === "greeting" ? "robot-excited-outline" :
                      uiState === "error"     ? "robot-dead-outline"  :
                      uiState === "listening" ? "microphone-outline"  : "robot-outline"
                    }
                    size={110}
                    color="#52B788"
                  />
                  <Text style={styles.avatarLabel}>Jaxongir AI</Text>
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Messages (when present) */}
          {(messages.length > 0 || isWebPanel) && (
            <ScrollView
              ref={scrollRef}
              style={[
                styles.messages,
                { maxHeight: MSGS_MAX_H },
                isWebPanel && { flex: 1, width: "100%", maxHeight: undefined },
              ]}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                { paddingVertical: 8, gap: 7 },
                isWebPanel && messages.length === 0 && { flexGrow: 1, justifyContent: "center", alignItems: "center" },
              ]}
            >
              {isWebPanel && messages.length === 0 ? (
                <Text style={styles.webEmptyHint}>Kitoblar, she'rlar yoki mualliflar haqida so'rang…</Text>
              ) : null}
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {uiState === "thinking" && (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color="#52B788" />
                  <Text style={styles.thinkingTxt}>O'ylanmoqda…</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── Floating pill bar ── */}
          <Animated.View
            style={[
              styles.barOuter,
              isWebPanel && { width: "100%", flexShrink: 0 },
              {
                shadowColor: glowColor as any,
                shadowRadius: glowShadowR as any,
                shadowOpacity: glowOpacity as any,
                shadowOffset: { width: 0, height: 0 },
                elevation: 22,
              },
            ]}
          >
            {/* Animated glow border */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.glowRing, { borderColor: glowColor as any, opacity: glowOpacity }]}
            />

            {/* Robot icon circle */}
            <LinearGradient colors={["#52B788", "#1E8A55"]} style={styles.barIcon}>
              <MaterialCommunityIcons
                name={
                  uiState === "thinking"  ? "brain" :
                  uiState === "error"     ? "robot-dead-outline"  :
                  uiState === "listening" ? "microphone-outline"  : "robot-outline"
                }
                size={20}
                color="#fff"
              />
            </LinearGradient>

            {/* Input */}
            <TextInput
              style={[styles.barInput, isWebPanel && ({ cursor: "text", outlineStyle: "none" } as any)]}
              placeholder={messages.length === 0 ? "Jaxongir AI ga savol yozing…" : "Davom ettiring…"}
              placeholderTextColor="rgba(225,255,238,0.58)"
              value={input}
              onChangeText={handleInputChange}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!sending}
              selectionColor="#B9F8D4"
            />

            {/* Send */}
            <Pressable
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialCommunityIcons name="send" size={18} color="#fff" />
              }
            </Pressable>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Web avatar playback — a raw HTML5 <video>.
 *
 * On the web the admin's transparent WebM (VP9 alpha) plays fine in the browser,
 * but expo-video's <VideoView> web wrapper frequently fails to autoplay and
 * leaves the clip frozen on its first frame. A plain <video autoplay muted loop
 * playsinline> autoplays reliably; `object-fit: contain` keeps Jaxongir centred
 * and the alpha channel composites over the frame behind. Web-only — never
 * mounted on native, so `React.createElement("video")` is never evaluated there.
 */
function WebAvatarVideo({ url, poster, onError }: { url: string; poster?: string | null; onError: () => void }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    const p = el.play?.();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [url]);
  return React.createElement("video", {
    ref,
    src: url,
    poster: poster ?? undefined,
    autoPlay: true,
    muted: true,
    loop: true,
    playsInline: true,
    "webkit-playsinline": "true",
    onError,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "contain",
      objectPosition: "center",
      background: "transparent",
    },
  } as any);
}

/**
 * Gapless avatar playback.
 *
 * Two stacked players: the visible one loops the current clip seamlessly
 * (native loop=true). When a *different* clip is requested it is pre-buffered on
 * the hidden player while the visible clip keeps looping — only when the visible
 * clip reaches its natural end (loop is flipped off so `playToEnd` fires) do we
 * hand over to the pre-buffered clip with zero delay. If nothing is queued, the
 * current clip simply loops on, so the idle animation never stops.
 */
function GaplessAvatarVideo({
  url,
  onError,
  activeOpacity = 0.74,
  contentFit = "contain",
}: {
  url: string;
  onError: () => void;
  activeOpacity?: number;
  contentFit?: "contain" | "cover";
}) {
  const playerA = useVideoPlayer(null, (p) => { p.loop = true; p.muted = true; });
  const playerB = useVideoPlayer(null, (p) => { p.loop = true; p.muted = true; });

  const [activeIsA, setActiveIsA] = useState(true);
  const activeIsARef = useRef(true);
  activeIsARef.current = activeIsA;

  const currentUrlRef = useRef<string | null>(null);
  const targetUrlRef = useRef(url);
  const preloadedUrlRef = useRef<string | null>(null);
  targetUrlRef.current = url;

  // Load the first clip, or pre-buffer a newly requested one on the idle player.
  useEffect(() => {
    if (!url) return;
    const isA = activeIsARef.current;
    const active = isA ? playerA : playerB;
    const inactive = isA ? playerB : playerA;

    if (currentUrlRef.current === null) {
      try {
        active.loop = true;
        active.replace({ uri: url, useCaching: true });
        active.play();
        currentUrlRef.current = url;
      } catch { onError(); }
      return;
    }

    if (url === currentUrlRef.current) {
      // Same clip as on screen — keep it looping seamlessly, drop any pending swap.
      try { active.loop = true; } catch { /* */ }
      preloadedUrlRef.current = null;
      return;
    }

    // Different clip: buffer it on the hidden player and let the current clip
    // play out (loop=false → playToEnd) before handing over.
    try {
      inactive.replace({ uri: url, useCaching: true });
      inactive.pause();
      inactive.currentTime = 0;
      preloadedUrlRef.current = url;
      active.loop = false;
    } catch { onError(); }
  }, [url, playerA, playerB, onError]);

  // Current clip finished: hand over to the pre-buffered clip instantly, or loop
  // the current one again if nothing is ready yet.
  const onEnd = useCallback((endedIsA: boolean) => {
    const isA = activeIsARef.current;
    if (endedIsA !== isA) return; // ignore the hidden player's events
    const active = isA ? playerA : playerB;
    const inactive = isA ? playerB : playerA;
    // Steady state loops natively (loop=true) — nothing to hand over.
    if (active.loop) return;
    const tgt = targetUrlRef.current;

    if (tgt && tgt !== currentUrlRef.current && preloadedUrlRef.current === tgt) {
      // Next clip is buffered → hand over with zero delay.
      try {
        inactive.loop = true;
        inactive.currentTime = 0;
        inactive.play();
      } catch { /* */ }
      currentUrlRef.current = tgt;
      preloadedUrlRef.current = null;
      activeIsARef.current = !isA;
      setActiveIsA(!isA);
      // Pause the now-hidden player shortly after the swap completes.
      setTimeout(() => { try { active.pause(); } catch { /* */ } }, 80);
    } else if (tgt && tgt !== currentUrlRef.current) {
      // Switch wanted but next clip not buffered yet — replay current (loop still
      // off) so the next end event retries the handoff.
      try { active.currentTime = 0; active.play(); } catch { /* */ }
    } else {
      // No switch pending — resume seamless native looping.
      try { active.loop = true; active.play(); } catch { /* */ }
    }
  }, [playerA, playerB]);

  useEventListener(playerA, "playToEnd", () => onEnd(true));
  useEventListener(playerB, "playToEnd", () => onEnd(false));

  const baseStyle = [StyleSheet.absoluteFill, styles.videoTransparent];
  return (
    <>
      <VideoView
        player={playerA}
        style={[baseStyle, { opacity: activeIsA ? activeOpacity : 0 }]}
        contentFit={contentFit}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <VideoView
        player={playerB}
        style={[baseStyle, { opacity: activeIsA ? 0 : activeOpacity }]}
        contentFit={contentFit}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
      <Text style={[styles.bubbleTxt, { color: isUser ? "#fff" : "#E5E7EB" }]}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  closeBtnWrap: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 999,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "box-none",
  } as any,
  keyboardViewWithKeyboard: {
    justifyContent: "flex-end",
  },
  content: {
    width: ITEM_W,
    alignItems: "center",
    gap: 16,
  },
  contentWithKeyboard: {
    marginBottom: KEYBOARD_BAR_GAP,
  },
  videoFrame: {
    width: AVATAR_W,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(17,24,39,0.18)",
    borderWidth: 1.2,
    borderColor: "rgba(82,183,136,0.56)",
  },
  videoGlowRing: {
    borderRadius: 22,
    borderWidth: 1.5,
    zIndex: 3,
  },
  videoWrap: {
    width: AVATAR_W,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,26,20,0.16)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.48)",
    overflow: "hidden",
    zIndex: 2,
  },
  videoTransparent: {
    backgroundColor: "transparent",
  },
  videoSoftened: {
    opacity: 0.74,
  },
  videoDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,8,7,0.18)",
  },
  avatarFloat: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  avatarLabel: {
    color: "rgba(82,183,136,0.60)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Messages
  messages: {
    width: ITEM_W,
    paddingHorizontal: 4,
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: "#52B788", borderBottomRightRadius: 4 },
  bubbleAI:   { alignSelf: "flex-start", backgroundColor: "rgba(31,41,55,0.9)", borderBottomLeftRadius: 4 },
  bubbleTxt:  { fontSize: 14, lineHeight: 20 },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 },
  thinkingTxt: { color: "#6B7280", fontSize: 13, fontStyle: "italic" },
  webEmptyHint: {
    color: "rgba(180,220,200,0.55)",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  // Pill bar
  barOuter: {
    width: ITEM_W,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(24,132,88,0.58)",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(82,255,176,0.34)",
    padding: 8,
    gap: 10,
  },
  glowRing: {
    borderRadius: 50,
    borderWidth: 1.5,
  },
  barIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  barInput: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 15,
    height: 44,
    paddingVertical: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2FBF7A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#52B788",
    shadowOpacity: 0.65,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  sendBtnOff: {
    backgroundColor: "rgba(20,83,57,0.62)",
    shadowOpacity: 0.18,
    elevation: 4,
  },
});
