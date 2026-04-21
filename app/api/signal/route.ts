/**
 * WebRTC Signaling API — per-venue
 *
 * Each venue gets its own isolated signal store so only staff assigned
 * to that venue receive the camera feed.
 *
 * All requests must include ?venueId=<uuid>
 * Phone: posts offer, polls for answer  (role=phone)
 * Admin: polls for offer, posts answer  (role=admin)
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';


interface PlateResult {
    text: string
    confidence: number
    detectedAt: number   // Date.now()
}

interface SignalStore {
    offer: RTCSessionDescriptionInit | null
    answer: RTCSessionDescriptionInit | null
    phoneIce: RTCIceCandidateInit[]
    adminIce: RTCIceCandidateInit[]
    plate: PlateResult | null   // latest ANPR result from the phone
}

function emptyStore(): SignalStore {
    return { offer: null, answer: null, phoneIce: [], adminIce: [], plate: null }
}

// Module-level map — one store per venue, persists for the Node.js process lifetime.
const stores = new Map<string, SignalStore>()

function getStore(venueId: string, gateId: string | null): SignalStore {
    const key = gateId ? `${venueId}:${gateId}` : venueId;
    if (!stores.has(key)) stores.set(key, emptyStore())
    return stores.get(key)!
}

/** GET /api/signal?role=phone|admin&venueId=<uuid>&gateId=<uuid> */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const role = searchParams.get('role')
    const venueId = searchParams.get('venueId')
    const gateId = searchParams.get('gateId')

    if (!venueId) return NextResponse.json({ error: 'Missing venueId' }, { status: 400 })

    const store = getStore(venueId, gateId)

    if (role === 'admin') {
        return NextResponse.json({ offer: store.offer, ice: store.phoneIce, plate: store.plate })
    }
    if (role === 'phone') {
        return NextResponse.json({ answer: store.answer, ice: store.adminIce })
    }
    return NextResponse.json({ error: 'Missing role param' }, { status: 400 })
}

/** POST /api/signal?venueId=<uuid>&gateId=<uuid>  body: { type, sdp?, candidate? } */
export async function POST(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const venueId = searchParams.get('venueId')
    const gateId = searchParams.get('gateId')

    if (!venueId) return NextResponse.json({ error: 'Missing venueId' }, { status: 400 })

    const body = await req.json()
    const key = gateId ? `${venueId}:${gateId}` : venueId

    switch (body.type) {
        case 'offer':
            // New phone connection — reset this room's store
            stores.set(key, { offer: body.sdp, answer: null, phoneIce: [], adminIce: [], plate: null })
            break
        case 'answer':
            getStore(venueId, gateId).answer = body.sdp
            break
        case 'phone-ice':
            getStore(venueId, gateId).phoneIce.push(body.candidate)
            break
        case 'admin-ice':
            getStore(venueId, gateId).adminIce.push(body.candidate)
            break
        case 'plate':
            // Phone pushes its ANPR result
            getStore(venueId, gateId).plate = {
                text: body.text,
                confidence: body.confidence ?? 0,
                detectedAt: Date.now(),
            }
            break
        case 'reset':
            stores.set(key, emptyStore())
            break
        default:
            return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
}

/** DELETE /api/signal?venueId=<uuid>&gateId=<uuid> — reset that room's store */
export async function DELETE(req: NextRequest) {
    const venueId = req.nextUrl.searchParams.get('venueId')
    const gateId = req.nextUrl.searchParams.get('gateId')
    const key = (venueId && gateId) ? `${venueId}:${gateId}` : venueId
    if (key) stores.set(key, emptyStore())
    return NextResponse.json({ ok: true })
}
