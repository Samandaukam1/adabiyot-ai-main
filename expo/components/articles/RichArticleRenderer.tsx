import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Headphones,
  Info,
  Lock,
  Pause,
  Play,
  Quote as QuoteIcon,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
} from "react-native";
import { FONT, PressableScale } from "@/components/ui";
import type {
  ArticleInlineMark,
  RichArticleBlock,
  RichArticleMedia,
  RichTextSegment,
} from "@/lib/articles";
import { openExternalUrl } from "@/utils/safeLinks";

const PRIMARY = "#2F9E6E";
const PAPER_MAX = 760;

export interface RichArticleTheme {
  bg: string;
  paper: string;
  text: string;
  sub: string;
  border: string;
  soft: string;
}

export function RichArticleRenderer({
  blocks,
  theme,
  fontSize,
  fontFamily,
  purchased,
  onBuy,
  priceLabel,
}: {
  blocks: RichArticleBlock[];
  theme: RichArticleTheme;
  fontSize: number;
  fontFamily: string;
  purchased: boolean;
  onBuy?: () => void;
  priceLabel?: string;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (blocks.length === 0) {
    return (
      <View style={[styles.fallbackCard, { marginTop: 0 }]}>
        <FileText color={PRIMARY} size={20} />
        <Text style={styles.fallbackTitle}>Maqola matni hozircha mavjud emas</Text>
      </View>
    );
  }

  return (
    <View>
      {blocks.map((block, index) => (
        <RichBlockView
          key={block.id || `${block.type}-${index}`}
          block={block}
          theme={theme}
          fontSize={fontSize}
          fontFamily={fontFamily}
          purchased={purchased}
          onBuy={onBuy}
          priceLabel={priceLabel}
          styles={styles}
        />
      ))}
    </View>
  );
}

function RichBlockView({
  block,
  theme,
  fontSize,
  fontFamily,
  purchased,
  onBuy,
  priceLabel,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  fontSize: number;
  fontFamily: string;
  purchased: boolean;
  onBuy?: () => void;
  priceLabel?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const paragraphStyle: TextStyle = {
    color: theme.text,
    fontSize,
    lineHeight: Math.round(fontSize * 1.7),
    fontFamily,
    fontWeight: "400",
  };

  if (block.isPaid && !purchased) {
    return <PaidContentBlock block={block} theme={theme} onBuy={onBuy} priceLabel={priceLabel} styles={styles} />;
  }

  switch (block.type) {
    case "heading":
      return (
        <InlineText
          segments={segmentsOrText(block)}
          baseStyle={[styles.heading, { color: theme.text }]}
          defaultFontFamily={FONT.serif}
        />
      );
    case "subheading":
      return (
        <InlineText
          segments={segmentsOrText(block)}
          baseStyle={[styles.subheading, { color: theme.text }]}
          defaultFontFamily={FONT.serif}
        />
      );
    case "paragraph":
      return (
        <InlineText
          segments={segmentsOrText(block)}
          baseStyle={[styles.paragraph, paragraphStyle]}
          defaultFontFamily={fontFamily}
        />
      );
    case "image":
      return <ImageBlock block={block} theme={theme} styles={styles} />;
    case "gallery":
      return <GalleryBlock images={block.images ?? []} theme={theme} styles={styles} />;
    case "video":
      return isExternalVideo(block) ? (
        <ExternalVideoBlock block={block} theme={theme} styles={styles} />
      ) : (
        <VideoBlock block={block} theme={theme} styles={styles} />
      );
    case "audio":
      return <AudioBlock block={block} theme={theme} styles={styles} />;
    case "quote":
      return (
        <View style={styles.quoteBlock}>
          <QuoteIcon color={PRIMARY} size={25} />
          <InlineText
            segments={segmentsOrText(block)}
            baseStyle={[styles.quoteText, { color: theme.text }]}
            defaultFontFamily={FONT.serif}
          />
          {block.title ? <Text style={styles.quoteAuthor}>{block.title}</Text> : null}
        </View>
      );
    case "important_note":
    case "callout":
      return <ImportantNoteBlock block={block} theme={theme} fontFamily={fontFamily} styles={styles} />;
    case "ordered_list":
    case "unordered_list":
    case "list":
      return (
        <View style={styles.listBlock}>
          {(block.items ?? []).map((item, index) => (
            <View key={`${block.id}-item-${index}`} style={styles.listRow}>
              {block.type === "ordered_list" ? (
                <View style={styles.numberBullet}>
                  <Text style={styles.numberBulletText}>{index + 1}</Text>
                </View>
              ) : (
                <View style={styles.dotBullet} />
              )}
              <InlineText
                segments={item}
                baseStyle={[styles.listText, paragraphStyle]}
                defaultFontFamily={fontFamily}
              />
            </View>
          ))}
        </View>
      );
    case "table":
      return <TableBlock block={block} theme={theme} fontFamily={fontFamily} styles={styles} />;
    case "file":
      return <FileBlock block={block} theme={theme} styles={styles} />;
    case "link":
      return <LinkBlock block={block} theme={theme} styles={styles} />;
    case "paid_content":
      return purchased ? (
        <View style={styles.calloutBlock}>
          <View style={styles.calloutIcon}>
            <Lock color={PRIMARY} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            {block.title ? <Text style={styles.calloutTitle}>{block.title}</Text> : null}
            <InlineText
              segments={segmentsOrText(block)}
              baseStyle={[styles.calloutText, { color: theme.sub }]}
              defaultFontFamily={fontFamily}
            />
          </View>
        </View>
      ) : (
        <PaidContentBlock block={block} theme={theme} onBuy={onBuy} priceLabel={priceLabel} styles={styles} />
      );
    case "divider":
      return <View style={styles.divider} />;
    case "spacer":
      return <View style={{ height: block.height ?? 32 }} />;
    case "unknown":
      return <UnknownBlock block={block} styles={styles} />;
    default:
      return <UnknownBlock block={block} styles={styles} />;
  }
}

function ImageBlock({
  block,
  theme,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!block.mediaUrl) return <UnknownBlock block={block} styles={styles} />;

  return (
    <View style={styles.imageBlock}>
      <Image
        source={{ uri: block.mediaUrl }}
        style={styles.largeImage}
        contentFit="cover"
        accessibilityLabel={block.alt || block.caption || undefined}
      />
      {block.caption ? <Text style={[styles.caption, { color: theme.sub }]}>{block.caption}</Text> : null}
    </View>
  );
}

function GalleryBlock({
  images,
  theme,
  styles,
}: {
  images: RichArticleMedia[];
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const { width } = useWindowDimensions();
  const itemWidth = Math.min(PAPER_MAX - 72, width - 76);

  if (images.length === 0) return null;

  return (
    <ScrollView
      horizontal
      pagingEnabled={images.length > 1}
      snapToInterval={itemWidth + 12}
      decelerationRate="fast"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.galleryTrack}
      style={styles.galleryWrap}
    >
      {images.map((image, index) => (
        <View key={`${image.url}-${index}`} style={[styles.galleryItem, { width: itemWidth }]}>
          <Image source={{ uri: image.url }} style={styles.galleryImage} contentFit="cover" />
          {image.caption ? <Text style={[styles.caption, { color: theme.sub }]}>{image.caption}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function VideoBlock({
  block,
  theme,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const url = block.mediaUrl || block.url || "";
  const [activated, setActivated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(url || null, (nextPlayer) => {
    nextPlayer.loop = false;
    nextPlayer.muted = false;
    nextPlayer.allowsExternalPlayback = true;
    nextPlayer.staysActiveInBackground = false;
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Ignore native teardown races.
      }
    };
  }, [player]);

  const toggle = useCallback(() => {
    if (!url) return;
    try {
      if (!activated) setActivated(true);
      if (playing) {
        player.pause();
        setPlaying(false);
      } else {
        player.play();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  }, [activated, player, playing, url]);

  return (
    <View style={styles.mediaBlock}>
      <Pressable onPress={toggle} style={styles.videoStage}>
        {activated ? (
          <VideoView style={StyleSheet.absoluteFillObject} player={player} contentFit="cover" nativeControls />
        ) : block.thumbnailUrl ? (
          <Image source={{ uri: block.thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <LinearGradient colors={[theme.soft, theme.paper]} style={StyleSheet.absoluteFillObject} />
        )}
        {!playing ? (
          <View style={styles.playCircle}>
            <Play color="#fff" fill="#fff" size={23} />
          </View>
        ) : null}
        {block.duration ? <Text style={styles.durationBadge}>{block.duration}</Text> : null}
      </Pressable>
      <View style={styles.mediaText}>
        <Text style={styles.mediaTitle}>{block.title || "Video"}</Text>
        {block.text || block.caption ? (
          <Text style={styles.mediaDesc}>{block.text || block.caption}</Text>
        ) : null}
      </View>
    </View>
  );
}

function isExternalVideo(block: RichArticleBlock): boolean {
  if (block.mediaType === "external_video") return true;
  const url = block.mediaUrl || block.url || "";
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

function youtubeThumb(url: string): string {
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : "";
}

function ExternalVideoBlock({
  block,
  theme,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const url = block.mediaUrl || block.url || "";
  const thumb = block.thumbnailUrl || youtubeThumb(url);
  const open = useCallback(() => {
    if (url) void openExternalUrl(url);
  }, [url]);

  return (
    <View style={styles.mediaBlock}>
      <Pressable onPress={open} style={styles.videoStage}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <LinearGradient colors={[theme.soft, theme.paper]} style={StyleSheet.absoluteFillObject} />
        )}
        <View style={styles.playCircle}>
          <Play color="#fff" fill="#fff" size={23} />
        </View>
        {block.duration ? <Text style={styles.durationBadge}>{block.duration}</Text> : null}
      </Pressable>
      <View style={styles.mediaText}>
        <Text style={styles.mediaTitle}>{block.title || "Video"}</Text>
        <Pressable onPress={open} style={styles.externalOpenRow} hitSlop={6}>
          <ExternalLink color={PRIMARY} size={14} />
          <Text style={styles.externalOpenText}>Videoni ochish</Text>
        </Pressable>
        {block.text || block.caption ? (
          <Text style={styles.mediaDesc}>{block.text || block.caption}</Text>
        ) : null}
      </View>
    </View>
  );
}

const NOTE_TONES: Record<
  "info" | "warning" | "success" | "danger",
  { bg: string; border: string; color: string; Icon: typeof Info }
> = {
  info: { bg: "rgba(47,158,110,0.10)", border: "rgba(47,158,110,0.32)", color: PRIMARY, Icon: Info },
  success: { bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.32)", color: "#16A34A", Icon: CheckCircle2 },
  warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.34)", color: "#D97706", Icon: AlertTriangle },
  danger: { bg: "rgba(229,72,77,0.10)", border: "rgba(229,72,77,0.32)", color: "#DC2626", Icon: AlertCircle },
};

function resolveNoteTone(tone: string | undefined): keyof typeof NOTE_TONES {
  const value = (tone ?? "").toLowerCase();
  if (/warn|caution|ogohlantirish/.test(value)) return "warning";
  if (/success|ok|done|muvaffaqiyat/.test(value)) return "success";
  if (/danger|error|alert|critical|xato|xavf/.test(value)) return "danger";
  return "info";
}

function ImportantNoteBlock({
  block,
  theme,
  fontFamily,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  fontFamily: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const tone = NOTE_TONES[resolveNoteTone(block.tone)];
  const Icon = tone.Icon;

  return (
    <View style={[styles.calloutBlock, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={[styles.calloutIcon, { backgroundColor: theme.paper }]}>
        <Icon color={tone.color} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        {block.title ? <Text style={[styles.calloutTitle, { color: theme.text }]}>{block.title}</Text> : null}
        <InlineText
          segments={segmentsOrText(block)}
          baseStyle={[styles.calloutText, { color: theme.text }]}
          defaultFontFamily={fontFamily}
        />
      </View>
    </View>
  );
}

function AudioBlock({
  block,
  theme,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const url = block.mediaUrl || block.url || "";
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!url || loading) return;

    try {
      setLoading(true);
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setPlaying(status.isPlaying);
          if (status.didJustFinish) setPlaying(false);
        });
        setPlaying(true);
        setLoading(false);
        return;
      }

      if (playing) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }, [loading, playing, url]);

  return (
    <View style={styles.audioBlock}>
      {block.thumbnailUrl ? (
        <Image source={{ uri: block.thumbnailUrl }} style={styles.audioCover} contentFit="cover" />
      ) : (
        <View style={styles.audioCoverFallback}>
          <Headphones color={PRIMARY} size={24} />
        </View>
      )}
      <View style={styles.audioInfo}>
        <Text style={styles.audioTitle}>{block.title || block.caption || "Audio"}</Text>
        {block.text ? <Text style={styles.audioDesc} numberOfLines={2}>{block.text}</Text> : null}
        {block.duration ? <Text style={styles.audioDuration}>{block.duration}</Text> : null}
      </View>
      <PressableScale onPress={toggle} style={styles.audioPlay}>
        {playing ? <Pause color="#fff" size={17} /> : <Play color="#fff" fill="#fff" size={17} />}
      </PressableScale>
    </View>
  );
}

function FileBlock({
  block,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const open = useCallback(() => {
    if (block.url || block.mediaUrl) {
      void openExternalUrl(block.url || block.mediaUrl || "");
    }
  }, [block.mediaUrl, block.url]);

  return (
    <PressableScale onPress={open} style={styles.fileBlock}>
      <View style={styles.fileIcon}>
        <Download color={PRIMARY} size={22} />
      </View>
      <View style={styles.fileTextWrap}>
        <Text style={styles.fileTitle}>{block.title || block.fileName || "Fayl"}</Text>
        {block.text || block.caption ? (
          <Text style={styles.fileDesc}>{block.text || block.caption}</Text>
        ) : null}
        <Text style={styles.fileMeta}>
          {[block.fileName, block.fileFormat, block.fileSize].filter(Boolean).join(" · ") || "Ochish"}
        </Text>
      </View>
    </PressableScale>
  );
}

function LinkBlock({
  block,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const open = useCallback(() => {
    if (block.url) void openExternalUrl(block.url);
  }, [block.url]);

  return (
    <PressableScale onPress={open} style={styles.linkBlock}>
      <ExternalLink color={PRIMARY} size={20} />
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{block.title || block.text || block.url}</Text>
        {block.url ? <Text style={styles.linkUrl} numberOfLines={1}>{block.url}</Text> : null}
      </View>
    </PressableScale>
  );
}

function TableBlock({
  block,
  fontFamily,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  fontFamily: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const headers = block.headers ?? [];
  const rows = block.rows ?? [];
  if (headers.length === 0 && rows.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={styles.table}>
        {headers.length > 0 ? (
          <View style={[styles.tableRow, styles.tableHeadRow]}>
            {headers.map((cell, index) => (
              <InlineText
                key={`head-${index}`}
                segments={cell}
                baseStyle={[styles.tableHeadCell, { fontFamily }]}
                defaultFontFamily={fontFamily}
              />
            ))}
          </View>
        ) : null}
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.tableRow}>
            {row.map((cell, cellIndex) => (
              <InlineText
                key={`cell-${rowIndex}-${cellIndex}`}
                segments={cell}
                baseStyle={[styles.tableCell, { fontFamily }]}
                defaultFontFamily={fontFamily}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function PaidContentBlock({
  block,
  onBuy,
  priceLabel,
  styles,
}: {
  block: RichArticleBlock;
  theme: RichArticleTheme;
  onBuy?: () => void;
  priceLabel?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.paidBlock}>
      <View style={styles.paidIcon}>
        <Lock color={PRIMARY} size={22} />
      </View>
      <Text style={styles.paidTitle}>{block.title || "Premium kontent"}</Text>
      {block.text ? <Text style={styles.paidText}>{block.text}</Text> : null}
      {onBuy ? (
        <PressableScale onPress={onBuy} style={styles.paidButton}>
          <Text style={styles.paidButtonText}>
            {priceLabel && priceLabel !== "Bepul" ? `${priceLabel} ga ochish` : "Ochish"}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function UnknownBlock({
  block,
  styles,
}: {
  block: RichArticleBlock;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.fallbackCard}>
      <FileText color={PRIMARY} size={20} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fallbackTitle}>Qo'shimcha kontent</Text>
        {block.text ? <Text style={styles.fallbackText} numberOfLines={3}>{block.text}</Text> : null}
      </View>
    </View>
  );
}

function InlineText({
  segments,
  baseStyle,
  defaultFontFamily,
}: {
  segments: RichTextSegment[];
  baseStyle: TextStyle | TextStyle[];
  defaultFontFamily: string;
}) {
  return (
    <Text style={baseStyle}>
      {segments.map((segment, index) => {
        const link = segment.marks?.find((mark): mark is { type: "link"; href: string } => mark.type === "link");
        return (
          <Text
            key={`${segment.text}-${index}`}
            onPress={link ? () => void openExternalUrl(link.href) : undefined}
            style={styleForMarks(segment.marks, defaultFontFamily)}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

function styleForMarks(marks: ArticleInlineMark[] = [], defaultFontFamily: string): TextStyle {
  const style: TextStyle = {};
  const decorations: string[] = [];

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        style.fontWeight = "800";
        break;
      case "italic":
        style.fontStyle = "italic";
        break;
      case "underline":
        decorations.push("underline");
        break;
      case "strike":
        decorations.push("line-through");
        break;
      case "color":
        if (isSafeColor(mark.value)) style.color = mark.value;
        break;
      case "highlight":
        if (isSafeColor(mark.value)) style.backgroundColor = mark.value;
        break;
      case "link":
        style.color = PRIMARY;
        decorations.push("underline");
        break;
      case "fontSize":
        style.fontSize = Math.min(34, Math.max(12, mark.value));
        style.lineHeight = Math.round(Math.min(34, Math.max(12, mark.value)) * 1.62);
        break;
      case "fontFamily":
        style.fontFamily = resolveFontFamily(mark.value, defaultFontFamily);
        break;
      default:
        break;
    }
  }

  if (decorations.length > 0) {
    style.textDecorationLine = Array.from(new Set(decorations)).join(" ") as TextStyle["textDecorationLine"];
  }

  return style;
}

function segmentsOrText(block: RichArticleBlock): RichTextSegment[] {
  if (block.segments && block.segments.length > 0) return block.segments;
  if (block.text) return [{ text: block.text }];
  if (block.title) return [{ text: block.title }];
  return [];
}

function resolveFontFamily(value: string, fallback: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("mono")) return FONT.mono;
  if (normalized.includes("sans") || normalized.includes("system") || normalized.includes("roboto")) return FONT.sans;
  if (normalized.includes("serif") || normalized.includes("georgia") || normalized.includes("times")) return FONT.serif;
  if (normalized.includes("palatino") || normalized.includes("classic")) return FONT.classic;
  return fallback;
}

function isSafeColor(value: string): boolean {
  const color = value.trim();
  return (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\([^)]+\)$/i.test(color) ||
    /^hsla?\([^)]+\)$/i.test(color) ||
    /^[a-z]+$/i.test(color)
  );
}

function createStyles(theme: RichArticleTheme) {
  return StyleSheet.create({
    heading: {
      fontFamily: FONT.serif,
      fontSize: 27,
      lineHeight: 34,
      fontWeight: "700",
      letterSpacing: -0.2,
      marginTop: 30,
      marginBottom: 12,
    },
    subheading: {
      fontFamily: FONT.serif,
      fontSize: 21,
      lineHeight: 29,
      fontWeight: "700",
      letterSpacing: -0.1,
      marginTop: 24,
      marginBottom: 9,
    },
    paragraph: {
      marginBottom: 20,
      letterSpacing: 0,
    },
    imageBlock: { marginVertical: 24 },
    largeImage: {
      width: "100%",
      aspectRatio: 16 / 10,
      borderRadius: 16,
      backgroundColor: theme.soft,
    },
    caption: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 9,
      textAlign: "center",
    },
    galleryWrap: { marginVertical: 24, marginHorizontal: -2 },
    galleryTrack: { gap: 12, paddingHorizontal: 2 },
    galleryItem: { gap: 8 },
    galleryImage: {
      width: "100%",
      aspectRatio: 16 / 10,
      borderRadius: 16,
      backgroundColor: theme.soft,
    },
    mediaBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      overflow: "hidden",
      marginVertical: 22,
    },
    videoStage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.soft },
    playCircle: {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 58,
      height: 58,
      marginLeft: -29,
      marginTop: -29,
      borderRadius: 29,
      backgroundColor: "rgba(46,125,50,0.93)",
      alignItems: "center",
      justifyContent: "center",
    },
    durationBadge: {
      position: "absolute",
      right: 12,
      bottom: 12,
      color: "#fff",
      fontSize: 11,
      fontWeight: "900",
      backgroundColor: "rgba(0,0,0,0.62)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    mediaText: { padding: 14 },
    mediaTitle: { color: theme.text, fontSize: 16, lineHeight: 21, fontWeight: "900" },
    mediaDesc: { color: theme.sub, fontSize: 13, lineHeight: 20, fontWeight: "600", marginTop: 7 },
    externalOpenRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    externalOpenText: { color: PRIMARY, fontSize: 13, fontWeight: "800" },
    quoteBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      padding: 18,
      marginVertical: 22,
    },
    quoteText: {
      fontFamily: FONT.serif,
      fontSize: 22,
      lineHeight: 31,
      fontWeight: "700",
      letterSpacing: 0,
      marginTop: 12,
    },
    quoteAuthor: { color: theme.sub, fontSize: 13, fontWeight: "800", marginTop: 12 },
    calloutBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      padding: 16,
      flexDirection: "row",
      gap: 12,
      marginVertical: 18,
    },
    calloutIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: theme.paper,
      alignItems: "center",
      justifyContent: "center",
    },
    calloutTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: "900", marginBottom: 4 },
    calloutText: { fontSize: 14, lineHeight: 22, fontWeight: "600" },
    listBlock: { gap: 12, marginBottom: 22 },
    listRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
    numberBullet: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    numberBulletText: { color: "#fff", fontSize: 12, fontWeight: "900" },
    dotBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 12 },
    listText: { flex: 1, marginBottom: 0 },
    tableScroll: { marginVertical: 22 },
    table: {
      minWidth: 620,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: theme.paper,
    },
    tableRow: { flexDirection: "row" },
    tableHeadRow: { backgroundColor: theme.soft },
    tableHeadCell: {
      width: 170,
      color: theme.text,
      padding: 12,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "900",
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    tableCell: {
      width: 170,
      color: theme.sub,
      padding: 12,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderTopColor: theme.border,
      borderRightColor: theme.border,
    },
    audioBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      padding: 12,
      marginVertical: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    audioCover: { width: 62, height: 62, borderRadius: 14, backgroundColor: theme.paper },
    audioCoverFallback: {
      width: 62,
      height: 62,
      borderRadius: 14,
      backgroundColor: theme.paper,
      alignItems: "center",
      justifyContent: "center",
    },
    audioInfo: { flex: 1 },
    audioTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
    audioDesc: { color: theme.sub, fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 3 },
    audioDuration: { color: PRIMARY, fontSize: 11, fontWeight: "900", marginTop: 5 },
    audioPlay: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
    },
    fileBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      padding: 14,
      marginVertical: 18,
      flexDirection: "row",
      gap: 12,
    },
    fileIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor: theme.paper,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    fileTextWrap: { flex: 1 },
    fileTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
    fileDesc: { color: theme.sub, fontSize: 12, lineHeight: 18, fontWeight: "600", marginTop: 4 },
    fileMeta: { color: PRIMARY, fontSize: 11, fontWeight: "900", marginTop: 7 },
    linkBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      padding: 14,
      marginVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    linkTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: "900" },
    linkUrl: { color: theme.sub, fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 3 },
    paidBlock: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      backgroundColor: theme.soft,
      padding: 20,
      marginVertical: 20,
      alignItems: "center",
    },
    paidIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: theme.paper,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    paidTitle: { color: theme.text, fontFamily: FONT.serif, fontSize: 22, lineHeight: 28, fontWeight: "800", textAlign: "center" },
    paidText: { color: theme.sub, fontSize: 14, lineHeight: 21, fontWeight: "600", textAlign: "center", marginTop: 8 },
    paidButton: {
      height: 46,
      borderRadius: 14,
      paddingHorizontal: 18,
      marginTop: 16,
      backgroundColor: PRIMARY,
      alignItems: "center",
      justifyContent: "center",
    },
    paidButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
    divider: { height: 1, backgroundColor: theme.border, marginVertical: 28 },
    fallbackCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      backgroundColor: theme.soft,
      padding: 15,
      marginVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    fallbackTitle: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: "900" },
    fallbackText: { color: theme.sub, fontSize: 12, lineHeight: 18, fontWeight: "600", marginTop: 3 },
  });
}
