'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import React, { useState } from 'react'

interface ImagePreviewModalProps {
    isOpen: boolean
    onClose: () => void
    imageUrl: string
    imageAlt?: string
}

export function ImagePreviewModal({ isOpen, onClose, imageUrl, imageAlt }: ImagePreviewModalProps) {
    const [rotation, setRotation] = useState(0)
    const [scale, setScale] = useState(1)

    const handleRotate = (e: React.MouseEvent) => {
        e.stopPropagation()
        setRotation(prev => (prev + 90) % 360)
    }

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation()
        setScale(prev => Math.min(prev + 0.25, 3))
    }

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation()
        setScale(prev => Math.max(prev - 0.25, 0.5))
    }

    const reset = () => {
        setRotation(0)
        setScale(1)
    }

    return (
        <AnimatePresence onExitComplete={reset}>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 sm:p-8"
                >
                    {/* Controls */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-[110]">
                        <button
                            onClick={handleZoomIn}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleZoomOut}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleRotate}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="Rotate"
                        >
                            <RotateCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors ml-2"
                            title="Close"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Image Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden"
                    >
                        <motion.img
                            src={imageUrl}
                            alt={imageAlt || 'Image Preview'}
                            animate={{ rotate: rotation, scale: scale }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl selection:bg-transparent"
                            draggable={false}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
