"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, Maximize2, X } from "lucide-react";

export interface QRCodeDisplayProps {
  sessionId: string;
  licensePlate: string;
  venueName?: string;
  entryTime?: string;
  slotNumber?: string;
  size?: "sm" | "md" | "lg";
  showActions?: boolean;
  variant?: "ticket" | "compact";
  className?: string;
}

const SIZE_MAP = { sm: 120, md: 180, lg: 260 };

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export default function QRCodeDisplay({
  sessionId,
  licensePlate,
  venueName,
  entryTime,
  slotNumber,
  size = "md",
  showActions = true,
  variant = "ticket",
  className = "",
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const px = SIZE_MAP[size];

  // Close modal on Escape key
  useEffect(() => {
    if (!enlarged) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enlarged]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = sessionId;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sessionId]);

  const handleDownload = useCallback(() => {
    const container = document.getElementById(`qr-svg-${sessionId}`);
    const svgEl = container?.querySelector("svg");
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const padding = 24;
      const textHeight = 72;
      const canvas = document.createElement("canvas");
      const scale = 2; // retina
      canvas.width = (px + padding * 2) * scale;
      canvas.height = (px + padding * 2 + textHeight) * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // QR code
      ctx.drawImage(img, padding, padding, px, px);

      // Plate text
      ctx.fillStyle = "#111827";
      ctx.font = `bold 18px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(licensePlate, (px + padding * 2) / 2, px + padding + 28);

      // Venue text
      if (venueName) {
        ctx.font = `13px sans-serif`;
        ctx.fillStyle = "#6b7280";
        ctx.fillText(venueName, (px + padding * 2) / 2, px + padding + 48);
      }

      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `parkflow-ticket-${licensePlate}.png`;
      a.click();
    };

    img.src = url;
  }, [sessionId, licensePlate, venueName, px]);

  const qrBlock = (qrPx: number) => (
    <div
      id={`qr-svg-${sessionId}`}
      className="inline-block bg-white p-2 rounded-xl shadow-sm"
    >
      <QRCodeSVG
        value={sessionId}
        size={qrPx}
        level="M"
        bgColor="#ffffff"
        fgColor="#111827"
        includeMargin={false}
      />
    </div>
  );

  if (variant === "compact") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {qrBlock(px)}
        <p className="font-bold font-mono tracking-widest text-sm text-zinc-900 dark:text-white">
          {licensePlate}
        </p>
        {venueName && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{venueName}</p>
        )}
      </div>
    );
  }

  // ticket variant
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-md ${className}`}
      >
        {/* Header strip */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
          <span className="text-white text-xs font-medium uppercase tracking-wide">
            Parking Ticket
          </span>
          <span className="text-blue-100 text-xs font-mono">
            #{sessionId.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* QR + info */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4 gap-3">
          {qrBlock(px)}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col items-center gap-1 text-center"
          >
            <p className="font-black font-mono tracking-widest text-xl text-zinc-900 dark:text-white">
              {licensePlate}
            </p>
            {venueName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{venueName}</p>
            )}
            {slotNumber && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Slot {slotNumber}
              </p>
            )}
            {entryTime && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Checked in {formatTime(entryTime)}
              </p>
            )}
          </motion.div>
        </div>

        {/* Tear divider */}
        {showActions && (
          <div className="relative mx-0 border-t border-dashed border-zinc-300 dark:border-zinc-700">
            <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800" />
            <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800" />
          </div>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className="flex items-center justify-center gap-2 px-6 py-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Save
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy ID</>
              )}
            </button>
            <button
              onClick={() => setEnlarged(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Enlarge
            </button>
          </div>
        )}
      </motion.div>

      {/* Enlarge modal */}
      <AnimatePresence>
        {enlarged && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setEnlarged(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setEnlarged(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {qrBlock(SIZE_MAP.lg)}
              <p className="font-black font-mono tracking-widest text-2xl text-zinc-900 dark:text-white">
                {licensePlate}
              </p>
              {venueName && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{venueName}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
