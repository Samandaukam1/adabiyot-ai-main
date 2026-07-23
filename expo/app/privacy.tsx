import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Globe, Mail, ShieldCheck } from "lucide-react-native";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT } from "@/components/ui";
import WebContainer from "@/components/web/WebContainer";
import WebFooter from "@/components/web/WebFooter";
import { cursorPointer, hoverTransition } from "@/components/web/webStyle";
import { useHover } from "@/components/web/useHover";
import type { AppTheme } from "@/constants/colors";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/providers/ThemeProvider";
import { openExternalUrl } from "@/utils/safeLinks";

const BRAND = "AdabiyotX";
const COMPANY = "Mukammal Media Group";
const CONTACT_EMAIL = "jaxongir_man@icloud.com";
const WEBSITE_URL = "https://adabiyotx.uz";
const WEBSITE_LABEL = "adabiyotx.uz";
const LAST_UPDATED = "23-iyul, 2026";

/**
 * A paragraph, or a bulleted list, inside a policy section. Kept as data so the
 * same content renders identically on the phone and the desktop web layout.
 */
type Block =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] };

interface Section {
  title: string;
  blocks: Block[];
}

const SECTIONS: Section[] = [
  {
    title: "1. Kirish",
    blocks: [
      {
        kind: "text",
        text: `${BRAND} — ${COMPANY} tomonidan ishlab chiqilgan o'zbek adabiyoti platformasi. Ushbu Maxfiylik siyosati ${BRAND} ilovasi va veb-saytidan foydalanganingizda qanday ma'lumotlar to'planishi, ular nima maqsadda ishlatilishi va qanday himoyalanishini tushuntiradi.`,
      },
      {
        kind: "text",
        text: "Ilova va veb-saytdan foydalanish orqali siz ushbu siyosatda bayon etilgan shartlarga rozilik bildirasiz. Iltimos, uni diqqat bilan o'qib chiqing.",
      },
    ],
  },
  {
    title: "2. Qanday ma'lumotlar yig'iladi",
    blocks: [
      {
        kind: "text",
        text: "Xizmatni taqdim etish uchun biz quyidagi ma'lumotlarni yig'ishimiz mumkin:",
      },
      {
        kind: "list",
        items: [
          "Email manzil — akkauntni yaratish va tizimga kirish uchun;",
          "Foydalanuvchi identifikatori (user ID) — akkauntingizni aniqlash uchun;",
          "Profil ma'lumotlari — ism, taxallus (username), avatar va bio kabi siz kiritgan ma'lumotlar;",
          "Foydalanuvchi yaratgan kontent — postlar, sharhlar, ijodiy materiallar va yuklagan fayllaringiz;",
          "Xarid tarixi — sotib olingan kitob, audio, maqola va boshqa kontentga oid buyurtmalar;",
          "Ilovadan foydalanish statistikasi — qaysi bo'limlar va funksiyalardan foydalanganingiz;",
          "Crash va diagnostika ma'lumotlari — ilovaning barqaror ishlashini ta'minlash uchun texnik xatoliklar hisoboti.",
        ],
      },
    ],
  },
  {
    title: "3. Ma'lumotlar nima uchun ishlatiladi",
    blocks: [
      {
        kind: "text",
        text: "To'plangan ma'lumotlar faqat xizmatni taqdim etish va yaxshilash uchun ishlatiladi:",
      },
      {
        kind: "list",
        items: [
          "Akkaunt yaratish va tizimga kirishni ta'minlash;",
          "Kitob, audio, maqola, reels va tokcha xizmatlaridan foydalanish imkonini berish;",
          "Xaridlar va kontentga kirish huquqini (entitlements) boshqarish;",
          "Platforma va akkauntlar xavfsizligini ta'minlash, suiiste'molning oldini olish;",
          "Xizmat sifatini tahlil qilish va yaxshilash.",
        ],
      },
    ],
  },
  {
    title: "4. To'lovlar",
    blocks: [
      {
        kind: "text",
        text: "To'lovlar ishonchli to'lov provayderi va bizning backend tizimimiz orqali xavfsiz amalga oshiriladi.",
      },
      {
        kind: "list",
        items: [
          `Karta ma'lumotlari (karta raqami, amal qilish muddati) ${BRAND} ilovasida saqlanmaydi;`,
          "Karta ma'lumotlari faqat to'lovni amalga oshirish uchun to'lov provayderiga xavfsiz uzatiladi;",
          "Biz sizning to'liq karta raqamingizni ko'rmaymiz va saqlamaymiz — faqat buyurtma va xarid holati saqlanadi.",
        ],
      },
    ],
  },
  {
    title: "5. Tizimga kirish (Login)",
    blocks: [
      {
        kind: "text",
        text: "Akkauntga kirish uchun email bilan bir qatorda Google Sign In va Apple Sign In xizmatlaridan foydalanishingiz mumkin. Bunday holatda tegishli provayder sizning email manzilingiz kabi asosiy ma'lumotlarni bizga taqdim etadi; parolingiz biz bilan bo'lishilmaydi.",
      },
    ],
  },
  {
    title: "6. Foydalanuvchi kontenti",
    blocks: [
      {
        kind: "text",
        text: "Siz yaratgan postlar, profil ma'lumotlari va ijodiy materiallar platformada boshqa foydalanuvchilarga ko'rinishi mumkin. Ommaviy joylashtirilgan kontentni qanday va qachon ulashishni siz nazorat qilasiz, va uni istalgan vaqtda o'zgartirishingiz yoki o'chirishingiz mumkin.",
      },
    ],
  },
  {
    title: "7. Ma'lumotlarni ulashish",
    blocks: [
      {
        kind: "list",
        items: [
          "Biz sizning shaxsiy ma'lumotlaringizni sotmaymiz;",
          "Ma'lumotlar reklama yoki kuzatuv (tracking) maqsadida uchinchi tomonlarga sotilmaydi;",
          "Ma'lumotlar faqat ilovaning ishlashi uchun zarur bo'lgan xizmat provayderlari (masalan, serverlar, to'lov va autentifikatsiya xizmatlari) bilan, faqat shu maqsadda ulashiladi;",
          "Qonun talab qilgan hollarda tegishli davlat organlariga ma'lumot berilishi mumkin.",
        ],
      },
    ],
  },
  {
    title: "8. Kuzatuv (Tracking)",
    blocks: [
      {
        kind: "text",
        text: `${BRAND} sizni boshqa kompaniyalarning ilova va veb-saytlari bo'ylab reklama maqsadida kuzatmaydi. Biz sizning ma'lumotlaringizni uchinchi tomon reklama tarmoqlariga sotmaymiz.`,
      },
    ],
  },
  {
    title: "9. Ma'lumotlar xavfsizligi",
    blocks: [
      {
        kind: "text",
        text: "Biz ma'lumotlaringizni himoya qilish uchun texnik va tashkiliy choralarni qo'llaymiz: ma'lumotlar shifrlangan ulanish (TLS) orqali uzatiladi, kirish huquqlari cheklangan va tizimlarimiz muntazam nazorat qilinadi. Shunga qaramay, internetdagi hech bir uzatish yoki saqlash usuli 100% xavfsiz emasligini eslatib o'tamiz.",
      },
    ],
  },
  {
    title: "10. Bolalar maxfiyligi",
    blocks: [
      {
        kind: "text",
        text: `${BRAND} umumiy auditoriya (general audience) uchun mo'ljallangan. Biz bolalardan ataylab shaxsiy ma'lumot yig'maymiz. Agar bola tomonidan ma'lumot taqdim etilganini aniqlasak, uni imkon qadar tezroq o'chiramiz.`,
      },
    ],
  },
  {
    title: "11. Foydalanuvchi huquqlari",
    blocks: [
      {
        kind: "text",
        text: "Sizning ma'lumotlaringiz ustidan quyidagi huquqlaringiz mavjud:",
      },
      {
        kind: "list",
        items: [
          "Akkauntingizni va unga bog'liq ma'lumotlarni o'chirish;",
          "Profil ma'lumotlaringizni ko'rish va yangilash;",
          "Ma'lumotlaringiz bo'yicha savol yoki so'rov bilan biz bilan bog'lanish.",
        ],
      },
      {
        kind: "text",
        text: "Ushbu huquqlardan foydalanish uchun quyidagi manzil orqali biz bilan bog'laning.",
      },
    ],
  },
];

/**
 * /privacy — AdabiyotX Maxfiylik siyosati. Public, App Store / Google Play
 * uchun mos legal sahifa. Renders on both native and web (a store-registered
 * URL must be reachable in a browser); the desktop web layout gets the shared
 * WebHeader (global) + WebFooter, the phone gets a lightweight back bar.
 */
export default function PrivacyPolicy() {
  const { colors: c, isDark } = useTheme();
  const { isWebLayout, isDesktopWeb } = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  const titleSize = isDesktopWeb ? 46 : isWebLayout ? 38 : 30;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: isWebLayout ? 0 : 48 }}>
      {/* Native-only back bar — on web the global WebHeader handles navigation. */}
      {!isWebLayout ? (
        <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft color={c.text} size={22} />
          </Pressable>
          <Text style={styles.backTitle}>Maxfiylik siyosati</Text>
        </View>
      ) : null}

      <View style={{ paddingTop: isWebLayout ? (isDesktopWeb ? 48 : 32) : 8 }}>
        <WebContainer maxWidth={880}>
          {/* Hero */}
          <LinearGradient
            colors={
              isDark
                ? ["rgba(82,183,136,0.14)", "rgba(29,53,87,0.10)"]
                : ["#E8F5EE", "#F5F1EA"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <ShieldCheck color={c.primary} size={16} />
                <Text style={styles.brandBadgeText}>{COMPANY.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={[styles.heroTitle, { fontSize: titleSize }]}>Maxfiylik siyosati</Text>
            <Text style={styles.heroSubtitle}>
              {BRAND} sizning maxfiyligingizni qadrlaydi. Ushbu hujjat qanday ma'lumotlar
              to'planishi va ular qanday himoyalanishini tushuntiradi.
            </Text>
            <Text style={styles.updated}>Oxirgi yangilanish: {LAST_UPDATED}</Text>
          </LinearGradient>

          {/* Sections */}
          <View style={styles.sections}>
            {SECTIONS.map((section) => (
              <PolicySection key={section.title} section={section} styles={styles} c={c} />
            ))}

            {/* 12. Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>12. Bog'lanish</Text>
              <Text style={styles.paragraph}>
                Maxfiylik siyosati yoki ma'lumotlaringiz bo'yicha savollaringiz bo'lsa, biz
                bilan bog'laning:
              </Text>
              <View style={styles.contactCard}>
                <ContactRow
                  icon={<Mail color={c.primary} size={18} />}
                  label="Email"
                  value={CONTACT_EMAIL}
                  onPress={() => void openExternalUrl(`mailto:${CONTACT_EMAIL}`)}
                  styles={styles}
                />
                <View style={styles.contactDivider} />
                <ContactRow
                  icon={<Globe color={c.primary} size={18} />}
                  label="Veb-sayt"
                  value={WEBSITE_LABEL}
                  onPress={() => void openExternalUrl(WEBSITE_URL)}
                  styles={styles}
                />
              </View>
            </View>

            <Text style={styles.footerNote}>
              © {new Date().getFullYear()} {COMPANY}. {BRAND}. Barcha huquqlar himoyalangan.
            </Text>
          </View>
        </WebContainer>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function PolicySection({
  section,
  styles,
  c,
}: {
  section: Section;
  styles: StylesType;
  c: AppTheme;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.blocks.map((block, i) =>
        block.kind === "text" ? (
          <Text key={i} style={styles.paragraph}>
            {block.text}
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.listItem}>
                <View style={styles.bullet} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
  styles: StylesType;
}) {
  const { hovered, onHoverIn, onHoverOut } = useHover();
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[styles.contactRow, cursorPointer]}
    >
      <View style={styles.contactIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={[styles.contactValue, hovered ? styles.contactValueHover : null, hoverTransition]}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

type StylesType = ReturnType<typeof createStyles>;

function createStyles(c: AppTheme, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    backBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    backTitle: { color: c.text, fontSize: 18, fontWeight: "800", fontFamily: FONT.serif },

    hero: {
      borderRadius: 24,
      padding: Platform.OS === "web" ? 40 : 24,
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.22)" : "rgba(82,183,136,0.28)",
    },
    brandRow: { flexDirection: "row", marginBottom: 18 },
    brandBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(82,183,136,0.16)" : "rgba(255,255,255,0.75)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(82,183,136,0.30)" : "rgba(82,183,136,0.35)",
    },
    brandBadgeText: { color: c.primaryDim, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
    heroTitle: {
      color: c.text,
      fontWeight: "900",
      fontFamily: FONT.serif,
      letterSpacing: -1,
      lineHeight: Platform.OS === "web" ? undefined : 38,
    },
    heroSubtitle: { color: c.textDim, fontSize: 16, lineHeight: 25, marginTop: 14, maxWidth: 620 },
    updated: {
      color: c.primaryDim,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 18,
    },

    sections: { marginTop: 8 },
    section: { marginTop: 30 },
    sectionTitle: {
      color: c.text,
      fontSize: 21,
      fontWeight: "800",
      fontFamily: FONT.serif,
      marginBottom: 12,
    },
    paragraph: { color: c.textDim, fontSize: 15.5, lineHeight: 26, marginTop: 4 },

    list: { marginTop: 10, gap: 10 },
    listItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingRight: 4 },
    bullet: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.primary,
      marginTop: 9,
    },
    listText: { color: c.textDim, fontSize: 15.5, lineHeight: 25, flex: 1 },

    contactCard: {
      marginTop: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: isDark ? c.bgCard : "#FFFFFF",
      overflow: "hidden",
    },
    contactRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
    contactIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.soft,
    },
    contactLabel: { color: c.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
    contactValue: { color: c.text, fontSize: 15.5, fontWeight: "700", marginTop: 2 },
    contactValueHover: { color: c.primary },
    contactDivider: { height: 1, backgroundColor: c.border, marginLeft: 70 },

    footerNote: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 36,
      textAlign: "center",
    },
  });
}
