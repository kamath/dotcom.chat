import { Tool } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpUrl } from "@/types/mcp";

interface ManagedConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any; // The MCPClient type is not exported from 'ai' package
  tools: Record<string, Tool>;
  url: McpUrl;
}

export class McpConnectionManager {
  private connections: Map<string, ManagedConnection> = new Map();
  private connectionPromises: Map<string, Promise<ManagedConnection | null>> =
    new Map();

  getAllTools(): Record<string, Tool> {
    const allTools: Record<string, Tool> = {};
    for (const connection of this.connections.values()) {
      Object.assign(allTools, connection.tools);
    }
    return allTools;
  }

  getBreakdown(): Record<string, Record<string, Tool>> {
    const breakdown: Record<string, Record<string, Tool>> = {};
    for (const [serverName, connection] of this.connections.entries()) {
      breakdown[serverName] = connection.tools;
    }
    return breakdown;
  }

  async connectServer(
    urlConfig: McpUrl
  ): Promise<{ tools: Record<string, Tool>; error?: string }> {
    const existingPromise = this.connectionPromises.get(urlConfig.name);
    if (existingPromise) {
      const result = await existingPromise;
      if (result) {
        return { tools: result.tools };
      } else {
        return { tools: {}, error: "Failed to connect" };
      }
    }

    const existingConnection = this.connections.get(urlConfig.name);
    if (existingConnection) {
      return { tools: existingConnection.tools };
    }

    const connectionPromise = this.createConnection(urlConfig);
    this.connectionPromises.set(urlConfig.name, connectionPromise);

    try {
      const connection = await connectionPromise;
      if (connection) {
        this.connections.set(urlConfig.name, connection);
        return { tools: connection.tools };
      } else {
        return { tools: {}, error: "Failed to connect" };
      }
    } finally {
      this.connectionPromises.delete(urlConfig.name);
    }
  }

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

  async updateConnections(newUrls: McpUrl[]): Promise<{
    tools: Record<string, Tool>;
    breakdown: Record<string, Record<string, Tool>>;
    errors: Record<string, string>;
  }> {
    const errors: Record<string, string> = {};

    const newServerNames = new Set(newUrls.map((url) => url.name));
    const currentServerNames = new Set(this.connections.keys());

    const serversToAdd = newUrls.filter(
      (url) => !currentServerNames.has(url.name)
    );
    const serversToRemove = Array.from(currentServerNames).filter(
      (name) => !newServerNames.has(name)
    );

    await Promise.all(
      serversToRemove.map((name) => this.disconnectServer(name))
    );

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

  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.keys()).map((name) =>
        this.disconnectServer(name)
      )
    );
  }

  private async createConnection(
    urlConfig: McpUrl
  ): Promise<ManagedConnection | null> {
    try {
      console.log("Connecting to MCP server:", urlConfig.name, urlConfig.url);

      const client = await createMCPClient({
        transport: new StreamableHTTPClientTransport(new URL(urlConfig.url)),
      });

      const tools = await client.tools();
      console.log(
        `Successfully connected to ${urlConfig.name}, got ${
          Object.keys(tools).length
        } tools`
      );

      return {
        client,
        tools,
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

export async function getToolsForUrls(
  urls: McpUrl[]
): Promise<Record<string, Tool>> {
  const manager = new McpConnectionManager();
  const { tools } = await manager.updateConnections(urls);
  // Clean up the ephemeral manager's connections after use
  await manager.closeAll();
  return tools;
}
