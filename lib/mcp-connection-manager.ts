import { Tool } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface McpUrl {
  id: string;
  name: string;
  url: string;
}

interface ManagedConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any; // The MCPClient type is not exported from 'ai' package
  tools: Record<string, Tool>;
  url: McpUrl;
}

class MCPConnectionManager {
  private sessionConnections: Map<string, Map<string, ManagedConnection>> = new Map();
  private connectionPromises: Map<string, Promise<ManagedConnection | null | { requiresAuth: boolean; url: McpUrl; error?: string }>> =
    new Map();

  /**
   * Get all currently active tools from all connections for a session
   */
  getAllTools(sessionId: string): Record<string, Tool> {
    const allTools: Record<string, Tool> = {};
    const sessionConns = this.sessionConnections.get(sessionId);
    if (sessionConns) {
      for (const connection of sessionConns.values()) {
        Object.assign(allTools, connection.tools);
      }
    }
    return allTools;
  }

  /**
   * Get breakdown of tools by server for a session
   */
  getBreakdown(sessionId: string): Record<string, Record<string, Tool>> {
    const breakdown: Record<string, Record<string, Tool>> = {};
    const sessionConns = this.sessionConnections.get(sessionId);
    if (sessionConns) {
      for (const [serverName, connection] of sessionConns.entries()) {
        breakdown[serverName] = connection.tools;
      }
    }
    return breakdown;
  }

  /**
   * Connect to a specific server for a session
   */
  async connectServer(
    sessionId: string,
    urlConfig: McpUrl
  ): Promise<{ tools: Record<string, Tool>; error?: string; requiresAuth?: boolean }> {
    // Check if already connecting
    const existingPromise = this.connectionPromises.get(urlConfig.name);
    if (existingPromise) {
      const result = await existingPromise;
      if (result) {
        if ('requiresAuth' in result) {
          const errorMessage = result.error || "Authentication required";
          return { tools: {}, error: errorMessage, requiresAuth: true };
        }
        return { tools: result.tools };
      } else {
        return { tools: {}, error: "Failed to connect" };
      }
    }

    // Get or create session connections map
    let sessionConns = this.sessionConnections.get(sessionId);
    if (!sessionConns) {
      sessionConns = new Map();
      this.sessionConnections.set(sessionId, sessionConns);
    }

    // Check if already connected
    const existingConnection = sessionConns.get(urlConfig.name);
    if (existingConnection) {
      return { tools: existingConnection.tools };
    }

    // Create connection promise
    const connectionKey = `${sessionId}:${urlConfig.name}`;
    const connectionPromise = this.createConnection(sessionId, urlConfig);
    this.connectionPromises.set(connectionKey, connectionPromise);

    try {
      const connection = await connectionPromise;
      if (connection) {
        if ('requiresAuth' in connection) {
          // Server requires authentication
          const errorMessage = connection.error || "Authentication required";
          return { tools: {}, error: errorMessage, requiresAuth: true };
        }
        sessionConns.set(urlConfig.name, connection);
        return { tools: connection.tools };
      } else {
        return { tools: {}, error: "Failed to connect" };
      }
    } finally {
      this.connectionPromises.delete(connectionKey);
    }
  }

  /**
   * Disconnect from a specific server for a session
   */
  async disconnectServer(sessionId: string, serverName: string): Promise<void> {
    const sessionConns = this.sessionConnections.get(sessionId);
    if (sessionConns) {
      const connection = sessionConns.get(serverName);
      if (connection) {
        try {
          await connection.client.close();
        } catch (error) {
          console.error(`Error closing connection to ${serverName}:`, error);
        }
        sessionConns.delete(serverName);
        
        // Clean up empty session map
        if (sessionConns.size === 0) {
          this.sessionConnections.delete(sessionId);
        }
      }
    }
  }

  /**
   * Update connections based on new URL list for a session
   * Only connects to new servers and disconnects removed ones
   */
  async updateConnections(sessionId: string, newUrls: McpUrl[]): Promise<{
    tools: Record<string, Tool>;
    breakdown: Record<string, Record<string, Tool>>;
    errors: Record<string, string>;
    authRequired?: McpUrl[];
  }> {
    console.log('[MCPConnectionManager] updateConnections called', { sessionId, urlCount: newUrls.length });
    const errors: Record<string, string> = {};
    const authRequired: McpUrl[] = [];

    // Create sets for efficient lookups
    const newServerNames = new Set(newUrls.map((url) => url.name));
    const sessionConns = this.sessionConnections.get(sessionId) || new Map();
    const currentServerNames = new Set(sessionConns.keys());

    // Find servers to add and remove
    const serversToAdd = newUrls.filter(
      (url) => !currentServerNames.has(url.name)
    );
    const serversToRemove = Array.from(currentServerNames).filter(
      (name) => !newServerNames.has(name)
    );
    
    console.log('[MCPConnectionManager] Server status:', {
      currentServers: Array.from(currentServerNames),
      newServers: Array.from(newServerNames),
      serversToAdd: serversToAdd.map(s => s.name),
      serversToRemove
    });

    // Remove servers that are no longer in the list
    await Promise.all(
      serversToRemove.map((name) => this.disconnectServer(sessionId, name))
    );

    // Add new servers
    await Promise.all(
      serversToAdd.map(async (url) => {
        try {
          const result = await this.connectServer(sessionId, url);
          if (result.error) {
            errors[url.name] = result.error;
            if (result.requiresAuth) {
              authRequired.push(url);
            }
          }
        } catch (error) {
          console.error(`Failed to connect to ${url.name}:`, error);
          errors[url.name] =
            error instanceof Error ? error.message : "Connection failed";
        }
      })
    );

    const response: {
      tools: Record<string, Tool>;
      breakdown: Record<string, Record<string, Tool>>;
      errors: Record<string, string>;
      authRequired?: McpUrl[];
    } = {
      tools: this.getAllTools(sessionId),
      breakdown: this.getBreakdown(sessionId),
      errors,
    };
    
    console.log('[MCPConnectionManager] Response breakdown:', Object.keys(response.breakdown));
    console.log('[MCPConnectionManager] Response errors:', response.errors);

    if (authRequired.length > 0) {
      response.authRequired = authRequired;
    }

    return response;
  }

  /**
   * Close all connections for a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const sessionConns = this.sessionConnections.get(sessionId);
    if (sessionConns) {
      await Promise.all(
        Array.from(sessionConns.keys()).map((name) =>
          this.disconnectServer(sessionId, name)
        )
      );
    }
  }
  
  /**
   * Close all connections across all sessions
   */
  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.sessionConnections.keys()).map((sessionId) =>
        this.closeSession(sessionId)
      )
    );
  }

  /**
   * Create a connection to an MCP server for a session
   */
  private async createConnection(
    sessionId: string,
    urlConfig: McpUrl
  ): Promise<ManagedConnection | null | { requiresAuth: boolean; url: McpUrl; error?: string }> {
    try {
      console.log("Connecting to MCP server:", urlConfig.name, urlConfig.url, "for session:", sessionId);
      
      // Check if we have an OAuth client in session
      const { SessionManager } = await import("@/lib/session-manager");
      console.log(`[Connection Manager] Looking for OAuth client with sessionId: ${sessionId}, serverUrl: ${urlConfig.url}`);
      const oauthClient = SessionManager.getClientForServer(sessionId, urlConfig.url);
      
      if (oauthClient) {
        // Use the existing OAuth client
        console.log(`Using existing OAuth client for ${urlConfig.name}`);
        console.log(`OAuth client tokens:`, !!oauthClient.getTokens());
        console.log(`OAuth client instance:`, oauthClient.constructor.name);
        try {
          const tools = await oauthClient.listTools();
          console.log(
            `Successfully connected to ${urlConfig.name} with OAuth, got ${
              Object.keys(tools).length
            } tools`
          );

          return {
            client: oauthClient,
            tools: tools as Record<string, Tool>,
            url: urlConfig,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to list tools with OAuth client for ${urlConfig.name}:`, errorMessage);
          
          // If it's an auth error, return it
          if (error instanceof Error && 
              (error.message.includes('401') || 
               error.message.includes('Unauthorized') ||
               error.name === 'UnauthorizedError')) {
            return { requiresAuth: true, url: urlConfig, error: errorMessage };
          }
          // Fall through to try without OAuth for other errors
        }
      }
      
      // Try connecting without OAuth
      const client = new Client(
        {
          name: "dotcom.chat",
          version: "1.0.0"
        }
      );
      
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(urlConfig.url)));
      } catch (error) {
        // If we get a 401/UnauthorizedError, then we need OAuth
        if (error instanceof Error && 
            (error.message.includes('401') || 
             error.message.includes('Unauthorized') ||
             error.name === 'UnauthorizedError')) {
          console.log(`Server ${urlConfig.name} requires OAuth authentication`);
          
          // OAuth authentication is required but needs to be initiated through the connect route
          console.warn(`Server ${urlConfig.name} requires OAuth authentication.`);
          // Return auth required to trigger OAuth flow
          const errorMessage = error instanceof Error ? error.message : 'Authentication required';
          return { requiresAuth: true, url: urlConfig, error: errorMessage };
        } else {
          // Re-throw non-auth errors
          throw error;
        }
      }

      const tools = await client.listTools();
      console.log(
        `Successfully connected to ${urlConfig.name}, got ${
          Object.keys(tools).length
        } tools`
      );

      return {
        client,
        tools: tools as Record<string, Tool>,
        url: urlConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `Failed to connect to MCP server ${urlConfig.name}:`,
        errorMessage
      );
      // Return error details instead of just null
      return { requiresAuth: false, url: urlConfig, error: errorMessage };
    }
  }
}

// Global singleton instance
export const mcpConnectionManager = new MCPConnectionManager();
