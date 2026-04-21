'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Video,
    Settings,
    Wifi,
    WifiOff,
    Loader2,
    Smartphone,
    Radio,
    Copy,
    Check,
    MapPin,
    ScanLine,
} from 'lucide-react'

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

type Mode = 'webrtc' | 'ip-camera'

// ─────────────────────────────────────────────
// WebRTC Viewer (admin/staff side)
// venueId + gateId scope the signaling store
// ─────────────────────────────────────────────
export function WebRTCViewer({ compact, venueId, gateId, onPlateDetected, hideInstructions }: { compact: boolean; venueId: string; gateId?: string; onPlateDetected?: (plate: string) => void; hideInstructions?: boolean }) {
    const videoRef = React.useRef<HTMLVideoElement>(null)
    const pcRef = React.useRef<RTCPeerConnection | null>(null)
    const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
    const [connState, setConnState] = React.useState<'waiting' | 'connecting' | 'connected' | 'error'>('waiting')
    const [isListening, setIsListening] = React.useState(false)
    const [pollCount, setPollCount] = React.useState(0)
    const [cameraUrl, setCameraUrl] = React.useState('')
    const [copied, setCopied] = React.useState(false)

    // ANPR result — received from the phone via the signal store (not re-computed here)
    const [lastPlate, setLastPlate] = React.useState<string | null>(null)

    // Build phone URL with venueId + gateId pre-filled
    React.useEffect(() => {
        if (typeof window !== 'undefined' && venueId) {
            const baseUrl = `${window.location.origin}/camera?venueId=${encodeURIComponent(venueId)}`
            setCameraUrl(gateId ? `${baseUrl}&gateId=${encodeURIComponent(gateId)}` : baseUrl)
        }
    }, [venueId, gateId])

    const handleCopy = () => {
        if (!cameraUrl) return
        navigator.clipboard.writeText(cameraUrl).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const startListening = React.useCallback(async () => {
        if (!venueId) return

        // Tear down any existing connection first
        if (pollRef.current) clearInterval(pollRef.current)
        if (pcRef.current) { pcRef.current.close(); pcRef.current = null }

        setConnState('waiting')

        const pc = new RTCPeerConnection(RTC_CONFIG)
        pcRef.current = pc

        // Display incoming stream from phone
        pc.ontrack = ({ streams }) => {
            if (videoRef.current) videoRef.current.srcObject = streams[0]
        }

        pc.onconnectionstatechange = () => {
            const s = pc.connectionState
            if (s === 'connected') setConnState('connected')
            if (s === 'disconnected' || s === 'failed' || s === 'closed') {
                setConnState('waiting')
                setLastPlate(null)
            }
        }

        // Send admin ICE candidates scoped to this venue/gate
        pc.onicecandidate = async ({ candidate }) => {
            if (candidate) {
                await fetch(`/api/signal?venueId=${encodeURIComponent(venueId)}${gateId ? `&gateId=${encodeURIComponent(gateId)}` : ''}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'admin-ice', candidate: candidate.toJSON() }),
                }).catch(() => { })
            }
        }

        // Poll for phone's offer and ICE candidates for this venue/gate
        const appliedIce = new Set<string>()
        setIsListening(true)
        setPollCount(0)
        pollRef.current = setInterval(async () => {
            if (!pcRef.current) return
            setPollCount(n => n + 1)
            try {
                const res = await fetch(
                    `/api/signal?role=admin&venueId=${encodeURIComponent(venueId)}${gateId ? `&gateId=${encodeURIComponent(gateId)}` : ''}`
                )
                const data = await res.json()

                // Got offer from phone — create answer
                if (data.offer && pcRef.current.remoteDescription === null) {
                    setConnState('connecting')
                    await pcRef.current.setRemoteDescription(data.offer)
                    const answer = await pcRef.current.createAnswer()
                    await pcRef.current.setLocalDescription(answer)
                    await fetch(`/api/signal?venueId=${encodeURIComponent(venueId)}${gateId ? `&gateId=${encodeURIComponent(gateId)}` : ''}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'answer', sdp: pcRef.current.localDescription }),
                    })
                }

                // Apply phone ICE candidates
                for (const ice of (data.ice ?? [])) {
                    const key = JSON.stringify(ice)
                    if (!appliedIce.has(key)) {
                        appliedIce.add(key)
                        await pcRef.current.addIceCandidate(ice).catch(() => { })
                    }
                }

                // Read ANPR result pushed by the phone — single source of truth
                if (data.plate?.text) {
                    setLastPlate(data.plate.text)
                    onPlateDetected?.(data.plate.text)
                }
            } catch {
                // Network hiccup — keep polling
            }
        }, 500)
    }, [venueId])

    // Start listening as soon as the viewer mounts (or venueId changes)
    React.useEffect(() => {
        if (!venueId) return
        startListening()
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
            if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
            setLastPlate(null)
        }
    }, [startListening, venueId])

    const stateLabel =
        connState === 'connected' ? 'Connected' :
            connState === 'connecting' ? 'Connecting…' :
                'Waiting for phone'

    const stateDot =
        connState === 'connected' ? 'bg-emerald-500' :
            connState === 'connecting' ? 'bg-amber-400 animate-pulse' :
                'bg-slate-400 animate-pulse'

    return (
        <div className="space-y-3">
            {/* Phone URL instruction card */}
            {!hideInstructions && (
                <div className="rounded-xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="w-4 h-4 text-sky-600" />
                        <span className="text-sm font-semibold text-sky-800 dark:text-sky-300">
                            Open on your phone
                        </span>
                    </div>
                    <p className="text-xs text-sky-700 dark:text-sky-400 mb-3">
                        Connect to the same WiFi — this URL pre-selects your location:
                    </p>
                    <div className="flex gap-2">
                        <code className="flex-1 rounded-lg bg-sky-100 dark:bg-sky-900 px-3 py-2 text-xs text-sky-900 dark:text-sky-200 font-mono truncate border border-sky-200 dark:border-sky-700">
                            {cameraUrl || 'Loading…'}
                        </code>
                        <button
                            onClick={handleCopy}
                            title="Copy URL"
                            className="px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors flex-shrink-0"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            )}

            {/* Video + status */}
            <div
                className={`rounded-2xl border border-slate-200 bg-black overflow-hidden relative min-h-[240px] ${compact ? 'max-h-[60vh]' : 'max-h-[75vh]'
                    }`}
            >
                {/* Status badge */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${stateDot}`} />
                    <span className="text-xs font-semibold text-white">{stateLabel}</span>
                </div>

                {/* WebRTC badge */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Radio className="w-3 h-3 text-sky-400" />
                    <span className="text-xs font-medium text-white/80">WebRTC</span>
                </div>

                {/* ANPR scanning indicator — shown when phone is connected and scanning */}
                {connState === 'connected' && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <ScanLine className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-400">ANPR Active</span>
                    </div>
                )}

                {/* Detected plate overlay */}
                {lastPlate && connState === 'connected' && (
                    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-emerald-900/80 backdrop-blur-sm border border-emerald-600 px-3 py-1.5 rounded-full">
                        <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-white font-mono tracking-widest">{lastPlate}</span>
                    </div>
                )}

                {/* Timestamp */}
                {connState === 'connected' && (
                    <div className="absolute bottom-3 right-3 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <LiveTimestamp />
                    </div>
                )}

                {/* Video element receives the WebRTC stream */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto object-contain"
                />

                {/* Waiting overlay */}
                {connState !== 'connected' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95">
                        {connState === 'connecting' ? (
                            <>
                                <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                                <p className="text-white text-sm font-medium">Connecting to phone…</p>
                            </>
                        ) : (
                            <>
                                <Smartphone className="w-10 h-10 text-slate-500 mb-3" />
                                <p className="text-white font-medium text-sm mb-1">
                                    {hideInstructions ? 'Waiting for camera feed' : 'Waiting for phone'}
                                </p>
                                <p className="text-slate-400 text-xs text-center max-w-xs px-4">
                                    {hideInstructions ? 'Waiting for staff to start the camera stream.' : (
                                        <>Open the URL above on your phone, then tap{' '}<strong className="text-slate-300">Start Streaming</strong>.</>
                                    )}
                                </p>
                                <div className={`mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${isListening
                                    ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-700'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                    {isListening ? `Listening · ${pollCount} polls` : 'Not listening'}
                                </div>
                                <button
                                    onClick={startListening}
                                    className="mt-2 px-4 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
                                >
                                    Reconnect
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Main widget
// ─────────────────────────────────────────────
interface VenueOption { id: string; name: string; city: string }
interface GateOption { id: string; name: string }
type WidgetPhase = 'venue-select' | 'gate-select' | 'view'

export default function LiveFeedWidget({ compact = false }: { compact?: boolean }) {
    const [mode, setMode] = React.useState<Mode>('webrtc')

    // Selection states
    const [phase, setPhase] = React.useState<WidgetPhase>('view')
    const [venueId, setVenueId] = React.useState<string>('')
    const [venueName, setVenueName] = React.useState<string>('')
    const [gateId, setGateId] = React.useState<string>('')
    const [gateName, setGateName] = React.useState<string>('')

    const [venues, setVenues] = React.useState<VenueOption[]>([])
    const [gates, setGates] = React.useState<GateOption[]>([])
    const [venueLoading, setVenueLoading] = React.useState(true)
    const [gatesLoading, setGatesLoading] = React.useState(false)

    React.useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(async data => {
                if (data.user?.venueId) {
                    setVenueId(data.user.venueId)
                    setPhase('view')
                    // Resolve venue name
                    const loc = await fetch('/api/locations').then(r => r.json())
                    const match = (loc.locations ?? []).find((v: VenueOption) => v.id === data.user.venueId)
                    if (match) setVenueName(match.name)
                } else {
                    setPhase('venue-select')
                    const loc = await fetch('/api/locations').then(r => r.json())
                    setVenues(loc.locations ?? [])
                }
            })
            .catch(() => setPhase('venue-select'))
            .finally(() => setVenueLoading(false))
    }, [])

    const selectVenue = async (v: VenueOption) => {
        setVenueId(v.id)
        setVenueName(v.name)
        setGatesLoading(true)
        setPhase('gate-select')
        try {
            const loc = await fetch(`/api/locations/${v.id}/gates`).then(r => r.json())
            setGates(loc.gates ?? [])
        } catch {
            setGates([])
        } finally {
            setGatesLoading(false)
        }
    }

    const selectGate = (g: GateOption) => {
        setGateId(g.id)
        setGateName(g.name)
        setPhase('view')
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Video className="w-5 h-5 text-sky-600" />
                    <h2 className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-base' : 'text-lg'}`}>
                        Live Parking Cameras
                    </h2>
                    {/* Venue pill */}
                    {venueName && (
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-[10px] font-bold px-2 py-1 rounded-full border border-sky-200 dark:border-sky-700 uppercase tracking-wider">
                                <MapPin className="w-3 h-3" />
                                {venueName}
                            </span>
                            {gateName && (
                                <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-200 dark:border-amber-700 uppercase tracking-wider">
                                    <ScanLine className="w-3 h-3" />
                                    {gateName}
                                </span>
                            )}
                            {venues.length > 0 && phase === 'view' && (
                                <button
                                    onClick={() => { setPhase('venue-select'); setVenueId(''); setVenueName(''); setGateId(''); setGateName(''); }}
                                    className="text-[10px] font-bold text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors underline-offset-2 hover:underline uppercase tracking-tight"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Mode toggle */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => setMode('webrtc')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'webrtc'
                            ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Radio className="w-3 h-3" />
                        WebRTC
                    </button>
                    <button
                        onClick={() => setMode('ip-camera')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'ip-camera'
                            ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <ScanLine className="w-3 h-3" />
                        IP Camera
                    </button>
                </div>
            </div>

            {/* Mode hint */}
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                {mode === 'webrtc'
                    ? '~100–200ms latency · H.264 · No app needed'
                    : mode === 'ip-camera'
                        ? 'AI Processed Feed · YOLOv8 Real-time · Hikvision RTSP'
                        : '~500ms–1.5s latency · MJPEG · Requires IP Webcam / Camo'}
            </p>

            {/* Selection UI */}
            {phase === 'venue-select' && (
                <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-tight">
                        <MapPin className="w-4 h-4 text-sky-500" />
                        Select Venue
                    </p>
                    {venueLoading ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading venues…
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {venues.map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => selectVenue(v)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors text-left"
                                >
                                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">{v.name}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{v.city}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {phase === 'gate-select' && (
                <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-tight">
                        <ScanLine className="w-4 h-4 text-amber-500" />
                        Select Gate at {venueName}
                    </p>
                    {gatesLoading ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading gates…
                        </div>
                    ) : gates.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-slate-400 text-xs mb-3">No gates found for this venue.</p>
                            <button onClick={() => setPhase('venue-select')} className="text-xs text-sky-500 font-bold uppercase">Back to venues</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {gates.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => selectGate(g)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
                                >
                                    <ScanLine className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <p className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">{g.name}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Viewer */}
            {phase === 'view' ? (
                mode === 'webrtc' ? (
                    venueId ? (
                        <WebRTCViewer compact={compact} venueId={venueId} gateId={gateId} />
                    ) : (
                        <p className="text-slate-400 text-sm text-center py-8">
                            No venue assigned. Contact your administrator.
                        </p>
                    )
                ) : (
                    <IPCameraViewer compact={compact} venueId={venueId} gateId={gateId} />
                )
            ) : null}
        </div>
    )
}

// ─────────────────────────────────────────────
// IP Camera Viewer (AI Processed Feed)
// ─────────────────────────────────────────────
function IPCameraViewer({ compact, venueId, gateId }: { compact: boolean; venueId?: string; gateId?: string }) {
    const [selectedGateId, setSelectedGateId] = React.useState<string>(gateId || '')
    const [gates, setGates] = React.useState<any[]>([])
    const [isRaw, setIsRaw] = React.useState(false)
    const streamUrl = venueId
        ? `/api/camera/stream?venue_id=${venueId}${selectedGateId ? `&gate_id=${selectedGateId}` : ''}${isRaw ? '&raw=true' : ''}`
        : "/api/camera/stream"
    const [isConnected, setIsConnected] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)
    const [lastDetection, setLastDetection] = React.useState<{ text: string; conf: string } | null>(null)
    const [isTriggering, setIsTriggering] = React.useState(false)
    const imgRef = React.useRef<HTMLImageElement>(null)

    // Sync selectedGateId with prop if it changes
    React.useEffect(() => {
        if (gateId) setSelectedGateId(gateId)
    }, [gateId])

    // Load gates for this venue (fallback if gateId not provided or for selection)
    React.useEffect(() => {
        if (venueId && !gateId) {
            fetch(`/api/locations/${venueId}/gates`)
                .then(r => r.json())
                .then(data => {
                    setGates(data.gates ?? [])
                    if (data.gates?.length > 0 && !selectedGateId) {
                        setSelectedGateId(data.gates[0].id)
                    }
                })
                .catch(console.error)
        }
    }, [venueId, gateId])

    const triggerSnapshot = async () => {
        setIsTriggering(true)
        try {
            const res = await fetch("/api/camera/trigger", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ venue_id: venueId, gate_id: selectedGateId })
            })
            const data = await res.json()
            if (data.success) {
                setLastDetection({ text: data.text, conf: data.confidence })
            }
        } catch (e) {
            console.error("Failed to trigger snapshot", e)
        } finally {
            setIsTriggering(false)
        }
    }

    return (
        <div className="space-y-3">
            <div
                className={`rounded-2xl border border-slate-200 bg-black overflow-hidden relative ${compact ? 'max-h-[300px]' : 'max-h-[500px]'
                    }`}
            >
                {/* LIVE badge */}
                <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                        <motion.div
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-2 h-2 bg-rose-500 rounded-full"
                        />
                        <span className="text-[10px] font-bold text-white tracking-wider uppercase">{isRaw ? 'PRE-PROCESSING FEED' : 'PROCESSED FEED'}</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => { setIsRaw(!isRaw); setIsLoading(true); setIsConnected(false); }}
                            className={`bg-black/60 backdrop-blur-sm text-[10px] font-bold border border-white/10 rounded-full px-3 py-1 transition-colors ${isRaw ? 'text-sky-400' : 'text-slate-400'}`}
                        >
                            {isRaw ? 'SWITCH TO PROCESSED' : 'SWITCH TO RAW'}
                        </button>

                        {gates.length > 1 && (
                            <select
                                value={selectedGateId}
                                onChange={(e) => {
                                    setSelectedGateId(e.target.value);
                                    setIsLoading(true);
                                    setIsConnected(false);
                                }}
                                className="bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white border border-white/10 rounded-full px-2 py-1 outline-none appearance-none cursor-pointer hover:bg-black/80 transition-colors"
                            >
                                {gates.map(g => (
                                    <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Connection Status */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-medium text-white/80">
                        {isConnected ? 'Stream Active' : 'Connecting…'}
                    </span>
                </div>

                <img
                    ref={imgRef}
                    src={streamUrl}
                    alt="Processed IP Camera feed"
                    className={`w-full h-auto object-contain ${compact ? 'min-h-[200px]' : 'min-h-[300px]'}`}
                    onLoad={() => { setIsConnected(true); setIsLoading(false) }}
                    onError={() => { setIsConnected(false); setIsLoading(false) }}
                />

                {!isConnected && !isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                        <WifiOff className="w-10 h-10 text-slate-400 mb-3" />
                        <p className="text-white font-medium text-sm mb-1">Backend Offline</p>
                        <p className="text-slate-400 text-xs text-center max-w-xs">
                            Start the camera streamer script: <br />
                            <code className="bg-slate-800 px-1 rounded mt-1 block font-mono">python model/camera_streamer.py</code>
                        </p>
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                        <p className="text-white text-sm font-medium">Initializing Stream…</p>
                    </div>
                )}

                {/* Automation Overlay */}
                {isConnected && (
                    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
                        {lastDetection && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 bg-emerald-900/90 backdrop-blur-sm border border-emerald-500/50 px-3 py-2 rounded-xl shadow-lg"
                            >
                                <div className="p-1 bg-emerald-500 rounded-lg">
                                    <ScanLine className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Last Detection</span>
                                    <span className="text-sm font-black text-white font-mono">{lastDetection.text}</span>
                                </div>
                                <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                                    {lastDetection.conf}
                                </span>
                            </motion.div>
                        )}

                        <button
                            onClick={triggerSnapshot}
                            disabled={isTriggering}
                            className="group flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isTriggering ? (
                                <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                            ) : (
                                <ScanLine className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                            )}
                            <span className="text-xs font-bold text-white uppercase tracking-tight">
                                {isTriggering ? 'Processing...' : 'Manual Trigger'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// Shared timestamp
// ─────────────────────────────────────────────
function LiveTimestamp() {
    const [time, setTime] = React.useState(new Date())
    React.useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])
    return (
        <span className="text-xs font-mono text-white/80">
            {time.toLocaleTimeString('en-PK', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            })}
        </span>
    )
}
