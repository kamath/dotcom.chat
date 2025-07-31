import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface OAuthSession {
  serverUrl: string;
  sessionId: string;
  authenticated: boolean;
  expiresAt?: number;
  lastUsed: number;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    tokenType?: string;
    expiresIn?: number;
  };
  clientInfo?: {
    clientId: string;
    clientSecret?: string;
  };
  authCode?: string; // Store the auth code temporarily
}

export interface OAuthSessionStore {
  [serverUrl: string]: OAuthSession;
}

// For now, use regular localStorage until we properly implement async storage
// The secure storage requires async operations which don't work well with Jotai's atomWithStorage
export const oauthSessionsAtom = atomWithStorage<OAuthSessionStore>(
  "mcp-oauth-sessions",
  {}
);

// Helper atom to get OAuth session for a specific server
export const getOAuthSessionAtom = atom(
  (get) => (serverUrl: string) => {
    const sessions = get(oauthSessionsAtom);
    return sessions[serverUrl];
  }
);

// Helper atom to update OAuth session
export const updateOAuthSessionAtom = atom(
  null,
  (get, set, { serverUrl, session }: { serverUrl: string; session: Partial<OAuthSession> }) => {
    const sessions = get(oauthSessionsAtom);
    const existingSession = sessions[serverUrl] || {
      serverUrl,
      sessionId: "",
      authenticated: false,
      lastUsed: Date.now(),
    };
    
    const updatedSession: OAuthSession = {
      ...existingSession,
      ...session,
      lastUsed: Date.now(),
    };
    
    set(oauthSessionsAtom, {
      ...sessions,
      [serverUrl]: updatedSession,
    });
  }
);

// Helper atom to remove OAuth session
export const removeOAuthSessionAtom = atom(
  null,
  (get, set, serverUrl: string) => {
    const sessions = get(oauthSessionsAtom);
    const { [serverUrl]: removed, ...rest } = sessions;
    set(oauthSessionsAtom, rest);
  }
);

// Helper atom to clean up expired sessions
export const cleanupOAuthSessionsAtom = atom(
  null,
  (get, set) => {
    const sessions = get(oauthSessionsAtom);
    const now = Date.now();
    const cleaned: OAuthSessionStore = {};
    
    Object.entries(sessions).forEach(([url, session]) => {
      // Keep sessions that are either non-expiring or not expired
      if (!session.expiresAt || session.expiresAt > now) {
        cleaned[url] = session;
      }
    });
    
    set(oauthSessionsAtom, cleaned);
  }
);

// Track pending OAuth flows to prevent infinite loops
export const pendingOAuthFlowsAtom = atom<Set<string>>(new Set());