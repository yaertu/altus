'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeliveryStatus } from '@/lib/types'

const DB_NAME = 'altus-field-ops-v1'
const STORE = 'actions'
const DB_VERSION = 1
const notifyQueue = () => { if (typeof window !== 'undefined') { window.dispatchEvent(new CustomEvent('altus:offline-queue')); void requestBackgroundSync() } }

async function requestBackgroundSync(){
  if(typeof navigator==='undefined'||!('serviceWorker'in navigator))return
  try{
    const reg=await navigator.serviceWorker.ready as ServiceWorkerRegistration & {sync?:{register:(tag:string)=>Promise<void>}}
    await reg.sync?.register('altus-field-sync')
  }catch{}
}

export type OfflineAction =
  | {
      id: string
      kind: 'delivery_status'
      deliveryId: string
      createdAt: number
      payload: { status: DeliveryStatus; failure_reason?: string | null; lat?: number | null; lng?: number | null; accuracy?: number | null }
    }
  | {
      id: string
      kind: 'proof_upload'
      deliveryId: string
      createdAt: number
      payload: { orgId: string; userId: string; proofType: 'photo' | 'signature'; mimeType: string; extension: string; storagePath: string }
      blob: Blob
    }

function uid() {
  return `${Date.now()}-${crypto.randomUUID()}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Offline veritabanı açılamadı'))
  })
}

async function tx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = work(transaction.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Offline işlem başarısız'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline işlem başarısız'))
  })
}

export async function enqueueStatus(deliveryId: string, payload: Extract<OfflineAction, { kind: 'delivery_status' }>['payload']) {
  const action: OfflineAction = { id: uid(), kind: 'delivery_status', deliveryId, createdAt: Date.now(), payload }
  await tx('readwrite', store => store.put(action))
  notifyQueue()
  return action.id
}

export async function enqueueProof(input: Omit<Extract<OfflineAction, { kind: 'proof_upload' }>, 'id' | 'createdAt'>) {
  const action: OfflineAction = { ...input, id: uid(), createdAt: Date.now() }
  await tx('readwrite', store => store.put(action))
  notifyQueue()
  return action.id
}

export async function listOfflineActions(): Promise<OfflineAction[]> {
  const result = await tx<OfflineAction[]>('readonly', store => store.getAll())
  return result.sort((a, b) => a.createdAt - b.createdAt)
}

export async function pendingOfflineCount() {
  return tx<number>('readonly', store => store.count())
}

async function removeAction(id: string) {
  await tx('readwrite', store => store.delete(id))
  notifyQueue()
}

export async function flushOfflineQueue(supabase: SupabaseClient) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { flushed: 0, remaining: await pendingOfflineCount() }
  const actions = await listOfflineActions()
  let flushed = 0

  for (const action of actions) {
    try {
      if (action.kind === 'proof_upload') {
        const p = action.payload
        const { error: uploadError } = await supabase.storage
          .from('delivery-proofs')
          .upload(p.storagePath, action.blob, { contentType: p.mimeType, upsert: true })
        if (uploadError) throw uploadError
        const { error: rowError } = await supabase.from('delivery_proofs').upsert(
          {
            delivery_id: action.deliveryId,
            org_id: p.orgId,
            uploaded_by: p.userId,
            proof_type: p.proofType,
            storage_path: p.storagePath,
            mime_type: p.mimeType,
            size_bytes: action.blob.size,
          },
          { onConflict: 'storage_path', ignoreDuplicates: true },
        )
        if (rowError) throw rowError
      } else {
        const p = action.payload
        const { error } = await supabase
          .from('deliveries')
          .update({
            status: p.status,
            failure_reason: p.failure_reason ?? null,
            last_event_lat: p.lat ?? null,
            last_event_lng: p.lng ?? null,
            last_event_accuracy_m: p.accuracy ?? null,
          })
          .eq('id', action.deliveryId)
        if (error) throw error
      }
      await removeAction(action.id)
      flushed++
    } catch {
      break
    }
  }

  return { flushed, remaining: await pendingOfflineCount() }
}

export function makeProofPath(orgId: string, deliveryId: string, userId: string, type: 'photo' | 'signature', extension: string) {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || (type === 'photo' ? 'jpg' : 'png')
  return `${orgId}/${deliveryId}/${userId}/${type}-${crypto.randomUUID()}.${safeExt}`
}
