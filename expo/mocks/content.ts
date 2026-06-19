export type Category =
  | "Hikoya"
  | "Roman"
  | "She'r"
  | "Qo'llanma"
  | "Darslik"
  | "Ertak"
  | "Ssenariy"
  | "Qissa";

export type ArticleCategory =
  | "Tarix"
  | "Texnologiya"
  | "Huquq"
  | "Amaliy qo'llanma"
  | "Tahlil"
  | "Jamiyat"
  | "Media"
  | "Boshqa";

export interface Author {
  id: string;
  name: string;
  photo: string;
  bio: string;
  followers: number;
  reads: number;
  works: string[];
}

export interface Publisher {
  id: string;
  name: string;
  logo: string;
  about: string;
}

export interface Book {
  id: string;
  title: string;
  authorId: string;
  publisherId: string;
  cover: string;
  category: Category;
  description: string;
  excerpt: string;
  rating: number;
  price: number;
  free: boolean;
  audioAvailable: boolean;
  trending?: boolean;
}

export interface Reel {
  id: string;
  title: string;
  authorId: string;
  publisherId: string;
  description: string;
  fullDescription: string;
  poster: string;
  video: string;
  likes: number;
  comments: number;
  relatedBookId?: string;
}

export type ArticleBlock =
  | { id: string; type: "title"; text: string; level?: 2 | 3 }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; image: string; caption?: string }
  | {
      id: string;
      type: "imagePair";
      images: Array<{ image: string; caption?: string }>;
    }
  | {
      id: string;
      type: "video";
      title: string;
      description?: string;
      thumbnail: string;
      duration?: string;
      url: string;
    }
  | { id: string; type: "quote"; text: string; author?: string }
  | {
      id: string;
      type: "audio";
      title: string;
      description?: string;
      duration: string;
      cover?: string;
      url: string;
    }
  | {
      id: string;
      type: "file";
      title: string;
      description?: string;
      fileName: string;
      size: string;
      format: string;
      url: string;
    }
  | { id: string; type: "highlight"; title?: string; text: string }
  | { id: string; type: "divider" }
  | { id: string; type: "numberedList"; items: string[] }
  | { id: string; type: "bulletList"; items: string[] }
  | {
      id: string;
      type: "table";
      headers: string[];
      rows: string[][];
    };

export interface ArticleUsageTerm {
  label: string;
  value: string;
}

export interface Article {
  id: string;
  title: string;
  author: string;
  authorRole: string;
  category: ArticleCategory;
  cover: string;
  description: string;
  previewSnippet: string;
  readingTime: string;
  publishedAt: string;
  price: number;
  reads: number;
  popularity: number;
  usefulness: number;
  usageTerms: ArticleUsageTerm[];
  blocks: ArticleBlock[];
}

export type ScreenplayImageKey =
  | "yomgir-scene-1"
  | "yomgir-scene-2"
  | "yomgir-scene-3"
  | "yomgir-scene-4";

export interface ScreenplayMusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  mood: string;
  cover: string;
}

export interface ScreenplayLine {
  id: string;
  type: "action" | "character" | "dialogue" | "parenthetical" | "transition";
  text: string;
}

export interface ScreenplayScene {
  id: string;
  number: number;
  title: string;
  identifier: "INT" | "EXT";
  location: string;
  time: string;
  imageKey: ScreenplayImageKey;
  mood: string;
  stagingNote: string;
  lines: ScreenplayLine[];
}

export interface ScreenplayReview {
  id: string;
  name: string;
  role: string;
  rating: number;
  text: string;
}

export interface Screenplay {
  id: string;
  title: string;
  authorId: string;
  publisherId: string;
  genre: string;
  readTime: string;
  duration: string;
  readers: number;
  saved: number;
  rating: number;
  ageLimit: string;
  publishedAt: string;
  logline: string;
  certificate: string;
  usageRights: string;
  usagePrice: string;
  recommendedMusic: ScreenplayMusicTrack[];
  backgroundMusic: ScreenplayMusicTrack[];
  scenes: ScreenplayScene[];
  reviews: ScreenplayReview[];
  relatedBookIds: string[];
}

export const authors: Author[] = [
  {
    id: "a1",
    name: "Nodira Karimova",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
    bio:
      "Zamonaviy o'zbek nasrining yorqin vakili. Uning asarlari inson qalbining nozik qirralarini ochib beradi va bugungi kun ayolining ichki dunyosini badiiy tilda aks ettiradi.",
    followers: 48230,
    reads: 1240000,
    works: ["b1", "b4"],
  },
  {
    id: "a2",
    name: "Sardor Rashidov",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
    bio:
      "Shoir va ssenarist. She'rlarida zamonaviy shahar hayoti, yolg'izlik va sevgi mavzulari o'ziga xos ohangda yangraydi.",
    followers: 72100,
    reads: 2100000,
    works: ["b2", "b6"],
  },
  {
    id: "a3",
    name: "Malika Yusupova",
    photo: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400",
    bio:
      "Bolalar adabiyoti va ertaklar muallifi. Uning ijodi zamonaviy o'zbek bolalar adabiyotiga yangi nafas olib kirdi.",
    followers: 31500,
    reads: 680000,
    works: ["b3"],
  },
  {
    id: "a4",
    name: "Jasur Eshonqulov",
    photo: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400",
    bio:
      "Roman va qissa ustasi. Tarix va zamonaviylik chegarasidagi asarlari kitobxonlarni o'ziga rom qilib keladi.",
    followers: 58900,
    reads: 1520000,
    works: ["b5", "b7"],
  },
  {
    id: "a5",
    name: "Dilnoza Abdullayeva",
    photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400",
    bio:
      "She'riyatda o'z yo'liga ega zamonaviy shoira. She'rlari minglab yoshlarning sevimli satrlariga aylangan.",
    followers: 94300,
    reads: 3100000,
    works: ["b8"],
  },
  {
    id: "a6",
    name: "Komil Mirsaidov",
    photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400",
    bio:
      "Dramaturg va ssenarist. Uning matnlari shahar xotirasi, ichki dialog va sokin ziddiyatlarni kino tiliga yaqin ohangda beradi.",
    followers: 38600,
    reads: 860000,
    works: ["b9"],
  },
];

export const publishers: Publisher[] = [
  {
    id: "p1",
    name: "Akademnashr",
    logo: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=200",
    about: "Zamonaviy adabiyotning yetakchi nashriyoti.",
  },
  {
    id: "p2",
    name: "Yangi Asr Avlodi",
    logo: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=200",
    about: "Yoshlar uchun zamonaviy adabiyot.",
  },
  {
    id: "p3",
    name: "Sharq Nashriyoti",
    logo: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=200",
    about: "Klassik va zamonaviy asarlarni birlashtiruvchi nashriyot.",
  },
  {
    id: "p4",
    name: "Adabiyot AI Studio",
    logo: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=200",
    about: "Adabiyot, audio va ekran asarlarini birlashtiruvchi ijodiy studiya.",
  },
];

export const books: Book[] = [
  {
    id: "b1",
    title: "Sukunat Ovozi",
    authorId: "a1",
    publisherId: "p1",
    cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800",
    category: "Roman",
    description:
      "Toshkent ko'chalari zamiridagi sukunatni eshitgan ayolning hikoyasi. Har bir sahifa yuragingizda o'z aksini qoldiradi.",
    excerpt:
      "Tun yarmida shahar uxlar, faqat men uyg'oqman. Derazadan tushayotgan chiroq nuri xonani oltin rangga bo'yaydi. Qo'limda — kitob. Kitobda — men o'zim.",
    rating: 4.8,
    price: 49000,
    free: false,
    audioAvailable: true,
    trending: true,
  },
  {
    id: "b2",
    title: "Shaharda Yolg'iz",
    authorId: "a2",
    publisherId: "p2",
    cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800",
    category: "She'r",
    description:
      "Zamonaviy shahar hayotining she'riy kundaligi. Yolg'izlik, sevgi va topilmagan javoblar haqida.",
    excerpt:
      "Men bu shaharda yolg'iz emasman,\nammo hech kim meni tanimaydi.\nHar bir deraza — bir hikoya,\nhar bir chiroq — bir yurak.",
    rating: 4.9,
    price: 0,
    free: true,
    audioAvailable: true,
    trending: true,
  },
  {
    id: "b3",
    title: "Oy Bolasi",
    authorId: "a3",
    publisherId: "p2",
    cover: "https://images.unsplash.com/photo-1476234251651-f353703a034d?w=800",
    category: "Ertak",
    description:
      "Osmondagi oydan tushgan bolakay va uning sehrli sayohati. Bolalar va kattalar uchun.",
    excerpt: "Bir zamonlar oyda kichkina bolakay yashar ekan...",
    rating: 4.7,
    price: 25000,
    free: false,
    audioAvailable: true,
  },
  {
    id: "b4",
    title: "Kuz Xatlari",
    authorId: "a1",
    publisherId: "p1",
    cover: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=800",
    category: "Hikoya",
    description: "O'n ikki oyga bag'ishlangan o'n ikki hikoyadan iborat to'plam.",
    excerpt: "Sentyabr keldi. Uning keladigan kuni hammasi boshqacha edi.",
    rating: 4.6,
    price: 35000,
    free: false,
    audioAvailable: false,
  },
  {
    id: "b5",
    title: "Qora Daryo",
    authorId: "a4",
    publisherId: "p3",
    cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800",
    category: "Qissa",
    description:
      "Yigirmanchi asr boshidagi bir qishloq haqida tarixiy qissa. Inson taqdirlari daryo kabi oqadi.",
    excerpt:
      "Qora daryo tunda oqardi. Uning suvi hech kimga tegishli emas edi, ammo har kim undan o'z taqdirini ko'rardi.",
    rating: 4.9,
    price: 59000,
    free: false,
    audioAvailable: true,
    trending: true,
  },
  {
    id: "b6",
    title: "Yomg'ir Ostida",
    authorId: "a2",
    publisherId: "p2",
    cover: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
    category: "She'r",
    description: "Yomg'ir, sevgi va yolg'izlik haqida qirq she'r.",
    excerpt: "Yomg'ir yog'ardi. Men seni kutardim, ammo sen kelmading.",
    rating: 4.8,
    price: 29000,
    free: false,
    audioAvailable: true,
  },
  {
    id: "b7",
    title: "Tun Kitobi",
    authorId: "a4",
    publisherId: "p3",
    cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800",
    category: "Roman",
    description:
      "Tun — har kimning o'z kitobi. Bu roman ham ko'plab taqdirlarni o'ziga sig'dirgan.",
    excerpt: "Tun keldi, lekin u hech kimga tegishli emas edi.",
    rating: 4.7,
    price: 45000,
    free: false,
    audioAvailable: false,
  },
  {
    id: "b8",
    title: "Yurak Tilida",
    authorId: "a5",
    publisherId: "p1",
    cover: "https://images.unsplash.com/photo-1474366521946-c3d4b507abf2?w=800",
    category: "She'r",
    description:
      "Yurakning o'z tili bor. Bu kitob — shu til lug'atidan bir varaq.",
    excerpt:
      "Yurak tilida gapiring,\ntushunmasalar ham,\nbir kuni eshitadilar.",
    rating: 5.0,
    price: 0,
    free: true,
    audioAvailable: true,
    trending: true,
  },
  {
    id: "b9",
    title: "Yomg'ir Soyasida",
    authorId: "a6",
    publisherId: "p4",
    cover: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
    category: "Ssenariy",
    description:
      "Yomg'irli Toshkentda yo'qolgan xat, eski kinoteatr va tugallanmagan ssenariy atrofida kechadigan psixologik drama.",
    excerpt:
      "INT. XONA - TUN. Deraza ortida yomg'ir. Aziz qo'lidagi xatni o'qiydi, lekin oxirgi satrga kelganda chiroq miltillab o'chadi.",
    rating: 4.9,
    price: 79000,
    free: false,
    audioAvailable: true,
    trending: true,
  },
];

export const screenplays: Screenplay[] = [
  {
    id: "b9",
    title: "Yomg'ir Soyasida",
    authorId: "a6",
    publisherId: "p4",
    genre: "Psixologik drama",
    readTime: "48 daqiqa",
    duration: "38 daqiqa",
    readers: 18340,
    saved: 4200,
    rating: 4.9,
    ageLimit: "16+",
    publishedAt: "2026",
    logline:
      "Yosh ssenarist Aziz eski xat orqali otasining tugallanmagan filmiga qaytadi va har bir sahna uni o'z xotirasi bilan yuzlashtiradi.",
    certificate: "Mualliflik sertifikati mavjud",
    usageRights: "Ekranlashtirish va sahnalashtirish uchun alohida kelishuv talab qilinadi.",
    usagePrice: "12 000 000 so'mdan boshlanadi",
    recommendedMusic: [
      {
        id: "rm1",
        title: "Deraza ortidagi tun",
        artist: "OhangLab Studio",
        duration: "03:42",
        mood: "Dramatik",
        cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200",
      },
      {
        id: "rm2",
        title: "Eski kinoteatr valsi",
        artist: "Dilshod Nur",
        duration: "02:58",
        mood: "Nostalgiya",
        cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200",
      },
      {
        id: "rm3",
        title: "Yashil eshik",
        artist: "Mavj Collective",
        duration: "04:10",
        mood: "Sirli",
        cover: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=200",
      },
    ],
    backgroundMusic: [
      {
        id: "bm1",
        title: "Dramatik fon",
        artist: "OhangLab Ambience",
        duration: "18:00",
        mood: "Past pianino",
        cover: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=200",
      },
      {
        id: "bm2",
        title: "Sirli atmosfera",
        artist: "OhangLab Ambience",
        duration: "21:30",
        mood: "Yomg'ir va shahar",
        cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=200",
      },
      {
        id: "bm3",
        title: "Romantik pianino",
        artist: "OhangLab Ambience",
        duration: "16:45",
        mood: "Yumshoq",
        cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=200",
      },
      {
        id: "bm4",
        title: "Psixologik ambience",
        artist: "OhangLab Ambience",
        duration: "24:00",
        mood: "Ichki monolog",
        cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=200",
      },
    ],
    scenes: [
      {
        id: "sc1",
        number: 1,
        title: "Oxirgi satr",
        identifier: "INT",
        location: "Azizning xonasi",
        time: "Tun",
        imageKey: "yomgir-scene-1",
        mood: "Sokin, ichki ziddiyat",
        stagingNote:
          "Kamera derazadagi yomg'ir tomchilaridan Azizning qo'lidagi xatga sekin o'tadi.",
        lines: [
          {
            id: "sc1-l1",
            type: "action",
            text: "Deraza ortida yomg'ir tinmaydi. Stol lampasi ostida sahifalar, eski magnitofon va yarim ochiq xat yotibdi.",
          },
          { id: "sc1-l2", type: "character", text: "AZIZ" },
          {
            id: "sc1-l3",
            type: "dialogue",
            text: "Ota, bu filmni nega tugatmagansiz?",
          },
          {
            id: "sc1-l4",
            type: "parenthetical",
            text: "(xatdagi so'nggi jumlani qayta o'qiydi)",
          },
          {
            id: "sc1-l5",
            type: "action",
            text: "Chiroq bir lahza miltillaydi. Xatning pastida faqat bitta so'z qolgan: kechir.",
          },
        ],
      },
      {
        id: "sc2",
        number: 2,
        title: "Kinoteatr foyesi",
        identifier: "INT",
        location: "Eski kinoteatr",
        time: "Kecha",
        imageKey: "yomgir-scene-2",
        mood: "Sirli uchrashuv",
        stagingNote:
          "Yomg'ir oynada aks etadi. Qahramonlar orasidagi masofa dialogdan ko'ra ko'proq gapiradi.",
        lines: [
          {
            id: "sc2-l1",
            type: "action",
            text: "Foye bo'm-bo'sh. Yashil kreslolar, nam pol va kassada qolib ketgan bitta chipta.",
          },
          { id: "sc2-l2", type: "character", text: "MUNISA" },
          {
            id: "sc2-l3",
            type: "dialogue",
            text: "U ssenariyni sotmagan. U uni yashirgan.",
          },
          { id: "sc2-l4", type: "character", text: "AZIZ" },
          {
            id: "sc2-l5",
            type: "dialogue",
            text: "Demak, oxiri hali bor.",
          },
          { id: "sc2-l6", type: "transition", text: "QORA EKRANGA KESISH." },
        ],
      },
      {
        id: "sc3",
        number: 3,
        title: "Yashil eshik",
        identifier: "EXT",
        location: "Mahalla ko'chasi",
        time: "Tong",
        imageKey: "yomgir-scene-3",
        mood: "Xotira va tanlov",
        stagingNote:
          "Tong yorug'i juda mayin. Qahramon qadam tashlagan sari shahar uyg'onadi.",
        lines: [
          {
            id: "sc3-l1",
            type: "action",
            text: "Nam tosh yo'l bo'ylab Munisa sekin yuradi. Qo'lidagi sahifalar shamolda titraydi.",
          },
          { id: "sc3-l2", type: "character", text: "MUNISA" },
          {
            id: "sc3-l3",
            type: "dialogue",
            text: "Ba'zi sahnalar yozilmaydi, Aziz. Ular yashab o'tiladi.",
          },
          {
            id: "sc3-l4",
            type: "action",
            text: "U yashil eshik oldida to'xtaydi. Eshik ortidan eski musiqa eshitiladi.",
          },
        ],
      },
      {
        id: "sc4",
        number: 4,
        title: "Rejissyor rejimi",
        identifier: "INT",
        location: "Ijodiy studiya",
        time: "Kunduz",
        imageKey: "yomgir-scene-4",
        mood: "Yakuniy repetitsiya",
        stagingNote:
          "Sahna bloklari aniq ajratiladi. Rejissyor qahramonlar orasidagi sukutni boshqaradi.",
        lines: [
          {
            id: "sc4-l1",
            type: "action",
            text: "Studiya bo'sh. Polda sahifalar, markazda bitta stul. Aziz va Munisa matnni ovozsiz o'qishadi.",
          },
          { id: "sc4-l2", type: "character", text: "REJISSYOR" },
          {
            id: "sc4-l3",
            type: "dialogue",
            text: "Sukutni qisqartirmang. Tomoshabin shu joyda nafas oladi.",
          },
          { id: "sc4-l4", type: "character", text: "AZIZ" },
          {
            id: "sc4-l5",
            type: "dialogue",
            text: "Unda oxirgi sahifani o'zim yozaman.",
          },
          { id: "sc4-l6", type: "transition", text: "FADE OUT." },
        ],
      },
    ],
    reviews: [
      {
        id: "sr1",
        name: "Madinabonu Qodirova",
        role: "O'quvchi",
        rating: 5,
        text: "Sahna rasmlari va fon musiqasi bilan o'qish juda tabiiy kino tajribasiga aylandi.",
      },
      {
        id: "sr2",
        name: "Shavkat Ergashev",
        role: "Rejissyor",
        rating: 5,
        text: "Dialoglar tartibi aniq, personajlar ajratilishi repetitsiya uchun ham qulay.",
      },
      {
        id: "sr3",
        name: "Lola Saidova",
        role: "Muharrir",
        rating: 4,
        text: "Premium reader sozlamalari uzun o'qishda ko'zga yengil tushadi.",
      },
    ],
    relatedBookIds: ["b5", "b1", "b6", "b8"],
  },
];

export const articleCategories: ArticleCategory[] = [
  "Tarix",
  "Texnologiya",
  "Huquq",
  "Amaliy qo'llanma",
  "Tahlil",
  "Jamiyat",
  "Media",
  "Boshqa",
];

export const articles: Article[] = [
  {
    id: "ma1",
    title: "Isroil mamlakatining asl tarixi: davlat, zamin va mojaro ildizlari",
    author: "Azizbek Rahimov",
    authorRole: "Tarixiy tahlilchi",
    category: "Tarix",
    cover: "https://images.unsplash.com/photo-1542743408-218cc173cda0?w=1400",
    description:
      "Isroil davlati qanday shakllanganini diniy rivoyatlar, Usmonli davri, Britaniya mandati, BMT qarori va zamonaviy siyosiy jarayonlar kesimida tushuntiradigan xolis longread.",
    previewSnippet:
      "Bu mavzu ko'pincha shiorlar orqali tushuntiriladi. Aslida esa Isroil tarixini tushunish uchun diniy xotira, imperiyalar siyosati, ko'chish to'lqinlari va xalqaro huquq birga o'qilishi kerak.",
    readingTime: "22 daqiqa",
    publishedAt: "2026-05-18",
    price: 69000,
    reads: 42800,
    popularity: 96,
    usefulness: 94,
    usageTerms: [
      { label: "Shaxsiy foydalanish", value: "Ruxsat etiladi" },
      { label: "Tijorat maqsadida", value: "Muallif roziligi bilan" },
      { label: "Iqtibos bilan foydalanish", value: "Manba ko'rsatilsa mumkin" },
      { label: "Muallif roziligi", value: "To'liq qayta nashr uchun talab etiladi" },
    ],
    blocks: [
      {
        id: "ma1-b1",
        type: "paragraph",
        text:
          "Isroil tarixini bitta sana yoki bitta voqea bilan tushuntirib bo'lmaydi. Bu hudud diniy xotira, savdo yo'llari, imperiyalar almashinuvi, milliy uyg'onish va XX asr xalqaro diplomatiyasi kesishgan joyda shakllangan.",
      },
      {
        id: "ma1-b2",
        type: "highlight",
        title: "Asosiy fikr",
        text:
          "Mojaroning ildizini tushunish uchun ikki savolni ajratish kerak: tarixiy da'vo nimaga tayanadi va zamonaviy davlat qanday huquqiy-siyosiy jarayonda paydo bo'lgan?",
      },
      { id: "ma1-b3", type: "title", text: "Qadimgi qatlam: zamin va xotira" },
      {
        id: "ma1-b4",
        type: "paragraph",
        text:
          "Yahudiy xalqining qadimgi tarixiy xotirasi Quddus, Yahudiya va Isroil podsholiklari atrofida shakllangan. Bu xotira diniy matnlar, arxeologik izlanishlar va ko'p asrlik diasporadagi an'analar orqali saqlanib kelgan.",
      },
      {
        id: "ma1-b5",
        type: "image",
        image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1400",
        caption: "Quddus hududi asrlar davomida din, siyosat va savdo yo'llari markazida bo'lgan.",
      },
      { id: "ma1-b6", type: "title", text: "Usmonli davridan Britaniya mandatigacha" },
      {
        id: "ma1-b7",
        type: "paragraph",
        text:
          "XIX asr oxiriga kelib hudud Usmonli imperiyasi tarkibida edi. Shu davrda Yevropada millatchilik kuchaydi, antisemitizm esa yahudiy ziyolilarini xavfsiz milliy uy g'oyasi haqida o'ylashga majbur qildi. Sionizm shu tarixiy muhitda siyosiy harakatga aylandi.",
      },
      {
        id: "ma1-b8",
        type: "quote",
        text:
          "Tarixiy nizoni tushunish uchun taraflarning faqat bugungi talablarini emas, ular o'zini qaysi xotira orqali anglashini ham ko'rish kerak.",
        author: "Adabiyot AI tahririyati",
      },
      {
        id: "ma1-b9",
        type: "numberedList",
        items: [
          "Usmonli davrida hudud turli viloyat va sanjoqlar orqali boshqarilgan.",
          "Birinchi jahon urushidan keyin Britaniya mandati o'rnatildi.",
          "Yahudiy va arab milliy harakatlari bir hudud ustida turli siyosiy kelajak tasavvur qildi.",
          "1947-yilda BMT bo'linish rejasini taklif qildi.",
        ],
      },
      {
        id: "ma1-b10",
        type: "table",
        headers: ["Davr", "Nima yuz berdi", "Nega muhim"],
        rows: [
          ["1517-1917", "Usmonli boshqaruvi", "Hudud imperiya tizimida boshqarildi"],
          ["1917", "Balfur deklaratsiyasi", "Yahudiy milliy uyi g'oyasi diplomatik hujjatda ko'rindi"],
          ["1920-1948", "Britaniya mandati", "Immigratsiya, yer va xavfsizlik masalalari keskinlashdi"],
          ["1948", "Isroil davlati e'lon qilindi", "Zamonaviy davlat va urush davri boshlandi"],
        ],
      },
      { id: "ma1-b11", type: "divider" },
      { id: "ma1-b12", type: "title", text: "Bugungi bahsga qanday qarash kerak?" },
      {
        id: "ma1-b13",
        type: "paragraph",
        text:
          "Bugungi Isroil-Falastin masalasi tarixiy xotiradan tashqari xavfsizlik, yer egaligi, qochqinlar, xalqaro tan olinishi va inson huquqlari kabi alohida qatlamlarga ega. Har bir qatlamni alohida ko'rish hissiy shiorlardan ko'ra aniqroq tushuncha beradi.",
      },
      {
        id: "ma1-b14",
        type: "video",
        title: "Xarita orqali tarixiy bosqichlar",
        description: "Mandat davri, bo'linish rejasi va keyingi urushlar xaritada ko'rsatilgan izohli video.",
        thumbnail: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200",
        duration: "08:40",
        url: "https://example.com/videos/isroil-tarixi",
      },
      {
        id: "ma1-b15",
        type: "file",
        title: "Sana va atamalar jadvali",
        description: "Maqolada ishlatilgan asosiy tarixiy sanalar, shaxslar va atamalar.",
        fileName: "isroil-tarixi-atamalar.pdf",
        size: "1.8 MB",
        format: "PDF",
        url: "https://example.com/files/isroil-tarixi-atamalar.pdf",
      },
    ],
  },
  {
    id: "ma2",
    title: "Migingo oroli: nega bu kichik joy hamon odamlarga kerak?",
    author: "Dilshod Qodirov",
    authorRole: "Geosiyosat sharhlovchisi",
    category: "Jamiyat",
    cover: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1400",
    description:
      "Viktoriya ko'lidagi juda kichik, lekin iqtisodiy jihatdan muhim Migingo oroli nega baliqchilar, chegarachilar va siyosatchilar e'tiborida qolayotganini tushuntiradi.",
    previewSnippet:
      "Migingo xaritada deyarli ko'rinmaydi, lekin uning atrofidagi suvlar minglab oilalar daromadi, chegara nazorati va resurslar boshqaruvi masalasini ochib beradi.",
    readingTime: "16 daqiqa",
    publishedAt: "2026-05-05",
    price: 49000,
    reads: 21300,
    popularity: 82,
    usefulness: 88,
    usageTerms: [
      { label: "Shaxsiy foydalanish", value: "Ruxsat etiladi" },
      { label: "Tijorat maqsadida", value: "Ruxsat etilmaydi" },
      { label: "Iqtibos bilan foydalanish", value: "Qisqa iqtibos mumkin" },
      { label: "Muallif roziligi", value: "Ta'limiy taqdimotlarda talab etilmaydi" },
    ],
    blocks: [
      {
        id: "ma2-b1",
        type: "paragraph",
        text:
          "Migingo oroli haqida qiziq narsa shuki, uning maydoni kichik bo'lsa ham, atrofidagi baliq ovlash zonasi juda qimmatli. Orolning qiymati yerning o'zida emas, suv, xavfsizlik va kundalik tirikchilik zanjirida.",
      },
      {
        id: "ma2-b2",
        type: "imagePair",
        images: [
          {
            image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900",
            caption: "Baliqchilik hudud iqtisodining asosi.",
          },
          {
            image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900",
            caption: "Ko'l chegaralari xaritadagidan murakkabroq ishlaydi.",
          },
        ],
      },
      { id: "ma2-b3", type: "title", text: "Nega kichik orol katta masalaga aylandi?" },
      {
        id: "ma2-b4",
        type: "bulletList",
        items: [
          "Atrofdagi suvlar baliqqa boy.",
          "Orol baliqchilar uchun qo'nish, saqlash va savdo nuqtasi bo'lib xizmat qiladi.",
          "Chegara masalasi soliqlar, patrul va ruxsatnomalarga ta'sir qiladi.",
          "Mahalliy odamlar uchun bu geosiyosat emas, kundalik non masalasi.",
        ],
      },
      {
        id: "ma2-b5",
        type: "highlight",
        title: "Amaliy saboq",
        text:
          "Resurs mojarolarida hududning kattaligi emas, undan olinadigan daromad va boshqaruv huquqi muhim bo'ladi.",
      },
      {
        id: "ma2-b6",
        type: "quote",
        text:
          "Kichik joylar ba'zan katta tizimlardagi muammoni kattalashtirib ko'rsatadigan lupa vazifasini bajaradi.",
      },
      {
        id: "ma2-b7",
        type: "audio",
        title: "Migingo bo'yicha qisqa audio izoh",
        description: "Maqolaning asosiy xulosalari 6 daqiqalik audio formatda.",
        duration: "06:12",
        cover: "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=600",
        url: "https://example.com/audio/migingo-izoh.mp3",
      },
      {
        id: "ma2-b8",
        type: "table",
        headers: ["Omil", "Kimga ta'sir qiladi", "Natija"],
        rows: [
          ["Baliq zaxirasi", "Baliqchilar va savdogarlar", "Daromad uchun raqobat kuchayadi"],
          ["Chegara nazorati", "Davlat idoralari", "Soliq va ruxsat tizimi bahsli bo'ladi"],
          ["Transport", "Mahalliy aholi", "Narx va xavfsizlikka ta'sir qiladi"],
        ],
      },
    ],
  },
  {
    id: "ma3",
    title: "Hakkerlik uslublari: tahdidlarni tushunish va himoyalanish",
    author: "Madina Sobirova",
    authorRole: "Kiberxavfsizlik maslahatchisi",
    category: "Texnologiya",
    cover: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1400",
    description:
      "Fishing, ijtimoiy muhandislik, zaif parollar va zararli ilovalar qanday ishlashini xavfsiz, himoyaviy nuqtai nazardan tushuntiradigan amaliy qo'llanma.",
    previewSnippet:
      "Hakkerlikni o'rganishning xavfsiz yo'li hujum qilishni emas, xavf modelini ko'rishni o'rgatadi. Maqola oddiy foydalanuvchi va kichik biznes uchun himoya tartibini beradi.",
    readingTime: "19 daqiqa",
    publishedAt: "2026-04-28",
    price: 79000,
    reads: 53600,
    popularity: 98,
    usefulness: 97,
    usageTerms: [
      { label: "Shaxsiy foydalanish", value: "Ruxsat etiladi" },
      { label: "Tijorat maqsadida", value: "Korporativ trening uchun alohida litsenziya kerak" },
      { label: "Iqtibos bilan foydalanish", value: "Manba ko'rsatilsa mumkin" },
      { label: "Muallif roziligi", value: "Metodik material sifatida ko'paytirish uchun talab etiladi" },
    ],
    blocks: [
      {
        id: "ma3-b1",
        type: "highlight",
        title: "Xavfsizlik chegarasi",
        text:
          "Bu maqola faqat himoyalanish, xavfni tanish va profilaktika uchun yozilgan. Unda begona tizimga kirish, zarar yetkazish yoki ruxsatsiz amaliyot bo'yicha ko'rsatma berilmaydi.",
      },
      {
        id: "ma3-b2",
        type: "paragraph",
        text:
          "Kiberxavfsizlikdagi eng katta xato murakkab texnik hujumlardan qo'rqib, oddiy himoya qoidalarini unutishdir. Ko'p hodisalar zaif parol, yolg'on havola, tasdiqlanmagan ilova yoki beparvo ruxsat orqali boshlanadi.",
      },
      { id: "ma3-b3", type: "title", text: "Eng ko'p uchraydigan tahdidlar" },
      {
        id: "ma3-b4",
        type: "numberedList",
        items: [
          "Fishing: foydalanuvchini yolg'on sahifa yoki xabar orqali aldash.",
          "Ijtimoiy muhandislik: ishonch, shoshilish yoki qo'rquvdan foydalanish.",
          "Parol qayta ishlatilishi: bitta parol bir nechta xizmatda ishlatilsa, xavf zanjir bo'lib tarqaladi.",
          "Zararli ilova: foydali ko'ringan dastur ortiqcha ruxsat so'raydi.",
        ],
      },
      {
        id: "ma3-b5",
        type: "image",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1400",
        caption: "Himoya rejasining birinchi bosqichi: qaysi aktivlar muhimligini aniqlash.",
      },
      {
        id: "ma3-b6",
        type: "table",
        headers: ["Xavf belgisi", "Nima qilish kerak", "Natija"],
        rows: [
          ["Shoshilinch to'lov so'rovi", "Ikkinchi kanal orqali tasdiqlash", "Aldov ehtimoli kamayadi"],
          ["Noma'lum havola", "Manzilni tekshirish va ochmaslik", "Fishingdan himoya"],
          ["Ortiqcha ruxsat so'ragan ilova", "Ruxsatlarni rad etish yoki o'chirish", "Ma'lumot chiqib ketishi kamayadi"],
          ["Bir xil parol", "Parol menejeri va 2FA", "Hisoblar zanjirli buzilmaydi"],
        ],
      },
      {
        id: "ma3-b7",
        type: "quote",
        text:
          "Yaxshi himoya murakkab sir emas. U takrorlanadigan kichik odatlar va aniq javob rejasidan boshlanadi.",
        author: "Madina Sobirova",
      },
      { id: "ma3-b8", type: "divider" },
      { id: "ma3-b9", type: "title", text: "7 kunlik himoya rejasi" },
      {
        id: "ma3-b10",
        type: "bulletList",
        items: [
          "1-kun: muhim hisoblar ro'yxatini tuzing.",
          "2-kun: parol menejeriga o'ting.",
          "3-kun: elektron pochta va bank hisoblarida ikki bosqichli tasdiqlashni yoqing.",
          "4-kun: qurilma yangilanishlarini tekshiring.",
          "5-kun: ilova ruxsatlarini qayta ko'rib chiqing.",
          "6-kun: zaxira nusxa tartibini sozlang.",
          "7-kun: oilangiz yoki jamoangizga fishing belgilarini tushuntiring.",
        ],
      },
      {
        id: "ma3-b11",
        type: "file",
        title: "Kiberxavfsizlik tekshiruv ro'yxati",
        description: "Shaxsiy va kichik biznes hisoblari uchun 24 bandli checklist.",
        fileName: "kiberxavfsizlik-checklist.pdf",
        size: "720 KB",
        format: "PDF",
        url: "https://example.com/files/kiberxavfsizlik-checklist.pdf",
      },
    ],
  },
  {
    id: "ma4",
    title: "MacBook'ga elektron imzo o'rnatish: amaliy qo'llanma",
    author: "Shahnoza Ergasheva",
    authorRole: "Raqamli xizmatlar bo'yicha mutaxassis",
    category: "Amaliy qo'llanma",
    cover: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1400",
    description:
      "MacBook foydalanuvchilari uchun elektron raqamli imzo faylini tayyorlash, brauzer ruxsatlari, Java muhitini tekshirish va keng uchraydigan xatolarni bartaraf etish bo'yicha tartibli yo'riqnoma.",
    previewSnippet:
      "Ko'p muammo imzo faylida emas, MacBook'dagi ruxsatlar, brauzer sozlamalari yoki noto'g'ri papka joylashuvida bo'ladi. Qo'llanma tekshiruvni bosqichma-bosqich beradi.",
    readingTime: "14 daqiqa",
    publishedAt: "2026-05-25",
    price: 59000,
    reads: 48700,
    popularity: 91,
    usefulness: 99,
    usageTerms: [
      { label: "Shaxsiy foydalanish", value: "Ruxsat etiladi" },
      { label: "Tijorat maqsadida", value: "Ichki ish jarayonida foydalanish mumkin" },
      { label: "Iqtibos bilan foydalanish", value: "Manba ko'rsatilsa mumkin" },
      { label: "Muallif roziligi", value: "Kurs yoki pullik treningga kiritish uchun talab etiladi" },
    ],
    blocks: [
      {
        id: "ma4-b1",
        type: "paragraph",
        text:
          "Elektron imzo o'rnatishda avval kalit fayli, parol, brauzer va tizim ruxsatlari bir-biriga mos ekanini tekshirish kerak. MacBook'da xavfsizlik siyosati kuchli bo'lgani uchun ayrim dasturlar qo'shimcha ruxsat so'raydi.",
      },
      {
        id: "ma4-b2",
        type: "highlight",
        title: "Boshlashdan oldin",
        text:
          "Kalit parolini hech kimga bermang. Imzo faylini bulutli umumiy papkaga joylamang. Rasmiy manbadan olingan dastur va yo'riqnomalardan foydalaning.",
      },
      { id: "ma4-b3", type: "title", text: "Tayyorlov ro'yxati" },
      {
        id: "ma4-b4",
        type: "numberedList",
        items: [
          "Elektron imzo kalit fayli va parolini tayyorlang.",
          "MacBook operatsion tizimi yangilanganini tekshiring.",
          "Kerakli brauzerga ruxsatlar berilganini ko'ring.",
          "Agar xizmat Java muhitini talab qilsa, rasmiy manbadan o'rnatilganini tasdiqlang.",
          "Imzo modulini ishga tushirib, test orqali tekshiring.",
        ],
      },
      {
        id: "ma4-b5",
        type: "image",
        image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1400",
        caption: "Raqamli xizmatlar bilan ishlashda ruxsatlar va brauzer sozlamalari hal qiluvchi ahamiyatga ega.",
      },
      {
        id: "ma4-b6",
        type: "table",
        headers: ["Muammo", "Ehtimoliy sabab", "Tekshiruv"],
        rows: [
          ["Kalit ko'rinmayapti", "Fayl joyi noto'g'ri", "Kalitni lokal papkaga ko'chiring"],
          ["Brauzer modulni ochmayapti", "Ruxsat berilmagan", "Privacy va Security bo'limini tekshiring"],
          ["Parol xato deyapti", "Klaviatura tili yoki Caps Lock", "Kiritish tilini tekshiring"],
          ["Sahifa javob bermayapti", "Kesh yoki moslik muammosi", "Boshqa brauzerda sinab ko'ring"],
        ],
      },
      {
        id: "ma4-b7",
        type: "video",
        title: "MacBook'da ruxsatlarni tekshirish",
        description: "Security, Privacy va brauzer sozlamalarini tekshirish bo'yicha qisqa ko'rsatma.",
        thumbnail: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200",
        duration: "05:18",
        url: "https://example.com/videos/macbook-eri",
      },
      {
        id: "ma4-b8",
        type: "file",
        title: "MacBook ERI diagnostika jadvali",
        description: "Xatolarni ketma-ket tekshirish uchun chop etiladigan jadval.",
        fileName: "macbook-eri-diagnostika.pdf",
        size: "540 KB",
        format: "PDF",
        url: "https://example.com/files/macbook-eri-diagnostika.pdf",
      },
    ],
  },
  {
    id: "ma5",
    title: "Shartnomani o'qish san'ati: pul yo'qotmaslik uchun 12 band",
    author: "Feruza To'lqinova",
    authorRole: "Huquqiy amaliyot muharriri",
    category: "Huquq",
    cover: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1400",
    description:
      "Ijara, xizmat ko'rsatish, nashr, reklama yoki frilanser shartnomalarida e'tibor berilishi kerak bo'lgan xavfli bandlarni sodda tilda tushuntiradi.",
    previewSnippet:
      "Shartnomadagi eng xavfli gaplar ko'pincha mayda shrift bilan emas, oddiy ko'rinadigan muddat, jarima va javobgarlik bandlarida yashirinadi.",
    readingTime: "17 daqiqa",
    publishedAt: "2026-03-30",
    price: 65000,
    reads: 38200,
    popularity: 86,
    usefulness: 96,
    usageTerms: [
      { label: "Shaxsiy foydalanish", value: "Ruxsat etiladi" },
      { label: "Tijorat maqsadida", value: "Tashkilot ichida foydalanish mumkin" },
      { label: "Iqtibos bilan foydalanish", value: "Manba bilan ruxsat etiladi" },
      { label: "Muallif roziligi", value: "To'liq tarqatish uchun talab etiladi" },
    ],
    blocks: [
      {
        id: "ma5-b1",
        type: "paragraph",
        text:
          "Shartnoma tilini faqat yuristlar uchun deb o'ylash xavfli. Pul, muddat, natija, javobgarlik va bekor qilish tartibi sizga tegishli bo'lsa, hujjatni kamida asosiy xavf bandlari bo'yicha o'qiy olishingiz kerak.",
      },
      {
        id: "ma5-b2",
        type: "quote",
        text:
          "Yaxshi shartnoma ishonchsizlik belgisi emas. U kelishuv buzilganda ham ikki tomonga aniq yo'l ko'rsatadigan xaritadir.",
        author: "Feruza To'lqinova",
      },
      {
        id: "ma5-b3",
        type: "bulletList",
        items: [
          "To'lov sanasi va to'lov sharti bir xil narsa emas.",
          "Jarima bandlari real zarar bilan mutanosib bo'lishi kerak.",
          "Natija qabul qilish tartibi yozilmasa, ish tugaganini isbotlash qiyinlashadi.",
          "Bekor qilish sharti bir tomonlama zarar keltirmasligi kerak.",
        ],
      },
      {
        id: "ma5-b4",
        type: "file",
        title: "Shartnoma tekshiruv varaqasi",
        description: "Imzolashdan oldin tekshiriladigan 12 asosiy band.",
        fileName: "shartnoma-checklist.pdf",
        size: "680 KB",
        format: "PDF",
        url: "https://example.com/files/shartnoma-checklist.pdf",
      },
    ],
  },
];

export const reels: Reel[] = [
  {
    id: "r1",
    title: "Shaharda Yolg'iz",
    authorId: "a2",
    publisherId: "p2",
    description: "She'riy ijro — Toshkent tunlariga bag'ishlangan.",
    fullDescription:
      "Sardor Rashidovning \"Shaharda Yolg'iz\" to'plamidan. Shaharning tungi ovozi bilan o'qilgan she'r. Musiqa va tasvir bilan mujassam.",
    poster: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800",
    video:
      "https://videos.pexels.com/video-files/3209828/3209828-uhd_2560_1440_25fps.mp4",
    likes: 12400,
    comments: 340,
    relatedBookId: "b2",
  },
  {
    id: "r2",
    title: "Yurak Tilida",
    authorId: "a5",
    publisherId: "p1",
    description: "Dilnoza Abdullayeva she'rini o'qiydi.",
    fullDescription:
      "She'r yurakdan keladi. Dilnoza Abdullayevaning yangi to'plamidan birinchi ijro.",
    poster: "https://images.unsplash.com/photo-1499728603263-13726abce5fd?w=800",
    video:
      "https://videos.pexels.com/video-files/5752729/5752729-hd_1080_1920_30fps.mp4",
    likes: 28900,
    comments: 890,
    relatedBookId: "b8",
  },
  {
    id: "r3",
    title: "Qora Daryo — treyler",
    authorId: "a4",
    publisherId: "p3",
    description: "Yangi qissa uchun kino uslubidagi treyler.",
    fullDescription:
      "\"Qora Daryo\" qissasi asosida tayyorlangan kitob treyleri. Sharq Nashriyoti taqdimoti.",
    poster: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800",
    video:
      "https://videos.pexels.com/video-files/2022395/2022395-hd_1080_1920_30fps.mp4",
    likes: 8700,
    comments: 210,
    relatedBookId: "b5",
  },
  {
    id: "r4",
    title: "Yomg'ir Ostida",
    authorId: "a2",
    publisherId: "p2",
    description: "Yomg'irli kechada yozilgan she'r.",
    fullDescription:
      "\"Yomg'ir Ostida\" to'plamidan. Tomchilar va so'zlar. Musiqa — original kompozitsiya.",
    poster: "https://images.unsplash.com/photo-1468081410950-b7a5deaad11a?w=800",
    video:
      "https://videos.pexels.com/video-files/4625747/4625747-hd_1080_1920_30fps.mp4",
    likes: 15600,
    comments: 420,
    relatedBookId: "b6",
  },
];

export const categories: { name: Category; icon: string; color: string }[] = [
  { name: "Hikoya", icon: "BookOpen", color: "#2E7D32" },
  { name: "Roman", icon: "Book", color: "#388E3C" },
  { name: "She'r", icon: "Feather", color: "#66BB6A" },
  { name: "Qo'llanma", icon: "Lightbulb", color: "#43A047" },
  { name: "Darslik", icon: "GraduationCap", color: "#81C784" },
  { name: "Ertak", icon: "Sparkles", color: "#A5D6A7" },
  { name: "Ssenariy", icon: "Clapperboard", color: "#4CAF50" },
  { name: "Qissa", icon: "Scroll", color: "#C8E6C9" },
];

export function getAuthor(id: string): Author | undefined {
  return authors.find((a) => a.id === id);
}
export function getPublisher(id: string): Publisher | undefined {
  return publishers.find((p) => p.id === id);
}
export function getBook(id: string): Book | undefined {
  return books.find((b) => b.id === id);
}
export function getReel(id: string): Reel | undefined {
  return reels.find((r) => r.id === id);
}
export function getScreenplay(id: string): Screenplay | undefined {
  return screenplays.find((s) => s.id === id);
}
export function getArticle(id: string): Article | undefined {
  return articles.find((a) => a.id === id);
}
export function getBookRoute(book: Book) {
  return book.category === "Ssenariy"
    ? ({ pathname: "/screenplay/[id]", params: { id: book.id } } as const)
    : ({ pathname: "/book/[id]", params: { id: book.id } } as const);
}

export interface ReaderImageBlock {
  type: "image";
  uri: string;
  caption?: string;
}

export type ReaderParagraphItem = string | ReaderImageBlock;

export interface ReaderChapter {
  title: string;
  paragraphs: ReaderParagraphItem[];
  startTime: number;
  endTime: number;
}

export const sampleBookContent: { chapters: ReaderChapter[]; audioDuration: number } = {
  audioDuration: 1380,
  chapters: [
    {
      title: "I. Tun yarmida",
      startTime: 0,
      endTime: 420,
      paragraphs: [
        "Tun yarmida shahar uxlar, faqat men uyg'oqman. Derazadan tushayotgan chiroq nuri xonani oltin rangga bo'yaydi. Qo'limda — kitob. Kitobda — men o'zim.",
        "Har sahifa o'tkan kun kabi yopiladi, har bir so'z esa kelgusi kunga o'xshaydi — hali aytilmagan, hali yozilmagan. Shu tun men uzoq vaqtdan beri birinchi marta o'zimni eshitdim.",
        "Shaharning ovozi derazadan o'tib, xonamning burchagiga cho'kdi. U yerda, qog'ozlar orasida, eski bir xat yotardi. Men uni ochmadim — ba'zi xatlar o'qilmagani uchun go'zal bo'lib qoladi.",
        "Chiroqning nuri kitob sahifasida raqs tushardi. So'zlar jim edi, lekin ular menga qarab turardi. Har bir harf — bir kichik chiroq, har bir jumla — bir yo'l.",
        { type: "image", uri: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=900", caption: "Tungi o'qish lahzasi" },
        "Men o'zimga dedim: agar tun shu qadar sokin bo'lsa, demak, ichimda ham biror narsa pichirlashga tayyor. Qalamni qo'lga oldim. Sahifa oq edi — xuddi qor yoqqan bog' kabi.",
      ],
    },
    {
      title: "II. Ko'cha chirog'i",
      startTime: 420,
      endTime: 900,
      paragraphs: [
        "Ko'cha chirog'i tinch yonadi. U na biror narsa so'raydi, na biror narsa va'da qiladi. Faqat yonadi. Ba'zan shunday yashagim keladi — so'zsiz, savolsiz, yonib turgan chiroqdek.",
        "Tun — eng sodiq tinglovchi. U hech qachon so'zingni bo'lmaydi. Uning sukunati — eng chuqur javob. Men uzoq yillardan beri shu javobni izlab yurgan ekanman.",
        "Chiroqning ostida bir bola turardi. U kimnidir kutardi. Bu manzarani ko'rgach, men ham kimdir meni kutib turganiga ishongim keldi — kimdir, qayerdadir, biron sahifada.",
        "Yomg'ir tomchilari chiroqning nurida oltin uchqunlardek ko'rindi. Har tomchi — bir xotira. Ba'zilari achchiq, ba'zilari shirin, lekin hammasi bir-biriga ulanib, bitta daryoni hosil qilardi.",
        { type: "image", uri: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=900", caption: "Ko'cha chiroqlari" },
      ],
    },
    {
      title: "III. Deraza ortida",
      startTime: 900,
      endTime: 1380,
      paragraphs: [
        "Deraza ortida dunyo o'z ishini qilardi. Kimdir uxlardi, kimdir yig'lardi, kimdir sevardi. Men esa o'qirdim. O'qish — bu ham yashashning bir turi, balki eng sokin turi.",
        "Kitob yopildi. Chiroq o'chdi. Ammo so'zlar qoldilar — xonada, qalbimda, tunning qorong'i qatlarida. Shu on men tushundim: eng yaxshi hikoyalar hech qachon tugamaydi.",
        "Ertalab quyosh derazamga urildi. Xuddi biror do'st eshik qoqqandek edi. Men kitobni yana qo'limga oldim va birinchi sahifani ochdim — hikoya boshqatdan boshlandi, boshqacha ohangda.",
        "Shundan so'ng men bildim: har bir kitobning oxiri, aslida, boshqa bir kitobning boshlanishi. Va bu zanjir — bizning umrimiz.",
      ],
    },
  ],
};

export const samplePoem = {
  title: "Shaharda Yolg'iz",
  author: "Sardor Rashidov",
  words: [
    { w: "Men", t: 0.0 },
    { w: "bu", t: 0.35 },
    { w: "shaharda", t: 0.6 },
    { w: "yolg'iz", t: 1.1 },
    { w: "emasman,", t: 1.55 },
    { w: "\n", t: 2.1 },
    { w: "ammo", t: 2.2 },
    { w: "hech", t: 2.55 },
    { w: "kim", t: 2.85 },
    { w: "meni", t: 3.2 },
    { w: "tanimaydi.", t: 3.65 },
    { w: "\n\n", t: 4.4 },
    { w: "Har", t: 4.6 },
    { w: "bir", t: 4.9 },
    { w: "deraza", t: 5.2 },
    { w: "—", t: 5.7 },
    { w: "bir", t: 5.95 },
    { w: "hikoya,", t: 6.3 },
    { w: "\n", t: 6.9 },
    { w: "har", t: 7.1 },
    { w: "bir", t: 7.4 },
    { w: "chiroq", t: 7.7 },
    { w: "—", t: 8.1 },
    { w: "bir", t: 8.35 },
    { w: "yurak.", t: 8.7 },
    { w: "\n\n", t: 9.6 },
    { w: "Tun", t: 9.8 },
    { w: "bilan", t: 10.15 },
    { w: "so'zlashaman,", t: 10.5 },
    { w: "\n", t: 11.3 },
    { w: "yulduzlar", t: 11.5 },
    { w: "javob", t: 12.0 },
    { w: "beradi.", t: 12.4 },
  ] as { w: string; t: number }[],
  duration: 14,
};
