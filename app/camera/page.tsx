'use client'

/**
 * /camera — Phone broadcaster page.
 *
 * Step 1: Pick which mall this camera is located at.
 * Step 2: Pick which gate this camera is located at.
 * Step 3: Stream live video via WebRTC to that gate's admin/staff dashboard.
 *         ANPR runs automatically every 2.5 s and displays any detected plate.
 *
 * Open on phone: http://<server-ip>:3000/camera
 * Admin can also share a pre-filled URL: /camera?venueId=<uuid>&gateId=<uuid>
 */

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { MapPin, ChevronRight, ScanLine, Loader2 } from 'lucide-react'

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

type Status = 'idle' | 'connecting' | 'streaming' | 'error'
type Phase = 'venue-select' | 'gate-select' | 'camera'

interface Venue {
    id: string
    name: string
    city: string
}

interface Gate {
    id: string
    name: string
}

export default function CameraPage() {
    // ── Venue selection ──────────────────────────────────────────────────────
    const [venues, setVenues] = useState<Venue[]>([])
    const [venuesLoading, setVenuesLoading] = useState(true)
    const [selectedVenueId, setSelectedVenueId] = useState('')
    const [venueName, setVenueName] = useState('')

    // ── Gate selection ───────────────────────────────────────────────────────
    const [gates, setGates] = useState<Gate[]>([])
    const [gatesLoading, setGatesLoading] = useState(false)
    const [selectedGateId, setSelectedGateId] = useState('')
    const [gateName, setGateName] = useState('')

    const [phase, setPhase] = useState<Phase>('venue-select')

    // Refs keep the current IDs accessible inside memoized callbacks
    const venueIdRef = useRef('')
    const gateIdRef = useRef('')

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
        const preVenueId = params.get('venueId')
        const preGateId = params.get('gateId')

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

                // If URL already has a venueId, pre-select it
                if (preVenueId) {
                    const vMatch = list.find(v => v.id === preVenueId)
                    if (vMatch) {
                        setSelectedVenueId(vMatch.id)
                        setVenueName(vMatch.name)
                        venueIdRef.current = vMatch.id

                        if (preGateId) {
                            setSelectedGateId(preGateId)
                            gateIdRef.current = preGateId
                            // We don't have the gate name yet but we'll try to find it after fetch
                            fetch(`/api/locations/${vMatch.id}/gates`)
                                .then(r => r.json())
                                .then(gData => {
                                    const gList = gData.gates ?? []
                                    setGates(gList)
                                    const gMatch = gList.find((g: Gate) => g.id === preGateId)
                                    if (gMatch) setGateName(gMatch.name)
                                    setPhase('camera')
                                })
                        } else {
                            // Let them select gate
                            loadGates(vMatch.id)
                        }
                    }
                }
            })
            .catch(() => { })
            .finally(() => setVenuesLoading(false))
    }, [])

    const loadGates = (vid: string) => {
        setGatesLoading(true)
        setPhase('gate-select')
        fetch(`/api/locations/${vid}/gates`)
            .then(r => r.json())
            .then(data => setGates(data.gates ?? []))
            .catch(() => setGates([]))
            .finally(() => setGatesLoading(false))
    }

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

                    const vid = venueIdRef.current
                    const gid = gateIdRef.current
                    if (vid) {
                        const url = `/api/signal?venueId=${encodeURIComponent(vid)}${gid ? `&gateId=${encodeURIComponent(gid)}` : ''}`
                        fetch(url, {
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
                // Ignore
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
        const gid = gateIdRef.current
        if (vid) {
            const url = `/api/signal?venueId=${encodeURIComponent(vid)}${gid ? `&gateId=${encodeURIComponent(gid)}` : ''}`
            await fetch(url, { method: 'DELETE' }).catch(() => { })
        }
    }, [stopAnpr])

    // ── WebRTC connect ────────────────────────────────────────────────────────
    const connectWebRTC = useCallback(async () => {
        const vid = venueIdRef.current
        const gid = gateIdRef.current
        if (!vid || !streamRef.current) return

        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        if (pcRef.current) { pcRef.current.close(); pcRef.current = null }

        const signalUrl = `/api/signal?venueId=${encodeURIComponent(vid)}${gid ? `&gateId=${encodeURIComponent(gid)}` : ''}`
        await fetch(signalUrl, { method: 'DELETE' }).catch(() => { })

        const pc = new RTCPeerConnection(RTC_CONFIG)
        pcRef.current = pc
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!))

        pc.onicecandidate = async ({ candidate }) => {
            if (candidate) {
                await fetch(signalUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'phone-ice', candidate: candidate.toJSON() }),
                }).catch(() => { })
            }
        }

        pc.onconnectionstatechange = () => {
            const s = pc.connectionState
            if (s === 'connected') setStatus('streaming')
            if (s === 'disconnected' || s === 'failed' || s === 'closed') {
                setStatus('connecting')
                setTimeout(connectWebRTC, 2000)
            }
        }

        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            await fetch(signalUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'offer', sdp: pc.localDescription }),
            })
        } catch (e) {
            console.error('Failed to create offer', e)
        }

        const appliedIce = new Set<string>()
        pollRef.current = setInterval(async () => {
            if (!pcRef.current) return
            try {
                const res = await fetch(
                    `/api/signal?role=phone&venueId=${encodeURIComponent(vid)}${gid ? `&gateId=${encodeURIComponent(gid)}` : ''}`
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
                // Network hiccup
            }
        }, 500)
    }, [])

    // ── Start streaming (Camera + WebRTC) ────────────────────────────────────
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

            try {
                const videoTrack = stream.getVideoTracks()[0]
                const caps = videoTrack.getCapabilities() as any
                if (caps.zoom) {
                    const levels = ([0.5, 1, 2] as number[]).filter(
                        z => z >= caps.zoom.min && z <= caps.zoom.max
                    )
                    setAvailableZooms(levels)
                    const z = Math.max(caps.zoom.min, Math.min(selectedZoomRef.current, caps.zoom.max))
                    await videoTrack.applyConstraints({
                        advanced: [{ zoom: z } as any],
                    })
                }
            } catch { }

            startAnpr()
            connectWebRTC()

        } catch (err: any) {
            setError(err.message || 'Failed to access camera')
            setStatus('error')
        }
    }, [startAnpr, connectWebRTC])

    const stopStreaming = useCallback(async () => {
        await cleanup()
        setStatus('idle')
    }, [cleanup])

    useEffect(() => {
        return () => { cleanup() }
    }, [cleanup])

    // ── Selection actions ────────────────────────────────────────────────────
    const confirmVenue = () => {
        if (!selectedVenueId) return
        const v = venues.find(v => v.id === selectedVenueId)
        if (!v) return
        venueIdRef.current = selectedVenueId
        setVenueName(v.name)
        loadGates(v.id)
    }

    const confirmGate = () => {
        if (!selectedGateId) return
        const g = gates.find(g => g.id === selectedGateId)
        if (!g) return
        gateIdRef.current = selectedGateId
        setGateName(g.name)
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
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-600 mb-4">
                            <MapPin className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-white text-xl font-bold">ParkFlow Camera</h1>
                        <p className="text-slate-400 text-sm mt-1">Select your parking location</p>
                    </div>

                    <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden max-h-[60vh] overflow-y-auto">
                        {venuesLoading ? (
                            <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
                                <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
                                <span>Loading locations…</span>
                            </div>
                        ) : venues.map((venue) => (
                            <button
                                key={venue.id}
                                onClick={() => setSelectedVenueId(venue.id)}
                                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all border-b border-slate-800 last:border-0 ${selectedVenueId === venue.id ? 'bg-sky-900/40 text-white' : 'text-slate-400 hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedVenueId === venue.id ? 'border-sky-500 bg-sky-500' : 'border-slate-600'
                                    }`}>
                                    {selectedVenueId === venue.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div>
                                    <p className="font-bold text-sm uppercase tracking-tight">{venue.name}</p>
                                    <p className="text-[10px] opacity-60 font-medium">{venue.city}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={confirmVenue}
                        disabled={!selectedVenueId}
                        className="w-full py-4 rounded-xl bg-sky-600 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        Pick Gate
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    if (phase === 'gate-select') {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
                <div className="w-full max-w-sm space-y-5">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-600 mb-4">
                            <ScanLine className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-white text-xl font-bold">Pick Gate</h1>
                        <p className="text-slate-400 text-sm mt-1">Station at {venueName}</p>
                    </div>

                    <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden">
                        {gatesLoading ? (
                            <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
                                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                                <span>Loading gates…</span>
                            </div>
                        ) : gates.length === 0 ? (
                            <div className="py-10 text-center">
                                <p className="text-slate-500 text-sm mb-4 uppercase tracking-tighter font-bold">No gates identified</p>
                                <button onClick={() => setPhase('venue-select')} className="text-sky-500 text-xs font-bold uppercase underline underline-offset-4">Change Location</button>
                            </div>
                        ) : gates.map((gate) => (
                            <button
                                key={gate.id}
                                onClick={() => setSelectedGateId(gate.id)}
                                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all border-b border-slate-800 last:border-0 ${selectedGateId === gate.id ? 'bg-amber-900/40 text-white' : 'text-slate-400 hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedGateId === gate.id ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                                    }`}>
                                    {selectedGateId === gate.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <p className="font-bold text-sm uppercase tracking-tight">{gate.name}</p>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={confirmGate}
                            disabled={!selectedGateId}
                            className="w-full py-4 rounded-xl bg-amber-600 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            Start Camera
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPhase('venue-select')}
                            className="w-full py-3 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-300 transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <canvas ref={canvasRef} className="hidden" />

            <div className="w-full max-w-sm space-y-4">
                <div className="flex items-center justify-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
                    <span className="text-white font-bold text-sm uppercase tracking-widest">
                        {statusLabel}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1 self-start">
                            <MapPin className="w-3 h-3 text-sky-400" />
                            <span className="text-sky-300 text-[10px] font-bold uppercase">{venueName}</span>
                        </div>
                        {gateName && (
                            <div className="flex items-center gap-1.5 bg-amber-900/30 rounded-full px-3 py-1 self-start border border-amber-500/20">
                                <ScanLine className="w-3 h-3 text-amber-400" />
                                <span className="text-amber-300 text-[10px] font-bold uppercase">{gateName}</span>
                            </div>
                        )}
                    </div>
                    {status === 'idle' || status === 'error' ? (
                        <button
                            onClick={() => {
                                stopStreaming()
                                setPhase('venue-select')
                                setSelectedGateId('')
                                setGateName('')
                            }}
                            className="text-slate-500 text-[10px] hover:text-slate-300 transition-colors uppercase font-bold tracking-tighter underline underline-offset-2"
                        >
                            Change
                        </button>
                    ) : null}
                </div>

                <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-[9/16] border border-slate-700 relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    {anprScanning && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                            <ScanLine className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-bold">ANPR</span>
                        </div>
                    )}

                    {availableZooms.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            {availableZooms.map(z => (
                                <button
                                    key={z}
                                    onClick={() => switchZoom(z)}
                                    className={`w-11 h-11 rounded-full font-bold text-sm transition-all active:scale-90 ${selectedZoom === z ? 'bg-white text-black shadow-lg' : 'bg-black/60 text-white border border-white/30 backdrop-blur-sm'
                                        }`}
                                >
                                    {z}x
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {lastPlate && (
                    <div className="rounded-xl bg-emerald-950/60 border border-emerald-700 px-4 py-3 flex items-center gap-3">
                        <ScanLine className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                            <p className="text-emerald-400 text-[10px] font-bold uppercase mb-0.5">Plate Detected</p>
                            <p className="text-white font-mono font-bold text-xl tracking-widest">
                                {lastPlate}
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-red-400 text-xs text-center bg-red-950/50 rounded-lg px-4 py-2 border border-red-900 font-medium">
                        {error}
                    </p>
                )}

                {status === 'idle' || status === 'error' ? (
                    <button
                        onClick={startStreaming}
                        className="w-full py-4 rounded-xl bg-sky-600 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-transform"
                    >
                        Start Streaming
                    </button>
                ) : status === 'streaming' ? (
                    <button
                        onClick={stopStreaming}
                        className="w-full py-4 rounded-xl bg-red-600 text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-transform"
                    >
                        Stop Broadcaster
                    </button>
                ) : (
                    <button
                        disabled
                        className="w-full py-4 rounded-xl bg-slate-700 text-slate-400 font-bold text-sm uppercase cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting…
                    </button>
                )}

                <p className="text-slate-600 text-[10px] text-center uppercase font-bold tracking-tighter">
                    Keep this page open · View in Dashboard → Live Feed
                </p>
            </div>
        </div>
    )
}
