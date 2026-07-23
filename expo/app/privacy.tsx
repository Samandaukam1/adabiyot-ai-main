import React from "react";

import LegalDocument, { LEGAL_BRAND, type LegalContent } from "@/components/legal/LegalDocument";

const B = LEGAL_BRAND;

const UZ: LegalContent = {
  title: "Maxfiylik siyosati",
  subtitle: `${B} sizning maxfiyligingizni qadrlaydi. Ushbu hujjat qanday ma'lumotlar to'planishi va ular qanday himoyalanishini tushuntiradi.`,
  updatedLabel: "Oxirgi yangilanish",
  updatedValue: "23-iyul, 2026",
  contactTitle: "12. Bog'lanish",
  contactIntro: "Maxfiylik siyosati yoki ma'lumotlaringiz bo'yicha savollaringiz bo'lsa, biz bilan bog'laning:",
  emailLabel: "Email",
  websiteLabel: "Veb-sayt",
  crossLinkLabel: "Foydalanish shartlari",
  rightsReserved: "Barcha huquqlar himoyalangan.",
  sections: [
    {
      title: "1. Kirish",
      blocks: [
        {
          kind: "text",
          text: `${B} — Mukammal Media Group tomonidan ishlab chiqilgan o'zbek adabiyoti platformasi. Ushbu Maxfiylik siyosati ${B} ilovasi va veb-saytidan foydalanganingizda qanday ma'lumotlar to'planishi, ular nima maqsadda ishlatilishi va qanday himoyalanishini tushuntiradi.`,
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
        { kind: "text", text: "Xizmatni taqdim etish uchun biz quyidagi ma'lumotlarni yig'ishimiz mumkin:" },
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
      title: "3. Ma'lumotlardan foydalanish",
      blocks: [
        { kind: "text", text: "To'plangan ma'lumotlar faqat xizmatni taqdim etish va yaxshilash uchun ishlatiladi:" },
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
            `Karta ma'lumotlari (karta raqami, amal qilish muddati) ${B} ilovasida saqlanmaydi;`,
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
            "Ma'lumotlar reklama yoki kuzatuv (tracking) uchun ishlatilmaydi va uchinchi tomonlarga sotilmaydi;",
            "Ma'lumotlar faqat ilovaning ishlashi uchun zarur bo'lgan xizmat provayderlari (serverlar, to'lov va autentifikatsiya xizmatlari) bilan, faqat shu maqsadda ulashiladi;",
            "Qonun talab qilgan hollarda tegishli davlat organlariga ma'lumot berilishi mumkin.",
          ],
        },
      ],
    },
    {
      title: "8. Ma'lumotlar xavfsizligi",
      blocks: [
        {
          kind: "text",
          text: "Biz ma'lumotlaringizni himoya qilish uchun texnik va tashkiliy choralarni qo'llaymiz: ma'lumotlar shifrlangan ulanish (TLS) orqali uzatiladi, kirish huquqlari cheklangan va tizimlarimiz muntazam nazorat qilinadi. Shunga qaramay, internetdagi hech bir uzatish yoki saqlash usuli 100% xavfsiz emasligini eslatib o'tamiz.",
        },
      ],
    },
    {
      title: "9. Bolalar maxfiyligi",
      blocks: [
        {
          kind: "text",
          text: `${B} umumiy auditoriya (general audience) uchun mo'ljallangan. Biz bolalardan ataylab shaxsiy ma'lumot yig'maymiz. Agar bola tomonidan ma'lumot taqdim etilganini aniqlasak, uni imkon qadar tezroq o'chiramiz.`,
        },
      ],
    },
    {
      title: "10. Foydalanuvchi huquqlari",
      blocks: [
        { kind: "text", text: "Sizning ma'lumotlaringiz ustidan quyidagi huquqlaringiz mavjud:" },
        {
          kind: "list",
          items: [
            "Akkauntingizni va unga bog'liq ma'lumotlarni o'chirish;",
            "Profil ma'lumotlaringizni ko'rish va yangilash;",
            "Ma'lumotlaringiz bo'yicha savol yoki so'rov bilan biz bilan bog'lanish.",
          ],
        },
        { kind: "text", text: "Ushbu huquqlardan foydalanish uchun quyidagi manzil orqali biz bilan bog'laning." },
      ],
    },
    {
      title: "11. O'zgartirishlar",
      blocks: [
        {
          kind: "text",
          text: "Ushbu Maxfiylik siyosati vaqti-vaqti bilan yangilanishi mumkin. Muhim o'zgarishlar bo'lsa, ilova yoki veb-sayt orqali xabar beramiz. Yuqoridagi \"Oxirgi yangilanish\" sanasi eng so'nggi tahrirni bildiradi.",
        },
      ],
    },
  ],
};

const EN: LegalContent = {
  title: "Privacy Policy",
  subtitle: `${B} respects your privacy. This document explains what information we collect and how it is protected.`,
  updatedLabel: "Last updated",
  updatedValue: "23 July 2026",
  contactTitle: "12. Contact",
  contactIntro: "If you have any questions about this Privacy Policy or your data, please contact us:",
  emailLabel: "Email",
  websiteLabel: "Website",
  crossLinkLabel: "Terms of Service",
  rightsReserved: "All rights reserved.",
  sections: [
    {
      title: "1. Introduction",
      blocks: [
        {
          kind: "text",
          text: `${B} is an Uzbek literature platform developed by Mukammal Media Group. This Privacy Policy explains what information is collected when you use the ${B} app and website, how it is used, and how it is protected.`,
        },
        {
          kind: "text",
          text: "By using the app and website, you agree to the terms set out in this policy. Please read it carefully.",
        },
      ],
    },
    {
      title: "2. Information we collect",
      blocks: [
        { kind: "text", text: "To provide the service, we may collect the following information:" },
        {
          kind: "list",
          items: [
            "Email address — to create your account and sign you in;",
            "User ID — to identify your account;",
            "Profile information — such as your name, username, avatar and bio;",
            "User-generated content — posts, comments, creative works and files you upload;",
            "Purchase history — orders for books, audio, articles and other purchased content;",
            "Usage data — which sections and features of the app you use;",
            "Diagnostics and crash data — technical error reports that help keep the app stable.",
          ],
        },
      ],
    },
    {
      title: "3. How we use information",
      blocks: [
        { kind: "text", text: "Collected information is used only to provide and improve the service:" },
        {
          kind: "list",
          items: [
            "Creating your account and providing sign-in;",
            "Enabling reading and listening features — books, audio, articles, reels and Tokcha;",
            "Managing purchases and content access (entitlements);",
            "Keeping the platform and accounts secure and preventing abuse;",
            "Analysing and improving the quality of the service.",
          ],
        },
      ],
    },
    {
      title: "4. Payments",
      blocks: [
        { kind: "text", text: "Payments are processed securely through trusted payment providers and our backend systems." },
        {
          kind: "list",
          items: [
            `Card details (card number, expiry date) are not stored in the ${B} app;`,
            "Card details are transmitted securely to the payment provider solely to complete the payment;",
            "We never see or store your full card number — only the order and purchase status are kept.",
          ],
        },
      ],
    },
    {
      title: "5. Sign-in",
      blocks: [
        {
          kind: "text",
          text: "In addition to email, you may sign in using Google Sign-In and Apple Sign-In. In that case, the provider supplies basic information such as your email address; your password is never shared with us.",
        },
      ],
    },
    {
      title: "6. User-generated content",
      blocks: [
        {
          kind: "text",
          text: "Posts, profile information and creative works you create may be visible to other users on the platform. You control how and when your publicly posted content is shared, and you can edit or delete it at any time.",
        },
      ],
    },
    {
      title: "7. Data sharing",
      blocks: [
        {
          kind: "list",
          items: [
            "We do not sell your personal data;",
            "We do not track users across apps or websites, and we do not use your data for advertising tracking;",
            "Data is shared only with service providers necessary for the app to work (servers, payment and authentication services), and only for that purpose;",
            "We may disclose information to authorities where required by law.",
          ],
        },
      ],
    },
    {
      title: "8. Data security",
      blocks: [
        {
          kind: "text",
          text: "We apply technical and organisational measures to protect your data: information is transmitted over encrypted connections (TLS), access is restricted, and our systems are regularly monitored. However, no method of transmission or storage over the internet is 100% secure.",
        },
      ],
    },
    {
      title: "9. Children's privacy",
      blocks: [
        {
          kind: "text",
          text: `${B} is intended for a general audience. We do not knowingly collect personal information from children. If we learn that a child has provided us with information, we will delete it as soon as possible.`,
        },
      ],
    },
    {
      title: "10. Your rights",
      blocks: [
        { kind: "text", text: "You have the following rights over your data:" },
        {
          kind: "list",
          items: [
            "Delete your account and the data associated with it;",
            "View and update your profile information;",
            "Contact us with any question or request about your data.",
          ],
        },
        { kind: "text", text: "To exercise these rights, please contact us at the address below." },
      ],
    },
    {
      title: "11. Changes",
      blocks: [
        {
          kind: "text",
          text: "We may update this Privacy Policy from time to time. If we make material changes, we will notify you through the app or website. The \"Last updated\" date above reflects the most recent revision.",
        },
      ],
    },
  ],
};

/**
 * /privacy — AdabiyotX bilingual (UZ/EN) Maxfiylik siyosati / Privacy Policy.
 * Public legal page for App Store Connect & Google Play, reachable at
 * https://adabiyotx.uz/privacy.
 */
export default function PrivacyPolicy() {
  return <LegalDocument uz={UZ} en={EN} crossLinkHref="/terms" />;
}
