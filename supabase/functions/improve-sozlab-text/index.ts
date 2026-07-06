const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SozlabPostType = "thought" | "quote" | "review" | "discussion";
type SozlabTargetKind = "book" | "poem" | "screenplay" | "other";

interface ImproveRequest {
  text?: string;
  targetKind?: SozlabTargetKind;
  targetTitle?: string;
  postType?: SozlabPostType;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Only POST is supported." }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not configured." }, 500);
  }

  let payload: ImproveRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const text = payload.text?.trim() ?? "";
  if (text.length < 10) {
    return json({ error: "Text is too short to improve." }, 400);
  }
  if (text.length > 4000) {
    return json({ error: "Text is too long. Maximum length is 4000 characters." }, 400);
  }

  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.5";
  const targetKind = payload.targetKind ?? "other";
  const targetTitle = payload.targetTitle?.trim() || "tanlangan adabiy asar";
  const postType = payload.postType ?? "thought";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions:
        "You are an Uzbek literary editor for an app named AdabiyotX. Improve the user's Uzbek text while preserving meaning, voice, and length. Make it clear, polished, respectful, and suitable for a public literary discussion feed. Return only the improved Uzbek text.",
      input: [
        {
          role: "user",
          content:
            `Asar turi: ${targetKind}\n` +
            `Asar nomi: ${targetTitle}\n` +
            `Post turi: ${postType}\n\n` +
            `Matn:\n${text}`,
        },
      ],
      max_output_tokens: 700,
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    return json(
      {
        error: result?.error?.message ?? "OpenAI request failed.",
      },
      response.status,
    );
  }

  const improvedText = extractOutputText(result).trim();
  if (!improvedText) {
    return json({ error: "OpenAI returned an empty response." }, 502);
  }

  return json({ improvedText, model });
});

function extractOutputText(result: any): string {
  if (typeof result?.output_text === "string") {
    return result.output_text;
  }

  if (!Array.isArray(result?.output)) {
    return "";
  }

  return result.output
    .flatMap((item: any) => item?.content ?? [])
    .map((content: any) => content?.text ?? "")
    .filter(Boolean)
    .join("\n");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
