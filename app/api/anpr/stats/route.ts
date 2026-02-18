import { NextResponse } from 'next/server'

const FLASK_AI_URL = process.env.FLASK_AI_URL ?? 'http://localhost:8080'

export async function GET() {
  try {
    const response = await fetch(`${FLASK_AI_URL}/stats`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'AI service error' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[ANPR stats] error:', err)
    return NextResponse.json(
      { error: 'Failed to reach AI service. Is it running?' },
      { status: 503 }
    )
  }
}
