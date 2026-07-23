import React from "react";

import LegalDocument, { LEGAL_BRAND, type LegalContent } from "@/components/legal/LegalDocument";

const B = LEGAL_BRAND;

const UZ: LegalContent = {
  title: "Foydalanish shartlari",
  subtitle: `${B} ilovasi va veb-saytidan foydalanish shartlari. Iltimos, xizmatdan foydalanishdan oldin diqqat bilan o'qib chiqing.`,
  updatedLabel: "Oxirgi yangilanish",
  updatedValue: "23-iyul, 2026",
  contactTitle: "11. Bog'lanish",
  contactIntro: "Ushbu shartlar bo'yicha savollaringiz bo'lsa, biz bilan bog'laning:",
  emailLabel: "Email",
  websiteLabel: "Veb-sayt",
  crossLinkLabel: "Maxfiylik siyosati",
  rightsReserved: "Barcha huquqlar himoyalangan.",
  sections: [
    {
      title: "1. Kirish",
      blocks: [
        {
          kind: "text",
          text: `${B} — Mukammal Media Group tomonidan taqdim etiladigan o'zbek adabiyoti platformasi. ${B} ilovasi yoki veb-saytidan foydalanish orqali siz ushbu Foydalanish shartlariga rozilik bildirasiz. Agar shartlarga rozi bo'lmasangiz, xizmatdan foydalanmang.`,
        },
      ],
    },
    {
      title: "2. Akkaunt",
      blocks: [
        {
          kind: "list",
          items: [
            "Xizmatning ayrim imkoniyatlaridan foydalanish uchun akkaunt yaratishingiz kerak;",
            "Akkaunt ma'lumotlaringiz to'g'ri va dolzarb bo'lishi kerak;",
            "Akkauntingiz xavfsizligi va undagi barcha harakatlar uchun siz javobgarsiz;",
            "Ruxsatsiz foydalanishni aniqlasangiz, bizni darhol xabardor qiling.",
          ],
        },
      ],
    },
    {
      title: "3. Xizmatdan foydalanish",
      blocks: [
        { kind: "text", text: "Xizmatdan qonuniy maqsadlarda foydalaning. Quyidagilar taqiqlanadi:" },
        {
          kind: "list",
          items: [
            "Qonunni yoki uchinchi tomon huquqlarini buzadigan harakatlar;",
            "Platforma yoki boshqa foydalanuvchilarga zarar yetkazish, spam yoki firibgarlik;",
            "Kontentni ruxsatsiz nusxalash, tarqatish yoki qayta sotish;",
            "Xizmat xavfsizligini buzishga urinish yoki tizimga aralashish.",
          ],
        },
      ],
    },
    {
      title: "4. Kontent va intellektual mulk",
      blocks: [
        {
          kind: "text",
          text: `Platformadagi kitoblar, audio, maqolalar va boshqa materiallar mualliflar, nashriyotlar yoki ${B} ning intellektual mulki hisoblanadi va tegishli qonunlar bilan himoyalangan. Sotib olingan yoki ruxsat berilgan kontentdan faqat shaxsiy foydalanish uchun foydalanishingiz mumkin.`,
        },
      ],
    },
    {
      title: "5. Foydalanuvchi yaratgan kontent",
      blocks: [
        {
          kind: "text",
          text: "Siz joylashtirgan post, sharh va ijodiy materiallar uchun siz javobgarsiz. Bunday kontentni platformada ko'rsatish uchun bizga ruxsat berasiz. Biz shartlarni buzadigan yoki noqonuniy kontentni olib tashlash huquqini saqlab qolamiz.",
        },
      ],
    },
    {
      title: "6. To'lovlar va xaridlar",
      blocks: [
        {
          kind: "list",
          items: [
            "Pullik kontent narxi ilova yoki veb-saytda ko'rsatiladi;",
            "To'lovlar ishonchli to'lov provayderlari orqali amalga oshiriladi; karta ma'lumotlari ilovada saqlanmaydi;",
            "Xarid muvaffaqiyatli bo'lgach, tegishli kontentga kirish huquqi (entitlement) beriladi;",
            "Qaytarish (refund) tegishli qonunlar va provayder qoidalariga muvofiq ko'rib chiqiladi.",
          ],
        },
      ],
    },
    {
      title: "7. Uchinchi tomon xizmatlari",
      blocks: [
        {
          kind: "text",
          text: "Xizmat Google Sign-In, Apple Sign-In va to'lov provayderlari kabi uchinchi tomon xizmatlaridan foydalanadi. Bunday xizmatlardan foydalanish ularning shartlari va siyosatlariga ham bo'ysunadi.",
        },
      ],
    },
    {
      title: "8. Mas'uliyatni cheklash",
      blocks: [
        {
          kind: "text",
          text: `Xizmat \"mavjud holatda\" (as is) taqdim etiladi. Qonun ruxsat bergan darajada, ${B} xizmatdan foydalanish natijasida yuzaga kelishi mumkin bo'lgan bilvosita yoki tasodifiy zararlar uchun javobgar bo'lmaydi. Biz xizmatning uzluksiz yoki xatosiz ishlashini kafolatlamaymiz.`,
        },
      ],
    },
    {
      title: "9. Shartlarni o'zgartirish",
      blocks: [
        {
          kind: "text",
          text: "Biz ushbu shartlarni vaqti-vaqti bilan yangilashimiz mumkin. Muhim o'zgarishlar bo'lsa, ilova yoki veb-sayt orqali xabar beramiz. Yangilanishdan keyin xizmatdan foydalanishni davom ettirish yangi shartlarga rozilik hisoblanadi.",
        },
      ],
    },
    {
      title: "10. Akkauntni to'xtatish",
      blocks: [
        {
          kind: "text",
          text: "Ushbu shartlar buzilgan taqdirda, biz akkauntga kirishni to'xtatish yoki bekor qilish huquqini saqlab qolamiz. Siz istalgan vaqtda akkauntingizni o'chirishingiz mumkin.",
        },
      ],
    },
  ],
};

const EN: LegalContent = {
  title: "Terms of Service",
  subtitle: `Terms for using the ${B} app and website. Please read them carefully before using the service.`,
  updatedLabel: "Last updated",
  updatedValue: "23 July 2026",
  contactTitle: "11. Contact",
  contactIntro: "If you have any questions about these Terms, please contact us:",
  emailLabel: "Email",
  websiteLabel: "Website",
  crossLinkLabel: "Privacy Policy",
  rightsReserved: "All rights reserved.",
  sections: [
    {
      title: "1. Introduction",
      blocks: [
        {
          kind: "text",
          text: `${B} is an Uzbek literature platform provided by Mukammal Media Group. By using the ${B} app or website, you agree to these Terms of Service. If you do not agree, please do not use the service.`,
        },
      ],
    },
    {
      title: "2. Account",
      blocks: [
        {
          kind: "list",
          items: [
            "You must create an account to use certain features of the service;",
            "Your account information must be accurate and up to date;",
            "You are responsible for the security of your account and all activity under it;",
            "Notify us immediately if you detect any unauthorised use.",
          ],
        },
      ],
    },
    {
      title: "3. Use of the service",
      blocks: [
        { kind: "text", text: "Use the service only for lawful purposes. The following are prohibited:" },
        {
          kind: "list",
          items: [
            "Any activity that violates the law or the rights of third parties;",
            "Harming the platform or other users, spam or fraud;",
            "Copying, distributing or reselling content without authorisation;",
            "Attempting to breach the security of, or interfere with, the service.",
          ],
        },
      ],
    },
    {
      title: "4. Content and intellectual property",
      blocks: [
        {
          kind: "text",
          text: `Books, audio, articles and other materials on the platform are the intellectual property of their authors, publishers or ${B}, and are protected by applicable law. You may use purchased or granted content for personal use only.`,
        },
      ],
    },
    {
      title: "5. User-generated content",
      blocks: [
        {
          kind: "text",
          text: "You are responsible for the posts, comments and creative works you publish. You grant us permission to display such content on the platform. We reserve the right to remove content that violates these Terms or is unlawful.",
        },
      ],
    },
    {
      title: "6. Payments and purchases",
      blocks: [
        {
          kind: "list",
          items: [
            "Prices for paid content are shown in the app or on the website;",
            "Payments are processed through trusted payment providers; card details are not stored in the app;",
            "Once a purchase succeeds, access to the corresponding content (an entitlement) is granted;",
            "Refunds are handled in accordance with applicable law and provider rules.",
          ],
        },
      ],
    },
    {
      title: "7. Third-party services",
      blocks: [
        {
          kind: "text",
          text: "The service uses third-party services such as Google Sign-In, Apple Sign-In and payment providers. Your use of those services is also subject to their own terms and policies.",
        },
      ],
    },
    {
      title: "8. Limitation of liability",
      blocks: [
        {
          kind: "text",
          text: `The service is provided \"as is\". To the extent permitted by law, ${B} is not liable for any indirect or incidental damages arising from your use of the service. We do not guarantee that the service will be uninterrupted or error-free.`,
        },
      ],
    },
    {
      title: "9. Changes to the terms",
      blocks: [
        {
          kind: "text",
          text: "We may update these Terms from time to time. If we make material changes, we will notify you through the app or website. Continuing to use the service after an update constitutes acceptance of the new terms.",
        },
      ],
    },
    {
      title: "10. Suspension",
      blocks: [
        {
          kind: "text",
          text: "We reserve the right to suspend or terminate access if these Terms are violated. You may delete your account at any time.",
        },
      ],
    },
  ],
};

/**
 * /terms — AdabiyotX bilingual (UZ/EN) Foydalanish shartlari / Terms of
 * Service. Public legal page reachable at https://adabiyotx.uz/terms; linked
 * from the privacy page and the web footer.
 */
export default function TermsOfService() {
  return <LegalDocument uz={UZ} en={EN} crossLinkHref="/privacy" />;
}
