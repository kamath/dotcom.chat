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
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Plus, Trash2, Globe, AlertCircle } from "lucide-react";
import {
  errorAtom,
  isMcpConfigOpenAtom,
  isMcpLoadingAtom,
  mcpUrlsAtom,
  type McpUrl,
} from "@/services/mcp/atoms";
import { keybindingsActiveAtom } from "@/services/commands/atoms";
import mcpClient from "@/services/mcp/client";

export function McpUrlManager() {
  const [urls, setUrls] = useAtom(mcpUrlsAtom);
  const [isOpen, setIsOpen] = useAtom(isMcpConfigOpenAtom);
  const isLoading = useAtomValue(isMcpLoadingAtom);
  const error = useAtomValue(errorAtom);
  const setKeybindingsActive = useSetAtom(keybindingsActiveAtom);

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  // Handle keybindings when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setKeybindingsActive(false);
    } else {
      setKeybindingsActive(true);
    }
    return () => {
      setKeybindingsActive(true);
    };
  }, [isOpen, setKeybindingsActive]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setNewName("");
      setNewUrl("");
      setValidationError("");
    }
  }, [isOpen]);

  const validateUrl = (url: string): { valid: boolean; message?: string } => {
    try {
      const urlObject = new URL(url);

      if (urlObject.protocol !== "http:" && urlObject.protocol !== "https:") {
        return { valid: false, message: "URL must use HTTP or HTTPS protocol" };
      }

      // Check if URL looks like it might be an MCP endpoint
      if (urlObject.search && !urlObject.pathname.includes("/mcp")) {
        return {
          valid: true,
          message:
            "⚠️ This URL has query parameters but doesn't look like an MCP endpoint. MCP URLs typically end with '/mcp'",
        };
      }

      return { valid: true };
    } catch {
      return { valid: false, message: "Please enter a valid URL" };
    }
  };

  const handleAddUrl = () => {
    if (!newName.trim()) {
      setValidationError("Server name is required");
      return;
    }

    if (!newUrl.trim()) {
      setValidationError("URL is required");
      return;
    }

    const urlValidation = validateUrl(newUrl);
    if (!urlValidation.valid) {
      setValidationError(
        urlValidation.message || "Please enter a valid HTTP/HTTPS URL"
      );
      return;
    }

    // Show warning but don't prevent addition
    if (urlValidation.message) {
      setValidationError(urlValidation.message);
      // Don't return, let user proceed with warning
    }

    const newUrlObj: McpUrl = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      url: newUrl.trim(),
    };

    const updatedUrls = [...(urls || []), newUrlObj];
    setUrls(updatedUrls);
    setNewName("");
    setNewUrl("");
    setValidationError("");
  };

  const handleDeleteUrl = (id: string) => {
    const updatedUrls = (urls || []).filter((url) => url.id !== id);
    setUrls(updatedUrls);
  };

  const handleTestConnection = async () => {
    try {
      await mcpClient.getTools();
    } catch (error) {
      console.error("Error testing connection:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newName && newUrl) {
      handleAddUrl();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            MCP Server URLs
          </DialogTitle>
          <DialogDescription>
            Add MCP server URLs that support Streamable HTTP/SSE transport. URLs
            should point to valid MCP endpoints (usually ending in{" "}
            <code>/mcp</code>). These servers will be connected to provide
            additional tools. URLs are sent with each chat request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new URL section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium">Add New MCP Server</h4>
            <div className="space-y-3">
              <Input
                placeholder="Server name (e.g., Weather API)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full"
              />
              <Input
                placeholder="https://your-mcp-server.com/mcp"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full font-mono text-sm"
              />
            </div>
            {validationError && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  validationError.startsWith("⚠️")
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-500"
                }`}
              >
                <AlertCircle className="h-4 w-4" />
                {validationError}
              </div>
            )}
            <Button onClick={handleAddUrl} size="sm" className="w-full">
              <Plus className="h-4 w-4" />
              Add URL
            </Button>
          </div>

          {/* Existing URLs list */}
          <div className="space-y-2">
            {urls && urls.length > 0 ? (
              urls.map((url) => (
                <div
                  key={url.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{url.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {url.url}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteUrl(url.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-center text-muted-foreground py-4">
                No MCP servers configured.
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <Button
            onClick={handleTestConnection}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={() => setIsOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
