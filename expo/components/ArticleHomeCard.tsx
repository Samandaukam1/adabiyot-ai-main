import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Clock, Headphones } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT, PressableScale } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import { useTheme } from "@/providers/ThemeProvider";
import type { HomeArticleCard } from "@/lib/articles";

const A4_ASPECT = 0.707;

/**
 * Premium portrait A4 article card for the home feed. Cover fills the card with
 * a dark gradient; "Maqola" label sits top-left, the title and author overlay
 * the lower third, with reading-time + audio badges.
 */
export default function ArticleHomeCard({
  card,
  width,
  onPress,
}: {
  card: HomeArticleCard;
  width: number;
  onPress: () => void;
}) {
  const { colors: L } = useTheme();
  const [coverError, setCoverError] = useState(false);
  const aspect = card.coverAspectRatio > 0 ? card.coverAspectRatio : A4_ASPECT;
  const height = Math.round(width / aspect);

  return (
    <PressableScale onPress={onPress} style={{ width }} testID={`article-home-card-${card.id}`}>
      <View
        style={{
          width,
          height,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: L.bgCard,
          borderWidth: 1,
          borderColor: L.isDark ? "rgba(255,255,255,0.08)" : "rgba(13,27,42,0.08)",
          shadowColor: "#000",
          shadowOpacity: L.isDark ? 0.34 : 0.2,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        {card.cover && !coverError ? (
          <Image
            source={{ uri: card.cover }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={() => setCoverError(true)}
          />
        ) : (
          <LinearGradient colors={[L.primary, L.primaryDim]} style={StyleSheet.absoluteFillObject} />
        )}
        <LinearGradient
          colors={["rgba(8,15,10,0.05)", "rgba(8,15,10,0.32)", "rgba(8,15,10,0.88)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top row: Maqola label + audio badge */}
        <View style={styles.topRow}>
          <View style={styles.label}>
            <Text style={styles.labelText}>Maqola</Text>
          </View>
          {card.hasAudio ? (
            <View style={styles.audioBadge}>
              <Headphones color="#fff" size={12} />
            </View>
          ) : null}
        </View>

        {/* Bottom: title + author + reading time */}
        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={3}>
            {card.title}
          </Text>
          {card.authorName ? (
            <View style={styles.authorRow}>
              <Text style={styles.author} numberOfLines={1}>
                {card.authorName}
              </Text>
              {card.authorVerification !== "none" ? (
                <VerificationBadge verificationType={card.authorVerification} size="sm" />
              ) : null}
            </View>
          ) : null}
          <View style={styles.readingRow}>
            <Clock color="rgba(255,255,255,0.85)" size={12} />
            <Text style={styles.readingText}>{card.readingTime}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  topRow: {
    position: "absolute",
    top: 11,
    left: 11,
    right: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    backgroundColor: "rgba(46,125,50,0.92)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  audioBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 12 },
  title: {
    color: "#fff",
    fontFamily: FONT.serif,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  author: { color: "rgba(255,255,255,0.86)", fontSize: 11, fontWeight: "700", flexShrink: 1 },
  readingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 },
  readingText: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "800" },
});
