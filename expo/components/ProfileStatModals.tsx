import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "@/components/ui";
import VerificationBadge from "@/components/VerificationBadge";
import type { AppTheme } from "@/constants/colors";
import type { FollowUser } from "@/hooks/useFollowLists";
import type { ShelfItem } from "@/hooks/useShelf";
import { getInitials } from "@/types/profile";

const SHELF_LABEL: Record<string, string> = { book: "Kitob", poem: "She'r", article: "Maqola", scenario: "Ssenariy" };

function goToContent(item: ShelfItem) {
  switch (item.contentType) {
    case "poem":
      router.push(`/poem/${item.contentId}`);
      break;
    case "article":
      router.push({ pathname: "/article/[id]", params: { id: item.contentId } });
      break;
    case "scenario":
      router.push(`/screenplay/${item.contentId}`);
      break;
    default:
      router.push(`/book/${item.contentId}`);
  }
}

function SheetShell({
  title,
  onClose,
  c,
  children,
}: {
  title: string;
  onClose: () => void;
  c: AppTheme;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const s = styles(c);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
          <View style={s.grabber} />
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={onClose} style={s.close} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={18} color={c.textDim} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Followers / following list. `loader` is called when the modal opens. */
export function ProfilePeopleModal({
  title,
  loader,
  emptyText,
  onClose,
  c,
}: {
  title: string;
  loader: () => Promise<FollowUser[]>;
  emptyText: string;
  onClose: () => void;
  c: AppTheme;
}) {
  const s = styles(c);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load once — the modal is mounted fresh each time it opens.
  useEffect(() => {
    let alive = true;
    loader()
      .then((list) => alive && setUsers(list))
      .catch(() => alive && setUsers([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (id: string) => {
    onClose();
    router.push({ pathname: "/u/[id]", params: { id } });
  };

  return (
    <SheetShell title={title} onClose={onClose} c={c}>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={c.primary} /></View>
      ) : users.length === 0 ? (
        <View style={s.center}><Text style={s.empty}>{emptyText}</Text></View>
      ) : (
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {users.map((u) => (
            <Pressable key={u.id} onPress={() => open(u.id)} style={s.row}>
              {u.avatarUrl ? (
                <Image source={{ uri: u.avatarUrl }} style={s.avatar} contentFit="cover" />
              ) : (
                <View style={[s.avatar, s.avatarPh]}>
                  <Text style={s.avatarInitial}>{getInitials(u.name)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={s.name}>{u.name}</Text>
                  {u.badge !== "none" ? <VerificationBadge verificationType={u.badge} size="sm" /> : null}
                </View>
                {u.username ? <Text numberOfLines={1} style={s.handle}>@{u.username}</Text> : null}
                {u.bio ? <Text numberOfLines={1} style={s.bio}>{u.bio}</Text> : null}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SheetShell>
  );
}

/** Read-literature list (poems excluded by the caller). */
export function ProfileReadsModal({ items, onClose, c }: { items: ShelfItem[]; onClose: () => void; c: AppTheme }) {
  const s = styles(c);
  const open = (item: ShelfItem) => {
    onClose();
    goToContent(item);
  };
  return (
    <SheetShell title="O'qilgan adabiyotlar" onClose={onClose} c={c}>
      {items.length === 0 ? (
        <View style={s.center}><Text style={s.empty}>Hali adabiyot o'qib tugatilmagan</Text></View>
      ) : (
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const pct = typeof item.progress === "number" ? Math.min(100, Math.round(item.progress * 100)) : 0;
            const status = item.finished ? "O'qib tugatildi" : pct > 0 ? `${pct}% o'qilgan` : "Jarayonda";
            return (
              <Pressable key={`${item.contentType}:${item.contentId}`} onPress={() => open(item)} style={s.row}>
                {item.cover ? (
                  <Image source={{ uri: item.cover }} style={s.cover} contentFit="cover" />
                ) : (
                  <View style={[s.cover, s.avatarPh]}>
                    <MaterialCommunityIcons name="book" size={18} color={c.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={s.name}>{item.title || "Nomsiz asar"}</Text>
                  {item.author ? <Text numberOfLines={1} style={s.handle}>{item.author}</Text> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <View style={[s.pill, { backgroundColor: item.finished ? c.soft : c.surface }]}>
                      <Text style={[s.pillText, { color: item.finished ? c.primary : c.textDim }]}>{status}</Text>
                    </View>
                    <Text style={s.typeText}>{SHELF_LABEL[item.contentType] ?? "Adabiyot"}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SheetShell>
  );
}

const styles = (c: AppTheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 16,
      maxHeight: "82%",
    },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 12 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    title: { color: c.text, fontSize: 18, fontWeight: "900", fontFamily: FONT.serif },
    close: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    center: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
    empty: { color: c.textMuted, fontSize: 14 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.bgElevated },
    avatarPh: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
    avatarInitial: { color: c.primary, fontSize: 16, fontWeight: "900" },
    cover: { width: 40, height: 56, borderRadius: 8, backgroundColor: c.bgElevated },
    name: { color: c.text, fontSize: 15, fontWeight: "800" },
    handle: { color: c.textMuted, fontSize: 12.5, marginTop: 1 },
    bio: { color: c.textDim, fontSize: 12, marginTop: 2 },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    pillText: { fontSize: 11, fontWeight: "800" },
    typeText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  });
