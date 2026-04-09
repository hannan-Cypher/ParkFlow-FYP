import { useState, useCallback, useEffect, useRef } from 'react';
import { ActiveShift, ShiftStatus, VenueShiftConfig, ShiftSummary } from './index';

export function useShift() {
    const [shiftStatus, setShiftStatus] = useState<ShiftStatus>("loading");
    const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
    const [venueConfig, setVenueConfig] = useState<VenueShiftConfig>({
        max_break_minutes: 30,
        shift_start_time: "09:00",
        shift_end_time: "18:00",
        enforce_shift_start_window: true,
    });
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);

    const fetchCurrentShift = useCallback(async () => {
        try {
            const res = await fetch("/api/staff/shift/current");
            if (!res.ok) return;
            const data = await res.json();
            setVenueConfig(data.venueConfig ?? { max_break_minutes: 30, shift_start_time: "09:00", shift_end_time: "18:00" });
            if (data.shift) {
                setActiveShift(data.shift);
                setShiftStatus(data.shift.status);
            } else {
                setActiveShift(null);
                setShiftStatus("none");
            }
        } catch {
            setShiftStatus("none");
        }
    }, []);

    const handleStartShift = useCallback(async () => {
        setActionLoading("start");
        try {
            const res = await fetch("/api/staff/shift/start", { method: "POST" });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to start shift"); return; }
            setActiveShift(data.shift);
            setShiftStatus(data.code === "PENDING_APPROVAL" ? "pending_approval" : "active");
        } catch { alert("Network error. Please try again."); }
        finally { setActionLoading(null); }
    }, []);

    const handleBreakStart = useCallback(async () => {
        setActionLoading("break_start");
        try {
            const res = await fetch("/api/staff/shift/break/start", { method: "POST" });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to start break"); return; }
            setActiveShift(data.shift);
            setShiftStatus("on_break");
        } catch { alert("Network error."); }
        finally { setActionLoading(null); }
    }, []);

    const handleBreakEnd = useCallback(async () => {
        setActionLoading("break_end");
        try {
            const res = await fetch("/api/staff/shift/break/end", { method: "POST" });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to end break"); return; }
            setActiveShift(data.shift);
            setShiftStatus("active");
        } catch { alert("Network error."); }
        finally { setActionLoading(null); }
    }, []);

    const handleEndShift = useCallback(async () => {
        setActionLoading("end_shift");
        try {
            const res = await fetch("/api/staff/shift/end", { method: "POST" });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to end shift"); return; }
            setShiftSummary(data.summary);
            setShiftStatus("none");
            setActiveShift(null);
        } catch { alert("Network error."); }
        finally { setActionLoading(null); }
    }, []);

    useEffect(() => {
        fetchCurrentShift();
    }, [fetchCurrentShift]);

    return {
        shiftStatus,
        activeShift,
        venueConfig,
        actionLoading,
        shiftSummary,
        setShiftSummary,
        handleStartShift,
        handleBreakStart,
        handleBreakEnd,
        handleEndShift,
        fetchCurrentShift,
        resetShift: () => {
            setShiftSummary(null);
            setShiftStatus("none");
            setActiveShift(null);
        }
    };
}
