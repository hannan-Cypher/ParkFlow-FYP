'use client'

/**
 * /camera — Phone broadcaster page.
 *
 * Step 1: Pick which mall this camera is located at.
 * Step 2: Stream live video via WebRTC to that venue's admin/staff dashboard.
 *         ANPR runs automatically every 2.5 s and displays any detected plate.
 *
 * Open on phone: http://<server-ip>:3000/camera
 * Admin can also share a pre-filled URL: /camera?venueId=<uuid>
 */

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { MapPin, ChevronRight, ScanLine, Loader2 } from 'lucide-react'

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

type Status = 'idle' | 'connecting' | 'streaming' | 'error'
type Phase = 'venue-select' | 'camera'

interface Venue {
    id: string
    name: string
    city: string
}

export default function CameraPage() {
    // ── Venue selection ──────────────────────────────────────────────────────
    const [venues, setVenues] = useState<Venue[]>([])
    const [venuesLoading, setVenuesLoading] = useState(true)
    const [selectedVenueId, setSelectedVenueId] = useState('')
    const [venueName, setVenueName] = useState('')
    const [phase, setPhase] = useState<Phase>('venue-select')
    // Ref keeps the current venueId accessible inside memoized callbacks
    const venueIdRef = useRef('')

    // ── WebRTC refs ──────────────────────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [status, setStatus] = useState<Status>('idle')
    const [error, setError] = useState('')

    // ── ANPR ─────────────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const anprRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [lastPlate, setLastPlate] = useState<string | null>(null)
    const [anprScanning, setAnprScanning] = useState(false)

    // ── Lens selection ────────────────────────────────────────────────────────
    const selectedZoomRef = useRef<number>(1)
    const [selectedZoom, setSelectedZoom] = useState<number>(1)
    const [availableZooms, setAvailableZooms] = useState<number[]>([])

    // ── Load venues + handle pre-filled venueId from URL ────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const preId = params.get('venueId')

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

                // If URL already has a venueId, pre-select it and skip to camera
                if (preId) {
                    const match = list.find(v => v.id === preId)
                    if (match) {
                        setSelectedVenueId(match.id)
                        setVenueName(match.name)
                        venueIdRef.current = match.id
                        setPhase('camera')
                    }
                }
            })
            .catch(() => { })
            .finally(() => setVenuesLoading(false))
    }, [])

    // ── Lens switch (works while streaming too) ───────────────────────────────
    const switchZoom = useCallback(async (zoom: number) => {
        selectedZoomRef.current = zoom
        setSelectedZoom(zoom)
        const videoTrack = streamRef.current?.getVideoTracks()[0]
        if (!videoTrack) return
        try {
            await videoTrack.applyConstraints({
                advanced: [{ zoom } as MediaTrackConstraintSet],
            })
        } catch { /* not supported */ }
    }, [])

    // ── ANPR helpers ─────────────────────────────────────────────────────────
    const stopAnpr = useCallback(() => {
        if (anprRef.current) {
            clearInterval(anprRef.current)
            anprRef.current = null
        }
        setAnprScanning(false)
    }, [])

    const startAnpr = useCallback(() => {
        if (anprRef.current) return
        setAnprScanning(true)
        anprRef.current = setInterval(async () => {
            const video = videoRef.current
            const canvas = canvasRef.current
            if (!video || !canvas || video.videoWidth === 0) return

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            canvas.getContext('2d')?.drawImage(video, 0, 0)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7)

            try {
                const res = await fetch('/api/anpr/detect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: dataUrl }),
                })
                const data = await res.json()
                if (data.success && data.plates?.length > 0) {
                    const plate = data.plates[0]
                    setLastPlate(plate.ocr_text)
                    // Push result to the signal store so the dashboard reads the
                    // phone-quality detection instead of running its own.
                    const vid = venueIdRef.current
                    if (vid) {
                        fetch(`/api/signal?venueId=${encodeURIComponent(vid)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'plate',
                                text: plate.ocr_text,
                                confidence: plate.confidence_value ?? 0,
                            }),
                        }).catch(() => { })
                    }
                }
            } catch {
                // Ignore — ANPR may not be running
            }
        }, 2500)
    }, [])

    // ── Cleanup ──────────────────────────────────────────────────────────────
    const cleanup = useCallback(async () => {
        if (pollRef.current) clearInterval(pollRef.current)
        stopAnpr()
        if (pcRef.current) {
            pcRef.current.close()
            pcRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        const vid = venueIdRef.current
        if (vid) {
            await fetch(`/api/signal?venueId=${encodeURIComponent(vid)}`, {
                method: 'DELETE',
            }).catch(() => { })
        }
    }, [stopAnpr])

    // ── Start streaming ──────────────────────────────────────────────────────
    const startStreaming = useCallback(async () => {
        try {
            setStatus('connecting')
            setError('')
            setLastPlate(null)

            const vid = venueIdRef.current
            if (!vid) {
                setError('No venue selected.')
                setStatus('error')
                return
            }

            if (!navigator.mediaDevices?.getUserMedia) {
                const isHttp =
                    window.location.protocol === 'http:' &&
                    !['localhost', '127.0.0.1'].includes(window.location.hostname)
                throw new Error(isHttp ? 'HTTPS_REQUIRED' : 'Camera API not supported in this browser.')
            }

            // Reset signaling for this venue
            await fetch(`/api/signal?venueId=${encodeURIComponent(vid)}`, { method: 'DELETE' })

            // Access rear camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 60 },
                },
                audio: false,
            })
            streamRef.current = stream
            if (videoRef.current) videoRef.current.srcObject = stream

            // Detect available lenses and apply selected zoom
            try {
                const videoTrack = stream.getVideoTracks()[0]
                const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & {
                    zoom?: { min: number; max: number; step: number }
                }
                if (caps.zoom) {
                    const levels = ([0.5, 1, 2] as number[]).filter(
                        z => z >= caps.zoom!.min && z <= caps.zoom!.max
                    )
                    setAvailableZooms(levels)
                    const z = Math.max(caps.zoom.min, Math.min(selectedZoomRef.current, caps.zoom.max))
                    await videoTrack.applyConstraints({
                        advanced: [{ zoom: z } as MediaTrackConstraintSet],
                    })
                }
            } catch {
                // Zoom constraints not supported on this browser/device — ignore
            }

            // Start ANPR as soon as the camera is live (before WebRTC connects)
            startAnpr()

            const pc = new RTCPeerConnection(RTC_CONFIG)
            pcRef.current = pc
            stream.getTracks().forEach(track => pc.addTrack(track, stream))

            pc.onicecandidate = async ({ candidate }) => {
                if (candidate) {
                    await fetch(`/api/signal?venueId=${encodeURIComponent(vid)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'phone-ice', candidate: candidate.toJSON() }),
                    }).catch(() => { })
                }
            }

            pc.onconnectionstatechange = () => {
                const s = pc.connectionState
                if (s === 'connected') setStatus('streaming')
                if (s === 'disconnected' || s === 'failed' || s === 'closed') setStatus('idle')
            }

            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            await fetch(`/api/signal?venueId=${encodeURIComponent(vid)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'offer', sdp: pc.localDescription }),
            })

            const appliedIce = new Set<string>()
            pollRef.current = setInterval(async () => {
                if (!pcRef.current) return
                try {
                    const res = await fetch(
                        `/api/signal?role=phone&venueId=${encodeURIComponent(vid)}`
                    )
                    const data = await res.json()

                    if (data.answer && pcRef.current.remoteDescription === null) {
                        await pcRef.current.setRemoteDescription(data.answer)
                    }
                    for (const ice of data.ice ?? []) {
                        const key = JSON.stringify(ice)
                        if (!appliedIce.has(key)) {
                            appliedIce.add(key)
                            await pcRef.current.addIceCandidate(ice).catch(() => { })
                        }
                    }
                } catch {
                    // Network hiccup — keep polling
                }
            }, 500)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to access camera'
            setError(msg)
            setStatus('error')
        }
    }, [startAnpr])

    const stopStreaming = useCallback(async () => {
        await cleanup()
        setStatus('idle')
    }, [cleanup])

    useEffect(() => {
        return () => { cleanup() }
    }, [cleanup])

    // ── Venue selection confirm ───────────────────────────────────────────────
    const confirmVenue = () => {
        if (!selectedVenueId) return
        const venue = venues.find(v => v.id === selectedVenueId)
        if (!venue) return
        venueIdRef.current = selectedVenueId
        setVenueName(venue.name)
        setPhase('camera')
    }

    // ── Status visuals ────────────────────────────────────────────────────────
    const statusDot =
        status === 'streaming'
            ? 'bg-red-500 animate-pulse'
            : status === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-slate-500'

    const statusLabel =
        status === 'streaming'
            ? 'LIVE'
            : status === 'connecting'
                ? 'Connecting…'
                : status === 'error'
                    ? 'Error'
                    : 'Ready'

    // ── Render ────────────────────────────────────────────────────────────────
    if (phase === 'venue-select') {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
                <div className="w-full max-w-sm space-y-5">
                    {/* Logo / title */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-600 mb-4">
                            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                        </div>
                        <h1 className="text-white text-xl font-bold">ParkFlow Camera</h1>
                        <p className="text-slate-400 text-sm mt-1">Select your parking location</p>
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
                                            ? 'bg-sky-900/50'
                                            : 'hover:bg-slate-800'
                                        }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selectedVenueId === venue.id
                                                ? 'border-sky-500 bg-sky-500'
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
                                        <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <button
                        onClick={confirmVenue}
                        disabled={!selectedVenueId}
                        className="w-full py-3.5 rounded-xl bg-sky-600 text-white font-bold text-base active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        Continue
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        )
    }

    // ── Camera phase ──────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            {/* Hidden canvas for ANPR frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            <div className="w-full max-w-sm space-y-4">
                {/* Status header */}
                <div className="flex items-center justify-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
                    <span className="text-white font-bold text-sm uppercase tracking-widest">
                        {statusLabel}
                    </span>
                </div>

                {/* Venue badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1.5">
                        <MapPin className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-sky-300 text-xs font-medium">{venueName}</span>
                    </div>
                    {status === 'idle' || status === 'error' ? (
                        <button
                            onClick={() => {
                                stopStreaming()
                                setPhase('venue-select')
                            }}
                            className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                        >
                            Change location
                        </button>
                    ) : null}
                </div>

                {/* Camera preview — portrait 9:16 */}
                <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-[9/16] border border-slate-700 relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    {/* ANPR scanning indicator */}
                    {anprScanning && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                            <ScanLine className="w-3 h-3 text-emerald-400" />
                            <span className="text-xs text-emerald-400 font-medium">ANPR</span>
                        </div>
                    )}

                    {/* Lens selector — overlaid at bottom of preview */}
                    {availableZooms.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            {availableZooms.map(z => (
                                <button
                                    key={z}
                                    onClick={() => switchZoom(z)}
                                    className={`w-11 h-11 rounded-full font-bold text-sm transition-all active:scale-90 ${
                                        selectedZoom === z
                                            ? 'bg-white text-black shadow-lg'
                                            : 'bg-black/60 text-white border border-white/30 backdrop-blur-sm'
                                    }`}
                                >
                                    {z}x
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detected plate display */}
                {lastPlate && (
                    <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-3 flex items-center gap-3">
                        <ScanLine className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                            <p className="text-emerald-400 text-xs font-medium mb-0.5">Plate Detected</p>
                            <p className="text-white font-mono font-bold text-lg tracking-widest">
                                {lastPlate}
                            </p>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    error === 'HTTPS_REQUIRED' ? (
                        <div className="bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 space-y-2">
                            <p className="text-red-400 text-sm font-semibold text-center">
                                HTTPS required for camera access
                            </p>
                            <ol className="text-slate-300 text-xs space-y-1 list-decimal list-inside">
                                <li>
                                    Restart with{' '}
                                    <code className="bg-slate-800 px-1 rounded text-sky-400">
                                        npm run dev -- --experimental-https
                                    </code>
                                </li>
                                <li>
                                    Or flag{' '}
                                    <code className="bg-slate-800 px-1 rounded text-sky-400">
                                        chrome://flags/#unsafely-treat-insecure-origin-as-secure
                                    </code>
                                </li>
                            </ol>
                        </div>
                    ) : (
                        <p className="text-red-400 text-sm text-center bg-red-950/50 rounded-lg px-4 py-2 border border-red-900">
                            {error}
                        </p>
                    )
                )}

                {/* Action button */}
                {status === 'idle' || status === 'error' ? (
                    <button
                        onClick={startStreaming}
                        className="w-full py-3.5 rounded-xl bg-sky-600 text-white font-bold text-base active:scale-95 transition-transform"
                    >
                        Start Streaming
                    </button>
                ) : status === 'streaming' ? (
                    <button
                        onClick={stopStreaming}
                        className="w-full py-3.5 rounded-xl bg-red-600 text-white font-bold text-base active:scale-95 transition-transform"
                    >
                        Stop Streaming
                    </button>
                ) : (
                    <button
                        disabled
                        className="w-full py-3.5 rounded-xl bg-slate-700 text-slate-400 font-bold text-base cursor-not-allowed"
                    >
                        Connecting…
                    </button>
                )}

                <p className="text-slate-600 text-xs text-center">
                    Keep this page open while streaming · Dashboard → Live Feed to view
                </p>
            </div>
        </div>
    )
}
