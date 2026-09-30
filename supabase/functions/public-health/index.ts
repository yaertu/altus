
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return Response.json({ status: "degraded" }, { status: 503 });
  const supabase = createClient(url, service, { auth: { persistSession: false } });
  const { error } = await supabase.from("organizations").select("id", { head: true, count: "exact" });
  if (error) return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  return Response.json({ status: "ok", database: "ok", version: "6.0.0" }, {
    headers: { "cache-control": "no-store" }
  });
});
