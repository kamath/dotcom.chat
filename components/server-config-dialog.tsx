"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  errorAtom,
  isMcpConfigOpenAtom,
  isMcpLoadingAtom,
  serverConfigAtom,
} from "@/services/mcp/atoms";
import mcpClient from "@/services/mcp/client";

export function ServerConfigDialog() {
  const serverConfig = useAtomValue(serverConfigAtom);
  const [mcpServersText, setMcpServersText] = useState("");
  const [isOpen, setIsOpen] = useAtom(isMcpConfigOpenAtom);
  const isLoading = useAtomValue(isMcpLoadingAtom);
  const jsonError = useAtomValue(errorAtom);

  // Sync textarea with serverConfig
  useEffect(() => {
    setMcpServersText(
      serverConfig ? JSON.stringify(serverConfig, null, 2) : ""
    );
  }, [serverConfig]);

  const handleConfigChange = (value: string) => {
    setMcpServersText(value);
    mcpClient.parseServerConfig(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Server Configuration</DialogTitle>
          <DialogDescription>
            Paste an MCP server config JSON object like you would in Cursor
            mcp.json
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Textarea
              id="serverConfig"
              value={mcpServersText}
              onChange={(e) => handleConfigChange(e.target.value)}
              className={`col-span-3 font-mono w-full ${
                jsonError ? "border-red-500" : ""
              }`}
              rows={6}
            />
            {jsonError && (
              <p className="col-span-3 text-sm text-red-500 mt-1">
                {jsonError}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mcpClient.handleSave()} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
