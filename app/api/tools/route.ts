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
import { readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";

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

// Write the data to mcpurls.json
const MCP_URLS_FILEPATH = join(process.cwd(), "mcpurls.json");
async function getExistingUrls() {
  try {
    const content = await readFile(MCP_URLS_FILEPATH, "utf8");
    if (!content.trim()) {
      return { mcpUrls: [] };
    }
    return JSON.parse(content);
  } catch {
    return { mcpUrls: [] };
  }
}

/**
 * GET handler for the /api/tools route.
 * Serializes and returns the definitions of tools from lib/tools.ts.
 */
export async function GET() {
  try {
    const { tools, breakdown, closeClients } = await getTools();
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
      config: await getExistingUrls(),
    });
  } catch (error) {
    console.error("Error serializing tools:", error);
    return NextResponse.json(
      { error: "Failed to serialize tools" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    console.log("DATA", data);

    // Validate that we received valid data
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Ensure mcpUrls is an array
    if (!Array.isArray(data.mcpUrls)) {
      return NextResponse.json(
        { error: "mcpUrls must be an array" },
        { status: 400 }
      );
    }

    const mcpData = {
      mcpUrls: data.mcpUrls,
    };

    const writing = JSON.stringify(mcpData, null, 2);
    console.log("Saving MCP URLs:", writing);
    await writeFile(MCP_URLS_FILEPATH, writing);

    return NextResponse.json(
      { message: "MCP URLs saved successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving MCP URLs:", error);
    return NextResponse.json(
      { error: "Failed to save MCP URLs" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Attempt to delete the mcpurls.json file
    await unlink(MCP_URLS_FILEPATH);
    return NextResponse.json(
      { message: "mcpurls.json deleted successfully" },
      { status: 200 }
    );
  } catch (error: unknown) {
    // If the file does not exist, treat as success
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return NextResponse.json(
        { message: "mcpurls.json did not exist, nothing to delete" },
        { status: 200 }
      );
    }
    console.error("Error deleting mcpurls.json:", error);
    return NextResponse.json(
      { error: "Failed to delete mcpurls.json" },
      { status: 500 }
    );
  }
}
