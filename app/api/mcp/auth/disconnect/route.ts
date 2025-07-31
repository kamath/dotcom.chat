import { NextResponse } from "next/server";
import { SessionManager } from "@/lib/session-manager";
import { SessionCookies } from "@/lib/session-cookies";

export async function POST() {
  try {
    // Get session from cookies
    const session = await SessionCookies.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "No active session found" },
        { status: 401 }
      );
    }

    // Remove the OAuth client
    SessionManager.removeClient(session.sessionId);
    
    // Clear the session cookie
    await SessionCookies.clearSession();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}