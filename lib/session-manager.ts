import { MCPOAuthClient } from './oauth-client';
import { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

interface ClientData {
  client: MCPOAuthClient;
  serverUrl: string;
  callbackUrl: string;
  tokens?: OAuthTokens;
  clientInfo?: OAuthClientInformationFull;
}

interface ClientStore {
  [sessionId: string]: {
    [serverUrl: string]: ClientData;
  };
}

// Use global to persist across hot reloads and serverless invocations
// In production, consider using Redis or another session store
declare global {
  // eslint-disable-next-line no-var
  var mcpClientStore: ClientStore | undefined;
}

// Initialize the store
if (!global.mcpClientStore) {
  global.mcpClientStore = {};
}

const clientStore = global.mcpClientStore;

/**
 * Client-side session management for OAuth clients
 * This manages the in-memory storage of OAuth clients
 */
export class SessionManager {
  static setClient(sessionId: string, client: MCPOAuthClient, serverUrl: string, callbackUrl: string): void {
    if (!clientStore[sessionId]) {
      clientStore[sessionId] = {};
    }
    // Get tokens and client info from the client
    const tokens = client.getTokens();
    const clientInfo = client.getClientInfo() as OAuthClientInformationFull | undefined;
    
    clientStore[sessionId][serverUrl] = { client, serverUrl, callbackUrl, tokens, clientInfo };
    console.log('SessionManager: Stored OAuth client for', { sessionId, serverUrl, hasTokens: !!tokens });
  }

  static getClient(sessionId: string): MCPOAuthClient | null {
    const sessionClients = clientStore[sessionId];
    if (!sessionClients) return null;
    
    // Return the first client found (for backward compatibility)
    const firstClient = Object.values(sessionClients)[0];
    return firstClient?.client || null;
  }

  static getClientForServer(sessionId: string, serverUrl: string): MCPOAuthClient | null {
    console.log('SessionManager: Looking for OAuth client', { sessionId, serverUrl });
    console.log('SessionManager: Current clientStore:', JSON.stringify(Object.keys(clientStore)));
    const client = clientStore[sessionId]?.[serverUrl]?.client || null;
    console.log('SessionManager: Found client:', !!client);
    return client;
  }

  static removeClient(sessionId: string): void {
    const sessionClients = clientStore[sessionId];
    if (sessionClients) {
      // Disconnect all clients for this session
      Object.values(sessionClients).forEach(({ client }) => {
        client.disconnect();
      });
      delete clientStore[sessionId];
    }
  }

  static removeClientForServer(sessionId: string, serverUrl: string): void {
    const client = clientStore[sessionId]?.[serverUrl];
    if (client) {
      client.client.disconnect();
      delete clientStore[sessionId][serverUrl];
      
      // If no more clients for this session, remove the session entry
      if (Object.keys(clientStore[sessionId]).length === 0) {
        delete clientStore[sessionId];
      }
    }
  }

  static clearClient(sessionId: string): void {
    delete clientStore[sessionId];
  }

  static getStoredCredentials(sessionId: string, serverUrl: string): { tokens?: OAuthTokens; clientInfo?: OAuthClientInformationFull } | null {
    const clientData = clientStore[sessionId]?.[serverUrl];
    if (!clientData) return null;
    
    return {
      tokens: clientData.tokens,
      clientInfo: clientData.clientInfo
    };
  }

  static generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}