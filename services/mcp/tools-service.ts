import { Tool } from "ai";
import {
  serializeParameters,
  SerializedTool,
} from "@/utils/tool-serialization";
import type { McpUrl } from "@/types/mcp";

export class ToolsService {
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

  // This layer should only do UI-focused transformations.
  // Orchestration is moved to the client and connection manager.
}

// Export singleton instance
export const toolsService = new ToolsService();
