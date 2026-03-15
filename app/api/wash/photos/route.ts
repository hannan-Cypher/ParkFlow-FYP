import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/getUser';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wash/photos
 *
 * Upload after-wash photos (washer only).
 * Body: { photos: Array<{ data: string (base64 data URL) }> }
 * Returns: { urls: string[] }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'washer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { photos } = body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'At least one photo is required' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'wash');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const urls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (!photo.data) continue;

      const matches = photo.data.match(/^data:image\/([\w+]+);base64,(.+)$/);
      if (!matches) continue;

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `wash_${Date.now()}_${i}.${ext}`;
      const filepath = path.join(uploadDir, filename);

      fs.writeFileSync(filepath, buffer);
      urls.push(`/uploads/wash/${filename}`);
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No valid photos could be processed' }, { status: 400 });
    }

    return NextResponse.json({ urls });
  } catch (err) {
    console.error('POST /api/wash/photos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
