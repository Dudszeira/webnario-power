import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi'];
const VIDEOS_DIR = path.join(process.cwd(), 'public', 'videos');

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const files = readdirSync(VIDEOS_DIR);
    const found = files.find(f => VIDEO_EXTS.includes(path.extname(f).toLowerCase()));
    if (found) {
      const stat = statSync(path.join(VIDEOS_DIR, found));
      const sizeMB = Math.round(stat.size / (1024 * 1024));
      return NextResponse.json({ exists: true, filename: found, url: `/videos/${found}`, sizeMB });
    }
  } catch { /* dir may not exist */ }

  return NextResponse.json({ exists: false });
}
