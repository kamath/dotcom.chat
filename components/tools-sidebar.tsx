/**
 * TODO: another vibe-coded component.
 * I think it's not working properly with nested fields,
 * i.e. z.number().describe("A number").optional() return description
 * but z.number().optional().describe("A number") does not.
 */

import { useEffect } from "react";
import mcpClient from "@/services/mcp/client";
import { errorAtom, reloadToolsAtom } from "@/services/mcp/atoms";
import { isMcpLoadingAtom } from "@/services/mcp/atoms";
import { toolsAtom } from "@/services/mcp/atoms";
import { useAtom, useAtomValue } from "jotai";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function ToolsSidebar() {
  const tools = useAtomValue(toolsAtom);
  const isLoading = useAtomValue(isMcpLoadingAtom);
  const error = useAtomValue(errorAtom);
  const [reloadTools, setReloadTools] = useAtom(reloadToolsAtom);

  useEffect(() => {
    if (reloadTools) {
      mcpClient.getTools();
      setReloadTools(false);
    }
  }, [reloadTools, setReloadTools]);

  return (
    <div className="w-64 border-l flex flex-col h-full bg-sidebar-background dark:bg-sidebar-background">
      <div className="p-4 border-b flex gap-2 items-center">
        <h2 className="text-lg font-semibold">MCP Servers</h2>
      </div>
      <div className="flex-grow overflow-y-auto">
        <Accordion type="single" collapsible className="w-full">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Loading tools...
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : !tools ||
            !tools.breakdown ||
            Object.keys(tools.breakdown).length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">Hit M to connect to MCP servers!</p>
            </div>
          ) : (
            Object.entries(tools.breakdown).map(([server, tools]) => (
              <AccordionItem key={server} value={server}>
                <div className="p-4 border-b last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <AccordionTrigger>{server}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-4">
                      {Object.entries(tools).map(([name, tool]) => (
                        <div key={`${server}-${name}`}>
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
            ))
          )}
        </Accordion>
      </div>
    </div>
  );
}
