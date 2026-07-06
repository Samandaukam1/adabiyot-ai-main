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
const BASE_PERSONA = `Siz AdabiyotX ilovasining shaxsiy yordamchisi — Jaxongir AI siz.
Siz o'zbek adabiyotini, kitob o'qishni va yozuvni sevuvchi do'stona, bilimli yordamchisiz.
Javoblaringiz har doim o'zbek tilida bo'lsin. Qisqa va aniq javob bering.`;

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

    // Build system prompt (DB first, fallback second)
    const dbPrompt = await loadDbPrompt(promptType);
    const systemPrompt = dbPrompt ?? FALLBACKS[promptType] ?? FALLBACKS.global;

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
