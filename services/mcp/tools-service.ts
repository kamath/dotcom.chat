import { mcpConnectionManager } from "@/lib/mcp-connection-manager";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface McpUrl {
  id: string;
  name: string;
  url: string;
}

export class ToolsService {
  /**
   * Serialize tools for UI display
   */
  serializeTools(tools: Record<string, Tool>): Record<string, Tool> {
    return tools;
  }

  /**
   * Load tools from MCP servers
   */
  async loadMcpTools(mcpUrls: McpUrl[]): Promise<{
    tools: Record<string, Tool>;
    breakdown: Record<string, Record<string, Tool>>;
    errors: Record<string, string>;
  }> {
    // Use the connection manager for incremental updates
    const result = await mcpConnectionManager.updateConnections(mcpUrls);
    
    return {
      tools: result.tools,
      breakdown: result.breakdown,
      errors: result.errors,
    };
  }

  /**
   * Get tools with breakdown (not serialized)
   */
  async getToolsWithBreakdown(mcpUrls: McpUrl[] = []): Promise<{
    tools: Record<string, Tool>;
    breakdown: Record<string, Record<string, Tool>>;
    errors: Record<string, string>;
  }> {
    const { tools, breakdown, errors } = await this.loadMcpTools(mcpUrls);

    // Add failed entries to breakdown for UI feedback
    for (const [serverName] of Object.entries(errors)) {
      breakdown[`${serverName} (Failed)`] = {};
    }

    return {
      tools,
      breakdown,
      errors,
    };
  }
}

// Export singleton instance
export const toolsService = new ToolsService();