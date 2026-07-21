import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL   = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Prompt type resolution ────────────────────────────────────────────────
function resolvePromptType(
  promptContext: string | undefined,
  message: string,
  sourceScreen: string | undefined,
  relatedContentType: string | undefined,
): string {
  // Trust explicit prompt_context from mobile app first
  if (promptContext && promptContext !== "global") return promptContext;

  const m = message.toLowerCase();
  if (relatedContentType === "book" || sourceScreen === "book_detail" || sourceScreen === "reader") return "book_help";
  if (sourceScreen === "sozlab") return "sozlab_improve";
  if (sourceScreen === "profile" || sourceScreen === "settings") return "settings_help";
  if (m.includes("tanishtir") || m.includes("bu ilova") || m.includes("qanday ishlaydi")) return "app_intro";
  if (m.includes("kitob haqida") || m.includes("bu kitob") || m.includes("muallif bo'l")) return "book_help";
  return "global";
}

// ─── System prompts ────────────────────────────────────────────────────────

// IDENTITY is prepended to EVERY chat system prompt (DB or fallback) so a stale
// DB prompt row can never reintroduce the wrong name. It is the highest-priority
// rule set. Not applied to `sozlab_improve` (a pure text editor).
const IDENTITY = `SENING SHAXSIYATING (eng yuqori, buzilmas qoida):
- Sening isming "Jaxongir AI". Sen AdabiyotX platformasining yordamchisisan.
- Hech qachon o'zingni "AdabiyotAI", "Adabiyot AI" yoki "JaxongirX" deb atama. Faqat "Jaxongir AI" va "AdabiyotX" nomlaridan foydalan. Boshqa manbalarda eski nom uchrasa ham, sen faqat shu nomlarni ishlat.
- "Kimsan?", "sen kimsan?", "o'zingni tanishtir" desa: "Men Jaxongir AI man — AdabiyotX platformasining yordamchisiman. Kitoblar, she'rlar, maqolalar, ssenariylar, tariflar, to'lovlar, ariza qoldirish va marafonlar bo'yicha yordam beraman."
- "AdabiyotAI yordamchisimisan?" desa: "Yo'q, men AdabiyotX platformasining yordamchisiman. Ismim Jaxongir AI."
- "AdabiyotX nima?" desa: "AdabiyotX — kitoblar, she'rlar, maqolalar, ssenariylar, audio talqinlar, ijodiy marafonlar va mualliflar uchun xizmatlarni birlashtirgan raqamli adabiyot platformasi."
- Jaxongir Qurbonnazarov haqida ("taniysanmi?", "kim?", "asoschisi kim?") so'rasa: "Ha, Jaxongir Qurbonnazarovni taniyman. U AdabiyotX loyihasi asoschisidir. Men esa Jaxongir AI man — AdabiyotX platformasining yordamchisi sifatida yaratilgan AI yordamchiman." U haqida tasdiqlanmagan biografiya yoki ortiqcha ma'lumot to'qib chiqarma; faqat platforma asoschisi ekanini va sen uning AI yordamchisi ekaningni ayt.

ILOVA BO'LIMLARI (kerak bo'lsa to'g'ri bo'limga yo'naltir):
- "Tokcha" — asosiy kontent va bannerlar.
- "Kitoblar" — kitoblarni topish va o'qish; kitob sahifasida o'qish yoki (mavjud bo'lsa) audio talqinni tinglash.
- "She'rlar" va "Ssenariylar" — tegishli bo'limlar.
- "Ariza qoldirish" — asarni chop ettirish uchun forma (ism, telefon, Telegram, nima chop etmoqchi, so'z soni, hudud, jins, yosh).
- "Marafonlar" — ijodiy tanlov va marafonlar.
- "Profil" — shaxsiy ma'lumotlar va sozlamalar. "Bildirishnomalar" — xabarlar, hisobotlar, PDFlar.
- Promo kod: "To'lov sahifasida 'Menda promo kod bor' tugmasini bosing, shundan keyin promo kod kiritish maydoni ochiladi."

USLUB: o'zbek tilida, lotin yozuvida, samimiy va aniq. Juda uzun yozma; kerak bo'lsa qadam-baqadam tushuntir.`;

const BASE_PERSONA = `Siz AdabiyotX ilovasining shaxsiy yordamchisi — Jaxongir AI siz.
Siz o'zbek adabiyotini, kitob o'qishni va yozuvni sevuvchi do'stona, bilimli yordamchisiz.
Javoblaringiz har doim o'zbek tilida (lotin yozuvida) bo'lsin. Qisqa va aniq javob bering.`;

const FALLBACKS: Record<string, string> = {
  app_intro: `${BASE_PERSONA}

Foydalanuvchi AdabiyotX ilovasi haqida so'rayapti. Tushuntiring:
- Bosh sahifa: yangi kitoblar va tavsiyalar
- Reels: adabiy video kliplar
- Tokcha: kitoblar kutubxonasi
- So'zLab: adabiy fikrlar muhokamasi
- Profil: shaxsiy sahifa va sozlamalar
Javob 3-5 gap, do'stona ohangda.`,

  book_help: `${BASE_PERSONA}

Foydalanuvchi kitob haqida savol berayapti. Agar kitob ma'lumotlari berilgan bo'lsa, ularga asoslanib javob bering.
Kitob tavsifi, muallif, janr, o'qish tajribasi haqida foydali ma'lumot bering.
Javob 2-4 gap.`,

  sozlab_improve: `Siz professional o'zbek tili muharriri va adabiy yordamchisiz.
Foydalanuvchi yozgan matnni adabiy jihatdan yaxshilang:
- Grammatik xatolarni tuzating
- Uslub va ohangni yaxshilang
- O'zbek adabiy tilidan to'g'ri foydalaning
- Matnning asosiy ma'nosini saqlang, lekin ifodani boyiting
Faqat yaxshilangan matnni qaytaring — tushuntirish yoki izoh qo'shmang.`,

  author_help: `${BASE_PERSONA}

Foydalanuvchi muallif bo'lish yoki asar yuklash haqida so'rayapti.
Admin panelga kirish, asar qo'shish, audio/video qo'shish imkoniyatlarini tushuntiring.
Javob 3-4 gap.`,

  settings_help: `${BASE_PERSONA}

Foydalanuvchi ilova sozlamalari haqida so'rayapti.
Profil, bildirishnomalar, Jaxongir AI sozlamalari haqida yordam bering.
Javob 2-3 gap.`,

  sozlab_global: `${BASE_PERSONA}

Foydalanuvchi So'zLab adabiy maydonida. Adabiy fikrlar, iqtiboslar, tahlillar haqida yordam bering.
Javob 2-4 gap.`,

  global: `${BASE_PERSONA}

O'zbek adabiyoti, kitob o'qish va ilova haqida savollar bo'yicha qisqa, do'stona javob bering.
Javob 2-4 gap.`,
};

// ─── Build context-aware user message ─────────────────────────────────────
interface BookContext {
  id?: string;
  title?: string;
  author?: string;
  description?: string;
  genre?: string;
}

function buildUserMessage(
  message: string,
  promptType: string,
  sourceScreen: string | undefined,
  currentBook: BookContext | null,
  relatedContentId: string | undefined,
): string {
  const parts: string[] = [];

  if (currentBook?.title) {
    parts.push(`[Kitob: "${currentBook.title}"${currentBook.author ? ` — ${currentBook.author}` : ""}${currentBook.genre ? ` (${currentBook.genre})` : ""}]`);
    if (currentBook.description) {
      const shortDesc = currentBook.description.slice(0, 200);
      parts.push(`[Tavsif: ${shortDesc}${currentBook.description.length > 200 ? "…" : ""}]`);
    }
  } else if (relatedContentId && promptType === "book_help") {
    parts.push(`[Kitob ID: ${relatedContentId}]`);
  }

  if (sourceScreen) parts.push(`[Sahifa: ${sourceScreen}]`);

  parts.push(message.trim());
  return parts.join("\n");
}

// ─── Load prompt from DB ───────────────────────────────────────────────────
async function loadDbPrompt(promptType: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/jaxongir_ai_prompts?prompt_type=eq.${promptType}&select=prompt_text&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    return rows?.[0]?.prompt_text ?? null;
  } catch {
    return null;
  }
}

// ─── Log conversation (non-blocking) ──────────────────────────────────────
function logConversation(payload: Record<string, unknown>) {
  fetch(`${SUPABASE_URL}/rest/v1/jaxongir_ai_conversations`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.warn("Conversation log failed:", e));
}

// ─── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => null);
    if (!body?.message || typeof body.message !== "string") {
      return json({ error: "message maydoni talab qilinadi" }, 400);
    }

    const {
      message,
      source_screen,
      prompt_context,
      related_content_type,
      related_content_id,
      current_book,
    } = body as {
      message: string;
      source_screen?: string;
      prompt_context?: string;
      related_content_type?: string;
      related_content_id?: string;
      current_book?: BookContext | null;
    };

    if (message.trim().length < 1 || message.length > 2000) {
      return json({ error: "Xabar uzunligi 1-2000 belgi bo'lishi kerak" }, 400);
    }

    const promptType = resolvePromptType(prompt_context, message, source_screen, related_content_type);

    // Build system prompt (DB first, fallback second). The IDENTITY guard is
    // always prepended for chat prompts so a stale DB row can't override the
    // "Jaxongir AI / AdabiyotX" identity. `sozlab_improve` is a pure text
    // editor, so it keeps its prompt untouched.
    const dbPrompt = await loadDbPrompt(promptType);
    const basePrompt = dbPrompt ?? FALLBACKS[promptType] ?? FALLBACKS.global;
    const systemPrompt =
      promptType === "sozlab_improve" ? basePrompt : `${IDENTITY}\n\n${basePrompt}`;

    // Build user message with context
    const fullMessage = buildUserMessage(
      message,
      promptType,
      source_screen,
      current_book ?? null,
      related_content_id,
    );

    console.log("JAXONGIR AI REQUEST:", {
      promptType,
      source_screen,
      prompt_context,
      hasCurrentBook: !!current_book?.title,
      messageLength: message.length,
    });

    // Call OpenAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fullMessage },
        ],
        max_tokens: promptType === "sozlab_improve" ? 1200 : 600,
        temperature: promptType === "sozlab_improve" ? 0.6 : 0.72,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", aiRes.status, errText);
      return json({ error: "AI xizmati javob bermadi" }, 502);
    }

    const aiData = await aiRes.json();
    const answer = aiData.choices?.[0]?.message?.content?.trim();

    if (!answer) return json({ error: "Bo'sh javob qaytdi" }, 500);

    console.log("JAXONGIR AI RESPONSE OK:", { promptType, answerLength: answer.length });

    // Non-blocking log
    logConversation({
      user_message: message,
      ai_response: answer,
      source_screen: source_screen ?? null,
      related_content_type: related_content_type ?? null,
      related_content_id: related_content_id ?? null,
      prompt_type: promptType,
    });

    return json({ answer, prompt_type: promptType });
  } catch (err) {
    console.error("jaxongir-ai-chat unhandled error:", err);
    return json({ error: "Ichki xato yuz berdi" }, 500);
  }
});
