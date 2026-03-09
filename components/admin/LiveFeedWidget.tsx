'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Video,
    Settings,
    Wifi,
    WifiOff,
    Loader2,
} from 'lucide-react'

/**
 * LiveFeedWidget — Shared component for embedding a phone camera's MJPEG stream.
 *
 * Supports:
 * - IP Webcam (Android): http://<ip>:8080/video
 * - Camo (iPhone): similar HTTP stream
 * - Any MJPEG over HTTP source
 *
 * Camera URL is stored in localStorage under key `parkflow_camera_url`.
 */
export default function LiveFeedWidget({ compact = false }: { compact?: boolean }) {
    const [cameraUrl, setCameraUrl] = React.useState<string>('')
    const [savedUrl, setSavedUrl] = React.useState<string>('')
    const [isConnected, setIsConnected] = React.useState(false)
    const [showSetup, setShowSetup] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const imgRef = React.useRef<HTMLImageElement>(null)

    React.useEffect(() => {
        const stored = localStorage.getItem('parkflow_camera_url')
        if (stored) {
            setCameraUrl(stored)
            // Normalize & auto-connect
            let url = stored.trim()
            if (
                !url.includes('/video') &&
                !url.includes('/shot') &&
                !url.includes('.mjpg')
            ) {
                if (url.endsWith('/')) url = url.slice(0, -1)
                url = url + '/video'
            }
            setSavedUrl(url)
        }
    }, [])

    const handleConnect = () => {
        if (!cameraUrl.trim()) return
        setIsLoading(true)
        let url = cameraUrl.trim()
        if (
            !url.includes('/video') &&
            !url.includes('/shot') &&
            !url.includes('.mjpg')
        ) {
            if (url.endsWith('/')) url = url.slice(0, -1)
            url = url + '/video'
        }
        localStorage.setItem('parkflow_camera_url', cameraUrl.trim())
        setSavedUrl(url)
        setIsConnected(false)
        setTimeout(() => setIsLoading(false), 2000)
    }

    const handleDisconnect = () => {
        setSavedUrl('')
        setIsConnected(false)
        localStorage.removeItem('parkflow_camera_url')
        setCameraUrl('')
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-sky-600" />
                    <h2 className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-base' : 'text-lg'}`}>
                        Live Parking Cameras
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {savedUrl && (
                        <div
                            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isConnected
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                }`}
                        >
                            {isConnected ? (
                                <>
                                    <Wifi className="w-3 h-3" />
                                    Connected
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-3 h-3" />
                                    Connecting...
                                </>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setShowSetup(!showSetup)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Setup Panel */}
            <AnimatePresence>
                {(showSetup || !savedUrl) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800 p-4 mb-4">
                            <h6 className="text-sm font-semibold text-sky-800 dark:text-sky-300 mb-2">
                                📱 Connect Phone Camera
                            </h6>
                            <ol className="text-xs text-sky-700 dark:text-sky-400 space-y-1 list-decimal list-inside mb-3">
                                <li>
                                    Install <strong>&quot;IP Webcam&quot;</strong> (Android)
                                    or <strong>&quot;Camo&quot;</strong> (iPhone)
                                </li>
                                <li>
                                    Point your phone camera at the parking area and start
                                    the server
                                </li>
                                <li>
                                    Enter the IP address shown (e.g.{' '}
                                    <code className="bg-sky-100 px-1 rounded">
                                        http://192.168.1.5:8080
                                    </code>
                                    )
                                </li>
                            </ol>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={cameraUrl}
                                    onChange={(e) => setCameraUrl(e.target.value)}
                                    placeholder="http://192.168.1.5:8080"
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <button
                                    onClick={handleConnect}
                                    disabled={!cameraUrl.trim() || isLoading}
                                    className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading ? 'Connecting...' : 'Connect'}
                                </button>
                                {savedUrl && (
                                    <button
                                        onClick={handleDisconnect}
                                        className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                                    >
                                        Disconnect
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Feed Viewer */}
            {savedUrl ? (
                <div
                    className={`rounded-2xl border border-slate-200 bg-black overflow-hidden relative ${compact ? 'max-h-[300px]' : 'max-h-[500px]'
                        }`}
                >
                    {/* LIVE badge */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <motion.div
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-2 h-2 bg-red-500 rounded-full"
                        />
                        <span className="text-xs font-semibold text-white">LIVE</span>
                    </div>

                    {/* Camera name */}
                    <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <span className="text-xs font-medium text-white/80">Parking Camera</span>
                    </div>

                    {/* Timestamp */}
                    <div className="absolute bottom-3 right-3 z-10 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <LiveTimestamp />
                    </div>

                    {/* MJPEG Stream */}
                    <img
                        ref={imgRef}
                        src={savedUrl}
                        alt="Live parking camera feed"
                        className={`w-full h-auto object-contain ${compact ? 'min-h-[200px]' : 'min-h-[300px]'
                            }`}
                        onLoad={() => {
                            setIsConnected(true)
                            setIsLoading(false)
                        }}
                        onError={() => {
                            setIsConnected(false)
                            setIsLoading(false)
                        }}
                    />

                    {/* Error overlay */}
                    {!isConnected && !isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                            <WifiOff className="w-10 h-10 text-slate-400 mb-3" />
                            <p className="text-white font-medium text-sm mb-1">
                                Camera Disconnected
                            </p>
                            <p className="text-slate-400 text-xs text-center max-w-xs">
                                Ensure the camera app is running and both devices are on the
                                same WiFi network
                            </p>
                            <button
                                onClick={handleConnect}
                                className="mt-3 px-4 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
                            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                            <p className="text-white text-sm font-medium">
                                Connecting to camera...
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center mb-3">
                        <Video className="w-6 h-6 text-sky-600" />
                    </div>
                    <h5 className="text-base font-semibold text-slate-800 dark:text-white mb-1">
                        No Camera Connected
                    </h5>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                        Connect your phone camera to view a live feed.
                        Click ⚙️ to get started.
                    </p>
                </div>
            )}
        </div>
    )
}

function LiveTimestamp() {
    const [time, setTime] = React.useState(new Date())

    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
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
