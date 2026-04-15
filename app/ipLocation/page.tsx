'use client'

/**
 * /ipLocation — IP Camera location selection + raw feed page.
 *
 * Step 1: Pick which mall this IP camera is located at.
 * Step 2: Show the raw camera feed and start sending detections to that venue.
 *
 * Mirrors the /camera page pattern exactly but for IP cameras instead of phones.
 */

import React, { useState, useEffect, useRef } from 'react'
import { MapPin, ChevronRight, Loader2, Wifi, WifiOff, ScanLine, Radio } from 'lucide-react'

type Phase = 'venue-select' | 'stream'

interface Venue {
    id: string
    name: string
    city: string
}

// In production this goes through the Next.js API handlers instead of direct port 8081 access

export default function IPLocationPage() {
    // ── Venue selection ──────────────────────────────────────────────────────
    const [venues, setVenues] = useState<Venue[]>([])
    const [venuesLoading, setVenuesLoading] = useState(true)
    const [selectedVenueId, setSelectedVenueId] = useState('')
    const [venueName, setVenueName] = useState('')
    const [phase, setPhase] = useState<Phase>('venue-select')

    // ── Stream state ─────────────────────────────────────────────────────────
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [lastPlate, setLastPlate] = useState<string | null>(null)
    const [lastConf, setLastConf] = useState<string | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const imgRef = useRef<HTMLImageElement>(null)

    // ── Load venues ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/locations')
            .then(r => r.json())
            .then(data => {
                const list: Venue[] = (data.locations ?? []).map(
                    (v: { id: string; name: string; city: string }) => ({
                        id: v.id,
                        name: v.name,
                        city: v.city,
                    })
                )
                setVenues(list)
            })
            .catch(() => { })
            .finally(() => setVenuesLoading(false))
    }, [])

    // ── Confirm venue & start stream ─────────────────────────────────────────
    const confirmVenue = async () => {
        if (!selectedVenueId) return
        const venue = venues.find(v => v.id === selectedVenueId)
        if (!venue) return

        setVenueName(venue.name)

        // Tell camera_streamer.py which venue we're at via our proxy endpoint
        try {
            await fetch(`/api/camera/venue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venue_id: venue.id,
                    venue_name: venue.name,
                }),
            })
        } catch (e) {
            console.error('Failed to set venue on streamer:', e)
        }

        setPhase('stream')
        setIsLoading(true)

        // Start polling for latest detections
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/recognize?venue_id=${encodeURIComponent(venue.id)}&limit=1`)
                const data = await res.json()
                if (data.success && data.detections && data.detections.length > 0) {
                    const det = data.detections[0]
                    setLastPlate(det.plate_number)
                    setLastConf(det.confidence ? `${(det.confidence * 100).toFixed(0)}%` : null)
                }
            } catch {
                // api offline — keep polling
            }
        }, 2000)
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [])

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 1: Venue Selection (same UI as /camera)
    // ════════════════════════════════════════════════════════════════════════
    if (phase === 'venue-select') {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
                <div className="w-full max-w-sm space-y-5">
                    {/* Logo / title */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-600 mb-4">
                            <Radio className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-white text-xl font-bold">IP Camera Setup</h1>
                        <p className="text-slate-400 text-sm mt-1">Select the location for this camera</p>
                    </div>

                    {/* Venue picker */}
                    <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden">
                        {venuesLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
                                <span className="text-slate-400 text-sm ml-2">Loading locations…</span>
                            </div>
                        ) : venues.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-8 px-4">
                                No locations found. Check your connection.
                            </p>
                        ) : (
                            venues.map((venue, i) => (
                                <button
                                    key={venue.id}
                                    onClick={() => setSelectedVenueId(venue.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors ${i < venues.length - 1 ? 'border-b border-slate-800' : ''
                                        } ${selectedVenueId === venue.id
                                            ? 'bg-rose-900/50'
                                            : 'hover:bg-slate-800'
                                        }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selectedVenueId === venue.id
                                            ? 'border-rose-500 bg-rose-500'
                                            : 'border-slate-600'
                                            }`}
                                    >
                                        {selectedVenueId === venue.id && (
                                            <div className="w-2 h-2 rounded-full bg-white" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium text-sm truncate">{venue.name}</p>
                                        <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                            <MapPin className="w-3 h-3 flex-shrink-0" />
                                            {venue.city}
                                        </p>
                                    </div>
                                    {selectedVenueId === venue.id && (
                                        <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <button
                        onClick={confirmVenue}
                        disabled={!selectedVenueId}
                        className="w-full py-3.5 rounded-xl bg-rose-600 text-white font-bold text-base active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        Start Camera Feed
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        )
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2: Raw Camera Stream
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-rose-300 text-xs font-medium">{venueName}</span>
                    </div>
                    <button
                        onClick={async () => {
                            if (pollRef.current) clearInterval(pollRef.current)
                            // Notify streamer that we are changing location (reset venue)
                            try {
                                await fetch(`/api/camera/venue`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        venue_id: null,
                                        venue_name: null,
                                    }),
                                })
                            } catch (e) {
                                console.error('Failed to reset venue on streamer:', e)
                            }
                            setPhase('venue-select')
                            setLastPlate(null)
                            setIsConnected(false)
                        }}
                        className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                    >
                        Change location
                    </button>
                </div>

                {/* Raw camera stream */}
                <div className="rounded-2xl border border-slate-700 bg-black overflow-hidden relative aspect-video w-full shadow-2xl">
                    {/* Status badges */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                        {isConnected ? (
                            <>
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="text-[10px] font-bold text-white tracking-wider uppercase">LIVE</span>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                                <span className="text-[10px] font-bold text-white tracking-wider uppercase">Connecting…</span>
                            </>
                        )}
                    </div>

                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                        {isConnected ? (
                            <Wifi className="w-3 h-3 text-emerald-400" />
                        ) : (
                            <WifiOff className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="text-[10px] font-semibold text-white/90">
                            {isConnected ? 'STREAM ACTIVE' : 'CONNECTING…'}
                        </span>
                    </div>

                    {/* ANPR active indicator */}
                    {isConnected && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-500/30">
                            <ScanLine className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">ANPR Active</span>
                        </div>
                    )}

                    {/* Raw MJPEG stream */}
                    <img
                        ref={imgRef}
                        src={`/api/camera/stream?venue_id=setup`}
                        alt="IP Camera live feed"
                        className="w-full h-full object-cover"
                        onLoad={() => { setIsConnected(true); setIsLoading(false) }}
                        onError={() => { setIsConnected(false); setIsLoading(false) }}
                    />

                    {/* Offline overlay */}
                    {!isConnected && !isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                            <WifiOff className="w-10 h-10 text-slate-400 mb-3" />
                            <p className="text-white font-medium text-sm mb-1">Camera Streamer Offline</p>
                            <p className="text-slate-400 text-xs text-center max-w-xs">
                                Start the camera streamer script: <br />
                                <code className="bg-slate-800 px-1 rounded mt-1 block font-mono">python model/camera_streamer.py</code>
                            </p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                            <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-2" />
                            <p className="text-white text-sm font-medium">Connecting to camera…</p>
                        </div>
                    )}
                </div>

                {/* Latest detection display */}
                {lastPlate && (
                    <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-3 flex items-center gap-3">
                        <ScanLine className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                            <p className="text-emerald-400 text-xs font-medium mb-0.5">Latest Detection</p>
                            <p className="text-white font-mono font-bold text-lg tracking-widest">
                                {lastPlate}
                            </p>
                        </div>
                        {lastConf && (
                            <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md border border-emerald-500/30">
                                {lastConf}
                            </span>
                        )}
                    </div>
                )}

                <p className="text-slate-600 text-xs text-center">
                    Keep this page open · Detections are sent to the staff dashboard automatically
                </p>
            </div>
        </div>
    )
}
