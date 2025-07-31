import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
	ListToolsRequest,
	ListToolsResultSchema,
	Tool,
  } from "@modelcontextprotocol/sdk/types.js";

export interface McpUrl {
  id: string;
  name: string;
  url: string;
}

interface ManagedConnection {
  client: Client;
  sessionId: string;
  tools: Awaited<ReturnType<Client['listTools']>>;
  url: McpUrl;
}

class MCPConnectionManager {
  private connections: Map<string, ManagedConnection> = new Map();
  private connectionPromises: Map<string, Promise<ManagedConnection | null>> =
    new Map();

  /**
   * Get all currently active tools from all connections
   */
  getAllTools(): Record<string, Tool> {
    const allTools: Record<string, Tool> = {};
    for (const connection of this.connections.values()) {
      // Convert the tools array to a Record keyed by tool name
      if (connection.tools.tools) {
        for (const tool of connection.tools.tools) {
          allTools[tool.name] = tool;
        }
      }
    }
    return allTools;
  }

  /**
   * Get breakdown of tools by server
   */
  getBreakdown(): Record<string, Record<string, Tool>> {
    const breakdown: Record<string, Record<string, Tool>> = {};
    for (const [serverName, connection] of this.connections.entries()) {
      const serverTools: Record<string, Tool> = {};
      if (connection.tools.tools) {
        for (const tool of connection.tools.tools) {
          serverTools[tool.name] = tool;
        }
      }
      breakdown[serverName] = serverTools;
    }
    return breakdown;
  }

  /**
   * Connect to a specific server
   */
  async connectServer(
    urlConfig: McpUrl
  ): Promise<{ tools: Record<string, Tool>; error?: string }> {
    // Check if already connecting
    const existingPromise = this.connectionPromises.get(urlConfig.name);
    if (existingPromise) {
      const result = await existingPromise;
      if (result) {
        const toolsRecord: Record<string, Tool> = {};
        if (result.tools.tools) {
          for (const tool of result.tools.tools) {
            toolsRecord[tool.name] = tool;
          }
        }
        return { tools: toolsRecord };
      } else {
        return { tools: {}, error: "Failed to connect" };
      }
    }

    // Check if already connected
    const existingConnection = this.connections.get(urlConfig.name);
    if (existingConnection) {
      const toolsRecord: Record<string, Tool> = {};
      if (existingConnection.tools.tools) {
        for (const tool of existingConnection.tools.tools) {
          toolsRecord[tool.name] = tool;
        }
      }
      return { tools: toolsRecord };
    }

    // Create connection promise
    const connectionPromise = this.createConnection(urlConfig);
    this.connectionPromises.set(urlConfig.name, connectionPromise);

    try {
      const connection = await connectionPromise;
      if (connection) {
        this.connections.set(urlConfig.name, connection);
        const toolsRecord: Record<string, Tool> = {};
        if (connection.tools.tools) {
          for (const tool of connection.tools.tools) {
            toolsRecord[tool.name] = tool;
          }
        }
        return { tools: toolsRecord };
      } else {
        return { tools: {}, error: "Failed to connect" };
      }
    } finally {
      this.connectionPromises.delete(urlConfig.name);
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (connection) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error(`Error closing connection to ${serverName}:`, error);
      }
      this.connections.delete(serverName);
    }
  }

  /**
   * Update connections based on new URL list
   * Only connects to new servers and disconnects removed ones
   */
  async updateConnections(newUrls: McpUrl[]): Promise<{
    tools: Record<string, Tool>;
    breakdown: Record<string, Record<string, Tool>>;
    errors: Record<string, string>;
  }> {
    const errors: Record<string, string> = {};

    // Create sets for efficient lookups
    const newServerNames = new Set(newUrls.map((url) => url.name));
    const currentServerNames = new Set(this.connections.keys());

    // Find servers to add and remove
    const serversToAdd = newUrls.filter(
      (url) => !currentServerNames.has(url.name)
    );
    const serversToRemove = Array.from(currentServerNames).filter(
      (name) => !newServerNames.has(name)
    );

    // Remove servers that are no longer in the list
    await Promise.all(
      serversToRemove.map((name) => this.disconnectServer(name))
    );

    // Add new servers
    await Promise.all(
      serversToAdd.map(async (url) => {
        try {
          const result = await this.connectServer(url);
          if (result.error) {
            errors[url.name] = result.error;
          }
        } catch (error) {
          console.error(`Failed to connect to ${url.name}:`, error);
          errors[url.name] =
            error instanceof Error ? error.message : "Connection failed";
        }
      })
    );

    return {
      tools: this.getAllTools(),
      breakdown: this.getBreakdown(),
      errors,
    };
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.keys()).map((name) =>
        this.disconnectServer(name)
      )
    );
  }

  /**
   * Create a connection to an MCP server
   */
  private async createConnection(
    urlConfig: McpUrl
  ): Promise<ManagedConnection | null> {
    try {
      console.log("Connecting to MCP server:", urlConfig.name, urlConfig.url);
	  const client = new Client({
		name: "dotcom.chat",
		version: "1.0.0",
		title: "dotcom.chat",
	  })
	  
	  // Try without providing a sessionId - let the server generate one
	  const transport = new StreamableHTTPClientTransport(new URL(urlConfig.url));
	  console.log("Created transport with URL:", urlConfig.url);
	  
	  // Connect the client before making any requests
	  console.log("Attempting to connect client...");
	  await client.connect(transport);
	  console.log("Client connected successfully");
	  console.log("Transport session ID after connect:", transport.sessionId);

      const toolsRequest: ListToolsRequest = {
		method: 'tools/list',
		params: {}
	  }
	  
	  let tools;
	  try {
	    tools = await client.request(toolsRequest, ListToolsResultSchema);
	  } catch (error) {
	    console.error("Error requesting tools list:", error);
	    console.error("Transport session ID:", transport.sessionId);
	    throw error;
	  }
      console.log(
        `Successfully connected to ${urlConfig.name}, got ${
          Object.keys(tools).length
        } tools`
      );

      return {
        client,
		sessionId: transport.sessionId || crypto.randomUUID(),
        tools: tools,
        url: urlConfig,
      };
    } catch (error) {
      console.error(
        `Failed to connect to MCP server ${urlConfig.name}:`,
        error
      );
      return null;
    }
  }
}

// Global singleton instance
export const mcpConnectionManager = new MCPConnectionManager();
