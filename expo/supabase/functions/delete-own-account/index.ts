import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authorization token topilmadi",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables topilmadi");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Foydalanuvchi aniqlanmadi",
          details: userError?.message ?? null,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    await adminClient
      .from("account_deletion_requests")
      .upsert(
        {
          user_id: userId,
          email: user.email ?? null,
          status: "processing",
          requested_at: new Date().toISOString(),
          completed_at: null,
          admin_note: null,
        },
        {
          onConflict: "user_id",
        },
      );

    const { data: avatarFiles, error: listError } =
      await adminClient.storage
        .from("avatars")
        .list(userId, {
          limit: 1000,
        });

    if (listError) {
      console.error("Avatar list error:", listError);
    }

    if (avatarFiles && avatarFiles.length > 0) {
      const paths = avatarFiles.map((file) => `${userId}/${file.name}`);

      const { error: storageError } = await adminClient.storage
        .from("avatars")
        .remove(paths);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
      }
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      throw new Error(`Profil o‘chirilmadi: ${profileError.message}`);
    }

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId, false);

    if (deleteError) {
      throw new Error(`Auth hisob o‘chirilmadi: ${deleteError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Hisob muvaffaqiyatli o‘chirildi",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Delete account error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Hisobni o‘chirishda noma’lum xatolik",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
