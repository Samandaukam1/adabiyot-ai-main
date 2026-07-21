import Constants from "expo-constants";
import { CircleArrowUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchAppVersionSettings, type AppVersionSettings } from "@/lib/appVersion";
import { useTheme } from "@/providers/ThemeProvider";
import { openExternalUrl } from "@/utils/safeLinks";
import { decideUpdate, parseBuild, type UpdateDecision } from "@/utils/version";

const DEFAULT_TITLE = "Ilovani yangilang";
const DEFAULT_MESSAGE =
  "AdabiyotX ilovasining yangi versiyasi mavjud. Yangi imkoniyatlar va barqaror ishlash uchun ilovani yangilang.";
const NO_LINK_MESSAGE = "Do'kon havolasi topilmadi";

/** Current app version + build number from the bundled Expo config. */
function currentAppInfo(): { version: string; build: number | null } {
  const cfg = Constants.expoConfig;
  const version = cfg?.version ?? "0.0.0";
  const build =
    Platform.OS === "ios"
      ? parseBuild(cfg?.ios?.buildNumber)
      : parseBuild(cfg?.android?.versionCode);
  return { version, build };
}

/**
 * Checks once on app open whether a newer native build exists and, if so, shows
 * an "Ilovani yangilang" modal. Native (Android/iOS) only — renders nothing on
 * web, and stays silent on any network / Supabase error so it never blocks the
 * app or causes a white screen.
 */
export default function AppUpdateChecker() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [decision, setDecision] = useState<UpdateDecision>("none");
  const [settings, setSettings] = useState<AppVersionSettings | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return; // native only
    let active = true;

    (async () => {
      try {
        const platform = Platform.OS === "ios" ? "ios" : "android";
        const s = await fetchAppVersionSettings(platform);
        if (!active || !s) return;

        const { version, build } = currentAppInfo();
        const d = decideUpdate({
          currentVersion: version,
          currentBuild: build,
          latestVersion: s.latestVersion,
          minimumVersion: s.minimumSupportedVersion,
          latestBuild: s.buildNumber,
          minimumBuild: s.minimumBuildNumber,
          forceUpdate: s.forceUpdate,
        });

        if (!active) return;
        setSettings(s);
        setDecision(d);
      } catch {
        // Silent: an update check must never block app open.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const isForce = decision === "force";
  const storeUrl =
    Platform.OS === "ios" ? settings?.appStoreUrl : settings?.playMarketUrl;

  const onUpdate = useCallback(async () => {
    setLinkError(null);
    setOpening(true);
    const ok = await openExternalUrl(storeUrl);
    setOpening(false);
    if (!ok) setLinkError(NO_LINK_MESSAGE);
  }, [storeUrl]);

  const onLater = useCallback(() => {
    if (!isForce) setDismissed(true);
  }, [isForce]);

  if (Platform.OS === "web" || decision === "none" || !settings) return null;
  // Optional updates are dismissable; forced ones stay up.
  if (dismissed && !isForce) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android hardware back: dismiss only when the update is optional.
      onRequestClose={onLater}
    >
      <View style={styles.overlay}>
        {/* Outside press dismisses optional updates only. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isForce ? undefined : onLater}
        />
        <View
          style={[
            styles.card,
            { marginTop: insets.top, marginBottom: insets.bottom },
          ]}
        >
          <View style={styles.iconWrap}>
            <CircleArrowUp color={colors.primary} size={40} />
          </View>

          <Text style={styles.title}>{settings.updateTitle ?? DEFAULT_TITLE}</Text>
          <Text style={styles.message}>
            {settings.updateMessage ?? DEFAULT_MESSAGE}
          </Text>

          {linkError ? <Text style={styles.linkError}>{linkError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={opening}
            onPress={onUpdate}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: opening || pressed ? 0.85 : 1 },
            ]}
          >
            {opening ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Yangilash</Text>
            )}
          </Pressable>

          {!isForce ? (
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              style={styles.secondaryBtn}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textDim }]}>
                Keyinroq
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 24,
      backgroundColor: c.bgCard,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 20,
      alignItems: "center",
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.soft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
      marginBottom: 8,
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: c.textDim,
      textAlign: "center",
      marginBottom: 20,
    },
    linkError: {
      fontSize: 13,
      color: "#E5484D",
      textAlign: "center",
      marginBottom: 12,
    },
    primaryBtn: {
      width: "100%",
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryBtn: {
      width: "100%",
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
  });
}
