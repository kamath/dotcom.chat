import { Tool, tool } from "ai";
import { z } from "zod";
import { serializeParameters, SerializedTool } from "@/utils/tool-serialization";
import { mcpConnectionManager } from "@/lib/mcp-connection-manager";

export interface McpUrl {
  id: string;
  name: string;
  url: string;
}

// Local tools
const localTools: Record<string, Tool> = {
  dummyTool: tool({
    description: "Dummy tool for demo purposes and testing.",
    parameters: z.object({
      location: z
        .string()
        .describe("The city and state, e.g. San Francisco, CA"),
    }),
    execute: async ({ location }) => {
      // Mock weather data
      const conditions = ["Sunny", "Cloudy", "Rainy", "Snowy", "Partly Cloudy"];
      const temperature = Math.floor(Math.random() * 35) + 40; // 40-75°F
      const humidity = Math.floor(Math.random() * 50) + 30; // 30-80%

      return {
        location,
        temperature,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        humidity,
        timestamp: new Date().toISOString(),
      };
    },
  }),
};

export class ToolsService {
  /**
   * Get local tools
   */
  getLocalTools(): Record<string, Tool> {
    return localTools;
  }

  /**
   * Serialize tools for UI display
   */
  serializeTools(tools: Record<string, Tool>): Record<string, SerializedTool> {
    const serializedTools: Record<string, SerializedTool> = {};

    for (const [name, toolInstance] of Object.entries(tools)) {
      try {
        serializedTools[name] = {
          description: toolInstance.description,
          parameters: serializeParameters(toolInstance.parameters),
        };
      } catch (error) {
        console.error(`Error serializing tool ${name}:`, error);
        serializedTools[name] = {
          description: toolInstance.description,
          parameters: {
            error: `Failed to serialize parameters for tool ${name}`,
          },
        };
      }
    }

    return serializedTools;
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
    
    // Include local tools
    const combinedTools = { ...result.tools, ...this.getLocalTools() };
    
    return {
      tools: combinedTools,
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