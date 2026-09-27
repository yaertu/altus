import { RealtimeChannel, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { ActivityEvent, Delivery, DeliveryProof, DeliveryProofType, DeliveryStatus, Priority } from "./types";

export type StaffRecord = { id: string; name: string; phone: string; userId?: string | null };
export type Profile = { id: string; fullName: string; role: "admin" | "office" | "courier" | "viewer"; phone?: string | null; active: boolean };

const blankChecklist = {
  addressVerified: false,
  customerCalled: false,
  productLoaded: false,
  modelChecked: false,
  accessoriesChecked: false,
  returnChecked: false
};

function deliveryFromRow(row: any): Delivery {
  return {
    id: row.id,
    orderNo: row.order_no,
    customerName: row.customer_name,
    phone: row.phone,
    secondaryPhone: row.secondary_phone || undefined,
    address: row.address,
    district: row.district || "",
    city: row.city || "",
    date: row.delivery_date,
    timeWindow: row.time_window || "",
    assignee: row.assignee_name || "Atanmamış",
    assigneeInitials: row.assignee_name ? row.assignee_name.split(" ").map((x:string)=>x[0]).join("").slice(0,2).toUpperCase() : "--",
    status: row.status as DeliveryStatus,
    priority: row.priority as Priority,
    notes: row.notes || undefined,
    items: Array.isArray(row.items) ? row.items : [],
    checklist: { ...blankChecklist, ...(row.checklist || {}) },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function eventFromRow(row: any): ActivityEvent {
  return {
    id: row.id,
    deliveryId: row.delivery_id || undefined,
    orderNo: row.order_no || undefined,
    actor: row.actor_name || "Sistem",
    type: (row.event_type || "system") as ActivityEvent["type"],
    title: row.title,
    detail: row.detail || undefined,
    createdAt: row.created_at
  };
}


function proofFromRow(row:any, signedUrl:string): DeliveryProof {
  return {
    id: row.id,
    deliveryId: row.delivery_id,
    proofType: row.proof_type as DeliveryProofType,
    storagePath: row.storage_path,
    fileName: row.file_name || undefined,
    mimeType: row.mime_type || undefined,
    sizeBytes: row.size_bytes == null ? undefined : Number(row.size_bytes),
    createdBy: row.created_by || undefined,
    createdAt: row.created_at,
    signedUrl
  };
}

export function cloudAvailable() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase yapılandırılmamış.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data:{ user }, error:userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,phone,active")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id:data.id, fullName:data.full_name, role:data.role, phone:data.phone, active:data.active };
}

export async function loadCloudData() {
  if (!supabase) throw new Error("Supabase yapılandırılmamış.");
  const [d, s, e] = await Promise.all([
    supabase.from("deliveries").select("*").order("delivery_date", { ascending:false }).order("created_at", { ascending:false }).limit(500),
    supabase.from("staff").select("id,name,phone,user_id").eq("active", true).order("name"),
    supabase.from("delivery_events").select("*, deliveries(order_no)").order("created_at", { ascending:false }).limit(200)
  ]);
  if (d.error) throw d.error;
  if (s.error) throw s.error;
  if (e.error) throw e.error;
  return {
    deliveries: (d.data || []).map(deliveryFromRow),
    staff: (s.data || []).map((x:any)=>({ id:x.id, name:x.name, phone:x.phone || "", userId:x.user_id })),
    events: (e.data || []).map((x:any)=>eventFromRow({ ...x, order_no:x.deliveries?.order_no }))
  };
}

export async function insertDelivery(input: Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">, staff: StaffRecord[]) {
  if (!supabase) throw new Error("Supabase yapılandırılmamış.");
  const assigned = staff.find(s=>s.name===input.assignee);
  const { data, error } = await supabase.from("deliveries").insert({
    order_no: input.orderNo,
    customer_name: input.customerName,
    phone: input.phone,
    secondary_phone: input.secondaryPhone || null,
    address: input.address,
    district: input.district,
    city: input.city,
    delivery_date: input.date,
    time_window: input.timeWindow,
    assignee_id: assigned?.id || null,
    assignee_name: input.assignee === "Atanmamış" ? null : input.assignee,
    status: input.assignee === "Atanmamış" ? "new" : "assigned",
    priority: input.priority,
    notes: input.notes || null,
    items: input.items,
    checklist: blankChecklist
  }).select("*").single();
  if (error) throw error;
  return deliveryFromRow(data);
}

export async function insertStaff(name: string, phone: string, userId?: string | null) {
  if (!supabase) throw new Error("Supabase yapılandırılmamış.");
  const { data, error } = await supabase.from("staff").insert({ name, phone:phone || null, user_id:userId || null }).select("id,name,phone,user_id").single();
  if (error) throw error;
  return { id:data.id, name:data.name, phone:data.phone || "", userId:data.user_id } as StaffRecord;
}

export async function patchDelivery(id: string, patch: Partial<{ status:DeliveryStatus; checklist:Delivery["checklist"]; assigneeId:string|null; assigneeName:string|null; notes:string|null }>) {
  if (!supabase) throw new Error("Supabase yapılandırılmamış.");
  const row:any = { updated_at:new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.checklist !== undefined) row.checklist = patch.checklist;
  if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;
  if (patch.assigneeName !== undefined) row.assignee_name = patch.assigneeName;
  if (patch.notes !== undefined) row.notes = patch.notes;
  const { data, error } = await supabase.from("deliveries").update(row).eq("id",id).select("*").single();
  if (error) throw error;
  return deliveryFromRow(data);
}

export async function removeCloudDelivery(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("deliveries").delete().eq("id",id);
  if (error) throw error;
}

export async function loadDeliveryProofs(deliveryId:string): Promise<DeliveryProof[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("delivery_proofs")
    .select("id,delivery_id,proof_type,storage_path,file_name,mime_type,size_bytes,created_by,created_at")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending:false });
  if (error) throw error;

  const rows=data || [];
  const urls=await Promise.all(rows.map(async(row:any)=>{
    const { data:signed, error:signedError } = await supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(row.storage_path, 60*60);
    if (signedError) throw signedError;
    return proofFromRow(row, signed?.signedUrl || "");
  }));
  return urls;
}

export async function uploadDeliveryProof(deliveryId:string, file:File, proofType:DeliveryProofType): Promise<DeliveryProof> {
  if (!supabase) throw new Error("Teslimat kanıtı için Supabase bağlantısı gerekli.");
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca fotoğraf veya imza görseli yüklenebilir.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Dosya boyutu 10 MB sınırını aşıyor.");

  const { data:{ user }, error:userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Teslimat kanıtı yüklemek için oturum açmalısın.");

  const ext=(file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi,"").toLowerCase() || "jpg";
  const token=typeof crypto!=="undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const path=`${deliveryId}/${user.id}/${Date.now()}-${token}.${ext}`;

  const { error:uploadError } = await supabase.storage
    .from("delivery-proofs")
    .upload(path, file, { contentType:file.type, cacheControl:"3600", upsert:false });
  if (uploadError) throw uploadError;

  const { data:row, error:insertError } = await supabase
    .from("delivery_proofs")
    .insert({
      delivery_id: deliveryId,
      proof_type: proofType,
      storage_path: path,
      file_name: file.name || (proofType==="signature" ? "signature.png" : "photo"),
      mime_type: file.type,
      size_bytes: file.size,
      created_by: user.id
    })
    .select("id,delivery_id,proof_type,storage_path,file_name,mime_type,size_bytes,created_by,created_at")
    .single();

  if (insertError) {
    try { await supabase.storage.from("delivery-proofs").remove([path]); } catch {}
    throw insertError;
  }

  const { data:signed, error:signedError } = await supabase.storage
    .from("delivery-proofs")
    .createSignedUrl(path, 60*60);
  if (signedError) throw signedError;
  return proofFromRow(row, signed?.signedUrl || "");
}

export async function insertEvent(event: Omit<ActivityEvent,"id"|"createdAt">) {
  if (!supabase) return;
  const { error } = await supabase.from("delivery_events").insert({
    delivery_id:event.deliveryId || null,
    actor_name:event.actor,
    event_type:event.type,
    title:event.title,
    detail:event.detail || null
  });
  if (error) throw error;
}

export function subscribeCloud(onChange:()=>void): RealtimeChannel | null {
  if (!supabase) return null;
  return supabase.channel("yaateslimat-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"deliveries"},onChange)
    .on("postgres_changes",{event:"*",schema:"public",table:"staff"},onChange)
    .on("postgres_changes",{event:"*",schema:"public",table:"delivery_events"},onChange)
    .subscribe();
}

export function unsubscribeCloud(channel: RealtimeChannel | null) {
  if (supabase && channel) supabase.removeChannel(channel);
}
