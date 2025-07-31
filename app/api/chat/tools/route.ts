import { NextResponse } from 'next/server';
import { SessionCookies } from '@/lib/session-cookies';
import { McpUrl, toolsService } from '@/services/mcp/tools-service';
import { Tool } from 'ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mcpUrls: McpUrl[] = body.urls || [];

    // Get session from cookies
    const session = await SessionCookies.getSession();
    if (!session?.sessionId) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    // Set the session on the tools service so it uses the right connection
    toolsService.setSessionId(session.sessionId);

    // Get the tools using the server-side service
    const { tools, breakdown, errors, authRequired } = await toolsService.getToolsWithBreakdown(mcpUrls);

    // Serialize the tools for the client
    const serializedBreakdown = Object.entries(breakdown).reduce((acc, [serverName, serverTools]) => {
      const serializedTools = serverTools.reduce((toolAcc: Record<string, any>, tool: any) => {
        toolAcc[tool.function.name] = tool;
        return toolAcc;
      }, {} as Record<string, any>);
      acc[serverName] = serializedTools;
      return acc;
    }, {} as Record<string, any>);


    return NextResponse.json({
      tools: toolsService.serializeTools(tools as any),
      breakdown: serializedBreakdown,
      errors,
      authRequired,
    });
  } catch (error) {
    console.error('[API /chat/tools] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
