import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolRequest,
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface McpUrl {
  id: string;
  name: string;
  url: string;
}

interface ManagedConnection {
  client: Client;
  sessionId: string;
  url: McpUrl;
}

/**
 * Server-side MCP connection manager for API routes
 * Creates temporary connections for tool execution
 */
export class ServerMcpManager {
  private connections: Map<string, ManagedConnection> = new Map();

  /**
   * Initialize connections to MCP servers
   */
  async initialize(mcpUrls: McpUrl[]): Promise<void> {
    const connectionPromises = mcpUrls.map(async (urlConfig) => {
      try {
        const client = new Client({
          name: "dotcom.chat-api",
          version: "1.0.0",
          title: "dotcom.chat API",
        });

        const transport = new StreamableHTTPClientTransport(
          new URL(urlConfig.url)
        );
        
        await client.connect(transport);
        
        this.connections.set(urlConfig.name, {
          client,
          sessionId: transport.sessionId || crypto.randomUUID(),
          url: urlConfig,
        });
        
        console.log(`API: Connected to MCP server ${urlConfig.name}`);
      } catch (error) {
        console.error(`API: Failed to connect to ${urlConfig.name}:`, error);
      }
    });

    await Promise.all(connectionPromises);
  }

  /**
   * Execute a tool call on the appropriate MCP server
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<any> {
    // Find which server has this tool
    let targetConnection: ManagedConnection | undefined;
    
    // For now, we'll try all connections until we find one that works
    // In production, you'd want to maintain a tool->server mapping
    for (const connection of this.connections.values()) {
      // You could check if this server has the tool first
      targetConnection = connection;
      break; // Use first available connection for now
    }

    if (!targetConnection) {
      throw new Error(`No MCP server available for tool ${toolName}`);
    }

    try {
      const request: CallToolRequest = {
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      const result = await targetConnection.client.request(
        request,
        CallToolResultSchema
      );

      return result.result;
    } catch (error) {
      console.error(`Failed to execute tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Find which server provides a specific tool
   */
  async findServerForTool(toolName: string): Promise<string | null> {
    for (const [serverName, connection] of this.connections.entries()) {
      try {
        const tools = await connection.client.listTools();
        if (tools.tools?.some(tool => tool.name === toolName)) {
          return serverName;
        }
      } catch (error) {
        console.error(`Error listing tools for ${serverName}:`, error);
      }
    }
    return null;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(
      async (connection) => {
        try {
          await connection.client.close();
        } catch (error) {
          console.error("Error closing connection:", error);
        }
      }
    );

    await Promise.all(closePromises);
    this.connections.clear();
  }
}

// Cache managers by request to reuse connections during streaming
const managerCache = new Map<string, ServerMcpManager>();

export async function getServerMcpManager(
  requestId: string,
  mcpUrls: McpUrl[]
): Promise<ServerMcpManager> {
  let manager = managerCache.get(requestId);
  
  if (!manager) {
    manager = new ServerMcpManager();
    await manager.initialize(mcpUrls);
    managerCache.set(requestId, manager);
    
    // Clean up after 5 minutes
    setTimeout(async () => {
      const cached = managerCache.get(requestId);
      if (cached) {
        await cached.close();
        managerCache.delete(requestId);
      }
    }, 5 * 60 * 1000);
  }
  
  return manager;
}