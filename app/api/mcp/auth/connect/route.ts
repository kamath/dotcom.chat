import { NextRequest, NextResponse } from "next/server";
import { SessionCookies } from "@/lib/session-cookies";
import { SessionManager } from "@/lib/session-manager";
import { MCPOAuthClient } from "@/lib/oauth-client";

interface ConnectRequestBody {
  serverUrl: string;
  callbackUrl: string;
}


export async function POST(request: NextRequest) {
  try {
    const body: ConnectRequestBody = await request.json();
    const { serverUrl, callbackUrl } = body;

    if (!serverUrl || !callbackUrl) {
      return NextResponse.json(
        { error: "Server URL and callback URL are required" },
        { status: 400 }
      );
    }

    // Get or create server-side session
    const session = await SessionCookies.getSession();
    let sessionId: string;
    
    if (!session) {
      sessionId = await SessionCookies.createSession({ serverUrl, callbackUrl });
    } else {
      sessionId = session.sessionId;
      // Update session with current server info
      await SessionCookies.updateSession({ serverUrl, callbackUrl });
    }

    // Check if we already have an OAuth client for this server
    console.log(`[Connect API] Looking for OAuth client with sessionId: ${sessionId}, serverUrl: ${serverUrl}`);
    let oauthClient = SessionManager.getClientForServer(sessionId, serverUrl);
    
    if (!oauthClient) {
      // Create new OAuth client
      let authUrl: string | null = null;
      oauthClient = new MCPOAuthClient(
        serverUrl,
        callbackUrl,
        (url: string) => {
          authUrl = url;
        },
        undefined,
        undefined
      );
      
      try {
        console.log('[Connect API] Attempting to connect to', serverUrl);
        await oauthClient.connect();
        
        // If we get here, connection succeeded without OAuth
        console.log('[Connect API] Connection succeeded without OAuth');
        
        // Store the OAuth client in session
        SessionManager.setClient(sessionId, oauthClient, serverUrl, callbackUrl);
        
        // Return session ID only - no sensitive data
        return NextResponse.json({ 
          success: true, 
          sessionId
        });
      } catch (error: unknown) {
        console.log('[Connect API] Connection failed:', error);
        
        if (error instanceof Error && error.message === "OAuth authorization required") {
          console.log('[Connect API] OAuth required, authUrl:', authUrl);
          
          if (authUrl) {
            // Store the OAuth client in session before redirecting
            SessionManager.setClient(sessionId, oauthClient, serverUrl, callbackUrl);
            
            // Add state parameter to OAuth URL to track session
            const authUrlWithState = new URL(authUrl);
            authUrlWithState.searchParams.set('state', JSON.stringify({ sessionId, serverUrl }));
            
            return NextResponse.json(
              { requiresAuth: true, authUrl: authUrlWithState.toString(), sessionId },
              { status: 401 }
            );
          }
        }
        
        if (error instanceof Error) {
          return NextResponse.json(
            { error: error.message || "Unknown error" },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ error: "Unknown error occurred" }, { status: 500 });
      }
    } else {
      // We already have a client, check if it has valid tokens
      console.log('[Connect API] Found existing OAuth client for', serverUrl);
      
      const tokens = oauthClient.getTokens();
      if (!tokens) {
        // No tokens, need to re-authenticate
        console.log('[Connect API] Existing client has no tokens, need to re-authenticate');
        
        // Attempt to connect again
        let authUrl: string | null = null;
        const newClient = new MCPOAuthClient(
          serverUrl,
          callbackUrl,
          (url: string) => {
            authUrl = url;
          },
          undefined,
          undefined
        );
        
        try {
          await newClient.connect();
          
          // Replace the old client
          SessionManager.setClient(sessionId, newClient, serverUrl, callbackUrl);
          
          return NextResponse.json({ 
            success: true, 
            sessionId
          });
        } catch (error: unknown) {
          if (error instanceof Error && error.message === "OAuth authorization required") {
            console.log('[Connect API] Re-authentication required, authUrl:', authUrl);
            
            if (authUrl) {
              // Replace the old client
              SessionManager.setClient(sessionId, newClient, serverUrl, callbackUrl);
              
              // Add state parameter to OAuth URL to track session
              const authUrlWithState = new URL(authUrl);
              authUrlWithState.searchParams.set('state', JSON.stringify({ sessionId, serverUrl }));
              
              return NextResponse.json(
                { requiresAuth: true, authUrl: authUrlWithState.toString(), sessionId },
                { status: 401 }
              );
            }
          }
          
          throw error;
        }
      }
      
      // Has tokens, but verify they're still valid by attempting to list tools
      console.log('[Connect API] Testing existing OAuth client tokens for', serverUrl);
      console.log('[Connect API] OAuth client tokens:', !!tokens);
      console.log('[Connect API] OAuth client instance:', oauthClient.constructor.name);
      try {
        await oauthClient.listTools();
        console.log('[Connect API] Existing tokens are valid for', serverUrl);
        return NextResponse.json({ 
          success: true, 
          sessionId
        });
      } catch (error: unknown) {
        console.log('[Connect API] Existing tokens are invalid, need to re-authenticate for', serverUrl);
        
        // Tokens are invalid, need to re-authenticate
        let authUrl: string | null = null;
        const newClient = new MCPOAuthClient(
          serverUrl,
          callbackUrl,
          (url: string) => {
            authUrl = url;
          },
          undefined,
          undefined
        );
        
        try {
          await newClient.connect();
          
          // Replace the old client
          SessionManager.setClient(sessionId, newClient, serverUrl, callbackUrl);
          
          return NextResponse.json({ 
            success: true, 
            sessionId
          });
        } catch (error: unknown) {
          if (error instanceof Error && error.message === "OAuth authorization required") {
            console.log('[Connect API] Re-authentication required, authUrl:', authUrl);
            
            if (authUrl) {
              // Replace the old client
              SessionManager.setClient(sessionId, newClient, serverUrl, callbackUrl);
              
              // Add state parameter to OAuth URL to track session
              const authUrlWithState = new URL(authUrl);
              authUrlWithState.searchParams.set('state', JSON.stringify({ sessionId, serverUrl }));
              
              return NextResponse.json(
                { requiresAuth: true, authUrl: authUrlWithState.toString(), sessionId },
                { status: 401 }
              );
            }
          }
          
          throw error;
        }
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}