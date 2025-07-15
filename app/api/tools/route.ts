// TODO: Review this, was vibe-coded but works well enough.
// I think it's not working properly with nested fields,
// i.e. z.number().describe("A number").optional() return description
// but z.number().optional().describe("A number") does not.

import { NextResponse } from "next/server";
import { getTools } from "@/lib/tools";
import {
  ZodTypeAny,
  ZodObject,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodOptional,
  ZodDefault,
  ZodSchema,
} from "zod";

interface SerializedParameter {
  type: string;
  description?: string;
  optional?: boolean;
}

interface SerializedParameters {
  [key: string]: SerializedParameter;
}

interface SerializedTool {
  description?: string;
  parameters: SerializedParameters | { error: string; typeReceived?: string };
}

/**
 * Determines the basic type of a Zod schema node.
 * @param schema The Zod schema node.
 * @returns A string representing the type (e.g., 'string', 'number').
 */
function getParameterType(schema: ZodTypeAny): string {
  if (schema instanceof ZodString) return "string";
  if (schema instanceof ZodNumber) return "number";
  if (schema instanceof ZodBoolean) return "boolean";
  // Extend this function if other Zod types (e.g., ZodEnum, ZodArray) are used in tool parameters
  return "unknown"; // Fallback for unhandled Zod types
}

/**
 * Serializes the parameters of a tool, expecting a ZodObject schema.
 * @param zodSchema The ZodObject schema for the tool's parameters.
 * @returns A serialized representation of the parameters.
 */
function serializeParameters(
  zodSchema: ZodTypeAny
): SerializedParameters | { error: string; typeReceived?: string } {
  // Handle undefined or null schema
  if (!zodSchema) {
    return {
      error: "Parameters schema is undefined or null",
    };
  }

  // Handle non-ZodObject schemas
  if (!(zodSchema instanceof ZodObject)) {
    // If it's a primitive type, wrap it in an object
    if (
      zodSchema instanceof ZodString ||
      zodSchema instanceof ZodNumber ||
      zodSchema instanceof ZodBoolean
    ) {
      return {
        value: {
          type: getParameterType(zodSchema),
          description: zodSchema.description,
        },
      };
    }

    // For other types, return an error
    return {
      error: "Parameters schema is not a ZodObject as expected.",
      typeReceived: zodSchema._def?.typeName || "unknown",
    };
  }

  const paramsShape = zodSchema.shape;
  const serializedParams: SerializedParameters = {};

  for (const key in paramsShape) {
    let currentFieldSchema: ZodSchema = paramsShape[key];
    const fieldDetails: Partial<SerializedParameter> = {};
    let isOptional = false;

    // Check if the field is optional or has a default value, and unwrap it
    if (currentFieldSchema instanceof ZodOptional) {
      isOptional = true;
      currentFieldSchema = currentFieldSchema.unwrap();
    } else if (currentFieldSchema instanceof ZodDefault) {
      isOptional = true; // Default implies optional for input filling purposes
      currentFieldSchema = currentFieldSchema.removeDefault();
    }

    fieldDetails.type = getParameterType(currentFieldSchema);
    if (currentFieldSchema.description) {
      fieldDetails.description = currentFieldSchema.description;
    }
    if (isOptional) {
      fieldDetails.optional = true;
    }

    serializedParams[key] = fieldDetails as unknown as SerializedParameter;
  }
  return serializedParams;
}

/**
 * GET handler for the /api/tools route.
 * Accepts mcpUrls in the request body and returns the serialized tools.
 */
export async function POST(request: Request) {
  try {
    const { mcpUrls } = await request.json();

    const { tools, breakdown, closeClients } = await getTools(mcpUrls || []);
    await closeClients();
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

    return NextResponse.json({
      tools: serializedTools,
      breakdown,
    });
  } catch (error) {
    console.error("Error serializing tools:", error);
    return NextResponse.json(
      { error: "Failed to serialize tools" },
      { status: 500 }
    );
  }
}

/**
 * GET handler for the /api/tools route.
 * Returns tools without any MCP configuration (just local tools).
 */
export async function GET() {
  try {
    const { tools, breakdown, closeClients } = await getTools([]);
    await closeClients();
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

    return NextResponse.json({
      tools: serializedTools,
      breakdown,
    });
  } catch (error) {
    console.error("Error serializing tools:", error);
    return NextResponse.json(
      { error: "Failed to serialize tools" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  // This endpoint is no longer needed since we're not using file storage
  return NextResponse.json(
    { message: "File storage is no longer used for MCP configuration" },
    { status: 200 }
  );
}
