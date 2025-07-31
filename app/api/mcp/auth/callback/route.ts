import { NextRequest, NextResponse } from "next/server";
import { SessionCookies } from "@/lib/session-cookies";
import { SessionManager } from "@/lib/session-manager";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      // Redirect to callback page with error
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", error);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state) {
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", "Missing code or state");
      return NextResponse.redirect(redirectUrl);
    }

    // Parse state parameter
    let stateData: { sessionId?: string; serverUrl?: string } = {};
    try {
      stateData = JSON.parse(state);
    } catch {
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", "Invalid state parameter");
      return NextResponse.redirect(redirectUrl);
    }

    if (!stateData.sessionId || !stateData.serverUrl) {
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", "Invalid OAuth state");
      return NextResponse.redirect(redirectUrl);
    }

    // Verify the session exists and matches
    const session = await SessionCookies.getSession();
    if (!session || session.sessionId !== stateData.sessionId) {
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", "Session mismatch");
      return NextResponse.redirect(redirectUrl);
    }

    // Get the OAuth client from session
    const oauthClient = SessionManager.getClientForServer(stateData.sessionId, stateData.serverUrl);
    if (!oauthClient) {
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", "OAuth client not found in session");
      return NextResponse.redirect(redirectUrl);
    }

    try {
      // Exchange the authorization code for tokens
      await oauthClient.exchangeCodeForTokens(code);
      
      // Update SessionManager with the new tokens
      SessionManager.setClient(stateData.sessionId, oauthClient, stateData.serverUrl, '');
      
      // Update session to mark as authorized
      await SessionCookies.updateSession({ 
        authState: 'authorized',
        serverUrl: stateData.serverUrl 
      });

      // Redirect to callback page with success
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("success", "true");
      redirectUrl.searchParams.set("serverUrl", stateData.serverUrl);
      redirectUrl.searchParams.set("sessionId", stateData.sessionId);
      return NextResponse.redirect(redirectUrl);
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      const redirectUrl = new URL("/auth/callback", request.url);
      redirectUrl.searchParams.set("error", error instanceof Error ? error.message : "Token exchange failed");
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = new URL("/auth/callback", request.url);
    redirectUrl.searchParams.set("error", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.redirect(redirectUrl);
  }
}