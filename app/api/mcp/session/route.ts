import { NextResponse } from "next/server";
import { SessionCookies } from "@/lib/session-cookies";

export async function GET() {
  try {
    // Get session from cookies or create a new one
    const session = await SessionCookies.getSession();
    let sessionId: string;
    
    if (!session) {
      // Create a new session if none exists
      sessionId = await SessionCookies.createSession({});
    } else {
      sessionId = session.sessionId;
    }
    
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error('Session route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get session' },
      { status: 500 }
    );
  }
}