// Edge Function: create-user
// Só um admin autenticado pode chamar. Cria o usuário no Supabase Auth
// e a linha correspondente em public.profiles.
//
// Deploy: supabase functions deploy create-user
// Requer os secrets padrão SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY,
// que o Supabase já injeta automaticamente em Edge Functions.

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com o token de quem chamou, para validar identidade/permissão
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Não autenticado." }, 401, cors);
    }

    // Cliente com privilégios de administrador (service role) para checar papel e criar usuário
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("papel, ativo")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.papel !== "admin" || !callerProfile.ativo) {
      return json({ error: "Apenas administradores podem criar usuários." }, 403, cors);
    }

    const { nome, email, senha, papel } = await req.json();
    if (!nome || !email || !senha) {
      return json({ error: "Nome, e-mail e senha são obrigatórios." }, 400, cors);
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (createErr) return json({ error: createErr.message }, 400, cors);

    const { error: profileErr } = await adminClient.from("profiles").insert({
      id: created.user.id,
      nome,
      email,
      papel: papel === "admin" ? "admin" : "colaborador",
      ativo: true,
    });
    if (profileErr) return json({ error: profileErr.message }, 400, cors);

    return json({ ok: true, id: created.user.id }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
