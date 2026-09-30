
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const roles = new Set(["admin","store_manager","store_staff","courier"]);
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ error: "Sunucu yapılandırması eksik." }, { status: 503 });

  const token = bearer(req);
  if (!token) return Response.json({ error: "Yetkisiz." }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return Response.json({ error: "Oturum doğrulanamadı." }, { status: 401 });

  const { data: caller } = await admin.from("profiles")
    .select("user_id,org_id,role,is_active")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!caller?.is_active || caller.role !== "admin" || !caller.org_id) {
    return Response.json({ error: "Yönetici yetkisi gerekli." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const full_name = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim() || null;
  const role = String(body.role || "");
  const store_id = body.store_id ? String(body.store_id) : null;
  const site_url = String(body.site_url || "").replace(/\/$/, "");

  if (!emailRe.test(email) || full_name.length < 2 || !roles.has(role)) {
    return Response.json({ error: "E-posta, ad veya rol geçersiz." }, { status: 400 });
  }

  if (store_id) {
    const { data: store } = await admin.from("stores").select("id").eq("id", store_id).eq("org_id", caller.org_id).maybeSingle();
    if (!store) return Response.json({ error: "Mağaza bu organizasyona ait değil." }, { status: 400 });
  }

  const redirectTo = site_url ? site_url + "/auth/confirm?next=%2Fauth%2Fupdate-password" : undefined;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { org_id: caller.org_id, store_id, role, full_name, phone },
    redirectTo
  });

  if (error || !data.user) return Response.json({ error: error?.message || "Davet gönderilemedi." }, { status: 400 });

  await admin.from("profiles").upsert({
    user_id: data.user.id,
    org_id: caller.org_id,
    store_id,
    full_name,
    phone,
    role,
    is_active: true
  }, { onConflict: "user_id" });

  return Response.json({ ok: true, user_id: data.user.id });
});
