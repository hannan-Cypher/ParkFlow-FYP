import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';


const FLASK_AI_URL = process.env.FLASK_AI_URL ?? 'http://localhost:8080'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${FLASK_AI_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { success: false, error: `AI service error: ${error}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[ANPR detect] error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to reach AI service. Is it running?' },
      { status: 503 }
    )
  }
}