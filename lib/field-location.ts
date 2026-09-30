'use client'

export type LocationSnapshot = { lat: number | null; lng: number | null; accuracy: number | null }

export async function getLocationSnapshot(timeout = 5000): Promise<LocationSnapshot> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return { lat: null, lng: null, accuracy: null }
  return await new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve({ lat: null, lng: null, accuracy: null }),
      { enableHighAccuracy: false, timeout, maximumAge: 60_000 },
    )
  })
}
