"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  ScanLine,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ImageIcon,
  Activity,
} from "lucide-react";

interface DetectedPlate {
  confidence: string;
  confidence_value: number;
  ocr_text: string;
  ocr_confidence: string;
  image: string;
  filename: string;
  plate_id: number;
  coords: [number, number, number, number];
}

interface DetectionResult {
  success: boolean;
  plates: DetectedPlate[];
  total: number;
  error?: string;
}

const item = {
  hidden: { y: 12, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 220, damping: 22 } },
};

export default function ANPRDetector() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const [cameraActive, setCameraActive] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewSrc(ev.target?.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // ── Camera ───────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setPreviewSrc(null);
        setResult(null);
      }
    } catch {
      alert("Could not access camera. Please check permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreviewSrc(dataUrl);
    setResult(null);
    stopCamera();
  }, [stopCamera]);

  // ── Detection ────────────────────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    if (!previewSrc) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/anpr/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: previewSrc, user_info: "admin" }),
      });
      const data: DetectionResult = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, plates: [], total: 0, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [previewSrc]);

  const reset = useCallback(() => {
    setPreviewSrc(null);
    setResult(null);
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [stopCamera]);

  return (
    <div className="space-y-6">
      {/* Mode switcher */}
      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {(["upload", "camera"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); reset(); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              mode === m
                ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "upload" ? <Upload className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {m === "upload" ? "Upload Image" : "Use Camera"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: input panel */}
        <div className="space-y-4">
          {/* Upload zone */}
          {mode === "upload" && (
            <motion.div variants={item} initial="hidden" animate="show">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {!previewSrc ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-12 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600"
                >
                  <ImageIcon className="h-10 w-10" />
                  <div className="text-center">
                    <p className="font-medium">Click to upload an image</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP</p>
                  </div>
                </button>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                  <img src={previewSrc} alt="Preview" className="w-full object-contain max-h-64" />
                  <button
                    onClick={reset}
                    className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
                  >
                    <XCircle className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Camera panel */}
          {mode === "camera" && (
            <motion.div variants={item} initial="hidden" animate="show" className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 min-h-48">
                {cameraActive ? (
                  <video ref={videoRef} className="w-full object-cover" playsInline muted />
                ) : previewSrc ? (
                  <>
                    <img src={previewSrc} alt="Captured" className="w-full object-contain max-h-64" />
                    <button
                      onClick={reset}
                      className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
                    >
                      <XCircle className="h-4 w-4 text-slate-600" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-48 items-center justify-center text-slate-500">
                    <Camera className="h-12 w-12 opacity-30" />
                  </div>
                )}
              </div>

              {/* hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />

              <div className="flex gap-2">
                {!cameraActive && !previewSrc && (
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={startCamera}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                  >
                    <Camera className="h-4 w-4" /> Start Camera
                  </motion.button>
                )}
                {cameraActive && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={captureFrame}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
                    >
                      <ScanLine className="h-4 w-4" /> Capture
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={stopCamera}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <XCircle className="h-4 w-4" /> Stop
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Detect button */}
          {previewSrc && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2"
            >
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={runDetection}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Detecting...</>
                ) : (
                  <><ScanLine className="h-4 w-4" /> Detect Plate</>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={reset}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Right: results panel */}
        <div>
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-16"
              >
                <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
                <p className="text-sm font-medium text-slate-600">Running AI detection...</p>
              </motion.div>
            )}

            {!loading && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Status banner */}
                <div className={`flex items-center gap-3 rounded-2xl p-4 ${
                  result.success && result.total > 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-amber-50 border border-amber-200"
                }`}>
                  {result.success && result.total > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  ) : (
                    <Activity className="h-5 w-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">
                      {result.success && result.total > 0
                        ? `${result.total} plate${result.total > 1 ? "s" : ""} detected`
                        : result.error ?? "No plates found in this image"}
                    </p>
                  </div>
                </div>

                {/* Plate cards */}
                {result.plates.map((plate) => (
                  <motion.div
                    key={plate.plate_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-4">
                      {/* Plate image */}
                      <div className="shrink-0 rounded-xl overflow-hidden border border-slate-200 w-32 h-16 bg-slate-50">
                        <img
                          src={plate.image}
                          alt={plate.ocr_text}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl font-bold tracking-widest text-slate-900 font-mono">
                            {plate.ocr_text}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                            Detection {plate.confidence}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                            OCR {plate.ocr_confidence}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400 truncate">ID #{plate.plate_id}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {!loading && !result && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-16 text-slate-400"
              >
                <ScanLine className="h-10 w-10 opacity-40" />
                <p className="text-sm">Results will appear here</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
