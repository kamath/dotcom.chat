import { tool } from "ai";
import { z } from "zod";
import { ServerMcpManager } from "@/lib/server-mcp-manager";

/**
 * Create AI SDK tools from MCP tool descriptions
 * These tools will execute via MCP when called
 */
export function createMcpTools(
  toolDescriptions: any,
  mcpManager: ServerMcpManager
) {
  if (!toolDescriptions || typeof toolDescriptions !== 'object') {
    return {};
  }

  const aiTools: Record<string, any> = {};

  for (const [toolName, toolDesc] of Object.entries(toolDescriptions)) {
    if (!toolDesc || typeof toolDesc !== 'object') continue;
    
    const mcpTool = toolDesc as any;
    
    try {
      // Create a Zod schema from the tool's parameters
      const schema = createZodSchema(mcpTool.parameters || mcpTool.inputSchema || {});
      
      aiTools[toolName] = tool({
        description: mcpTool.description || toolName,
        parameters: schema,
        execute: async (args) => {
          // Execute the tool via MCP
          try {
            console.log(`Executing MCP tool ${toolName} with args:`, args);
            const result = await mcpManager.executeTool(toolName, args);
            return result;
          } catch (error) {
            console.error(`Error executing MCP tool ${toolName}:`, error);
            throw error;
          }
        },
      });
    } catch (error) {
      console.error(`Failed to create AI tool for ${toolName}:`, error);
    }
  }

  return aiTools;
}

/**
 * Create a Zod schema from a simplified schema description
 */
function createZodSchema(schemaDesc: any): z.ZodTypeAny {
  // If it's already a Zod schema, return it
  if (schemaDesc._def) {
    return schemaDesc;
  }

  // Handle JSON Schema format
  if (schemaDesc.type === 'object' && schemaDesc.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    const required = schemaDesc.required || [];

    for (const [key, prop] of Object.entries(schemaDesc.properties as any)) {
      let fieldSchema = createZodSchema(prop);
      
      // Make optional if not in required array
      if (!required.includes(key)) {
        fieldSchema = fieldSchema.optional();
      }
      
      shape[key] = fieldSchema;
    }

    return z.object(shape);
  }

  // Handle primitive types
  switch (schemaDesc.type) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(schemaDesc.items ? createZodSchema(schemaDesc.items) : z.any());
    default:
      return z.any();
  }
}