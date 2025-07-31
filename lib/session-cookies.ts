import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

const TOKEN_NAME = 'mcp-session';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionData {
  sessionId: string;
  serverUrl?: string;
  callbackUrl?: string;
  authState?: 'pending' | 'authorized';
  createdAt: number;
}

/**
 * Server-only functions for managing session cookies
 * These functions can only be called from Server Components and API routes
 */
export class SessionCookies {
  static async createSession(data: Omit<SessionData, 'sessionId' | 'createdAt'>): Promise<string> {
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const sessionData: SessionData = {
      sessionId,
      createdAt: Date.now(),
      ...data
    };

    const token = await new SignJWT({ ...sessionData })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set(TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_MAX_AGE,
      path: '/'
    });

    return sessionId;
  }

  static async getSession(): Promise<SessionData | null> {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(TOKEN_NAME);
      
      if (!token?.value) {
        return null;
      }

      const { payload } = await jwtVerify(token.value, JWT_SECRET);
      return payload as unknown as SessionData;
    } catch (error) {
      console.error('Failed to verify session token:', error);
      return null;
    }
  }

  static async updateSession(updates: Partial<SessionData>): Promise<void> {
    const currentSession = await this.getSession();
    if (!currentSession) {
      throw new Error('No active session');
    }

    const updatedSession = { ...currentSession, ...updates };
    
    const token = await new SignJWT({ ...updatedSession })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set(TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_MAX_AGE,
      path: '/'
    });
  }

  static async clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(TOKEN_NAME);
  }
}