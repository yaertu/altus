
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const token = new URL(req.url).searchParams.get("token")?.trim() || "";
  if (!uuid.test(token)) return Response.json({ error: "not_found" }, { status: 404 });

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ error: "backend_unavailable" }, { status: 503 });

  const supabase = createClient(url, service, { auth: { persistSession: false } });
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select("id,tracking_no,customer_name,product_name,product_model,quantity,scheduled_date,time_window,status,priority,city,district,created_at,updated_at,tracking_expires_at,org_id")
    .eq("tracking_token", token)
    .maybeSingle();

  if (error || !delivery || new Date(delivery.tracking_expires_at).getTime() <= Date.now()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const [{ data: org }, { data: events }] = await Promise.all([
    supabase.from("organizations").select("name,brand_color").eq("id", delivery.org_id).maybeSingle(),
    supabase.from("delivery_events").select("id,event_type,to_status,created_at").eq("delivery_id", delivery.id).order("created_at", { ascending: true }).limit(100),
  ]);

  return Response.json({
    delivery: {
      id: delivery.id,
      tracking_no: delivery.tracking_no,
      customer_first_name: String(delivery.customer_name || "").trim().split(/\s+/)[0] || "Müşteri",
      product_name: delivery.product_name,
      product_model: delivery.product_model,
      quantity: delivery.quantity,
      scheduled_date: delivery.scheduled_date,
      time_window: delivery.time_window,
      status: delivery.status,
      priority: delivery.priority,
      city: delivery.city,
      district: delivery.district,
      created_at: delivery.created_at,
      updated_at: delivery.updated_at,
      tracking_expires_at: delivery.tracking_expires_at,
    },
    organization: org || { name: "Altus Sevkiyat", brand_color: "#cf006f" },
    events: events || [],
  }, { headers: { "cache-control": "private, no-store" } });
});
