# Process Documentation: Customer Dashboard Live Feed Integration

**Date:** 2026-04-21
**Feature:** Real-time WebRTC camera feed visibility for customers.

## Overview
The goal was to allow customers to view the live parking camera feed (already used by staff) directly from their dashboard. This feed is streamed via WebRTC from a staff member's phone camera.

## Implementation Details

### 1. Component Enhancement
Modified `components/admin/LiveFeedWidget.tsx` (specifically the `WebRTCViewer` function) to accept a `hideInstructions?: boolean` prop.
- **Before:** Always showed a "Connect Your Phone Camera" panel with setup instructions and the signaling URL.
- **After:** If `hideInstructions` is true, the setup panel is hidden, and the "Waiting" overlay displays a customer-friendly message ("Waiting for camera feed") instead of instructions for the staff.

### 2. Customer Dashboard Integration
Updated `app/(dashboard)/customer/page.tsx` to handle the live feed.
- **Data Flow:** The `currentSession` (active parking session) is passed to the `LiveFeedTab`.
- **Venue Scoping:** The `venueId` is extracted from the active session and passed to `WebRTCViewer`. This ensures the customer only sees the camera feed for the specific location where their car is parked.
- **UI Replace:** The previous "Live Feed" placeholder (which asked customers to provide their own camera IP) was replaced with the actual `WebRTCViewer`.

## Verification Results
1. The Staff Dashboard continues to show instructions and setup controls as expected.
2. The Customer Dashboard automatically attempts to connect to the venue's signaling channel when an active session exists.
3. The UI gracefully handles the "No Active Session" state.

## Lessons Learned
- **Component Reusability:** Designing staff-facing widgets with a "consumer mode" (via props like `hideInstructions`) allows for rapid feature parity between admin and customer interfaces without code duplication.
- **Privacy & Security:** Always scoping feeds by `venue_id` is critical when moving internal monitoring tools to public-facing dashboards.
