import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'webnario-power-secret-change-in-production'
);

export type SessionPayload = {
  registrationId: string;
  editionId: string;
  email: string;
  name: string;
};

export type AdminPayload = {
  role: 'admin';
};

export async function createUserSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8d')
    .setIssuedAt()
    .sign(SECRET);
}

export async function createAdminSession(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyUserSession(): Promise<SessionPayload | null> {
  try {
    const token = cookies().get('session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== 'user') return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  try {
    const token = cookies().get('admin_session')?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export async function verifyUserSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  try {
    const token = req.cookies.get('session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== 'user') return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function verifyAdminFromRequest(req: NextRequest): Promise<boolean> {
  try {
    const token = req.cookies.get('admin_session')?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export async function createStaffToken(name: string): Promise<string> {
  return new SignJWT({ role: 'staff', name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyStaffToken(token: string): Promise<{ name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.role !== 'staff') return null;
    return { name: payload.name as string };
  } catch {
    return null;
  }
}

export function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
