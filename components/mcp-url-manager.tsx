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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Plus, Trash2, Globe, AlertCircle, RefreshCw } from "lucide-react";
import { Tool } from "ai";
import {
  errorAtom,
  isMcpConfigOpenAtom,
  mcpUrlsAtom,
  toolsAtom,
  isMcpLoadingAtom,
  connectionStatusAtom,
  type McpUrl,
} from "@/services/mcp/atoms";
import { keybindingsActiveAtom } from "@/services/commands/atoms";
import mcpClient from "@/services/mcp/client";

function validateUrl(url: string): { valid: boolean; message?: string } {
  try {
    const urlObject = new URL(url);

    if (!["http:", "https:"].includes(urlObject.protocol)) {
      return { valid: false, message: "URL must use HTTP or HTTPS protocol" };
    }

    // Check for localhost or 127.0.0.1 and warn
    if (
      urlObject.hostname === "localhost" ||
      urlObject.hostname === "127.0.0.1"
    ) {
      return {
        valid: true,
        message:
          "⚠️ Warning: Localhost URLs won't work in production deployments",
      };
    }

    // Check for local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(
      urlObject.hostname
    );
    if (isLocalIP) {
      return {
        valid: true,
        message:
          "⚠️ Warning: Local network IPs may not be accessible to all users",
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, message: "Invalid URL format" };
  }
}

function getCleanUrlForDisplay(url: string): string {
  try {
    const urlObject = new URL(url);
    return `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}`;
  } catch {
    return url;
  }
}

export function McpUrlManager() {
  const [urls, setUrls] = useAtom(mcpUrlsAtom);
  const [isOpen, setIsOpen] = useAtom(isMcpConfigOpenAtom);
  const error = useAtomValue(errorAtom);
  const setKeybindingsActive = useSetAtom(keybindingsActiveAtom);

  const tools = useAtomValue(toolsAtom);
  const isLoading = useAtomValue(isMcpLoadingAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);

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
      setNewUrl("");
      setValidationError("");
    }
  }, [isOpen]);

  // No automatic connection when dialog opens - just display cached state

  // Migrate existing URLs to use new naming convention (run once on mount)
  const hasMigrated = useRef(false);
  const migrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hasMigrated.current && urls && urls.length > 0) {
      const needsUpdate = urls.some((url) => {
        const newName = generateServerName(url.url);
        return url.name !== newName;
      });

      if (needsUpdate) {
        const updatedUrls = urls.map((url) => ({
          ...url,
          name: generateServerName(url.url),
        }));
        setUrls(updatedUrls);

        // Debounce the refresh to avoid rapid calls
        if (migrationTimeoutRef.current) {
          clearTimeout(migrationTimeoutRef.current);
        }
        migrationTimeoutRef.current = setTimeout(() => {
          mcpClient.getTools();
        }, 100);
      }
      hasMigrated.current = true;
    }

    // Cleanup timeout on unmount
    return () => {
      if (migrationTimeoutRef.current) {
        clearTimeout(migrationTimeoutRef.current);
      }
    };
  }, [urls, setUrls]);

  const generateServerName = (url: string): string => {
    try {
      const urlObject = new URL(url);

      // Check if it's a Smithery server URL
      if (urlObject.hostname === "server.smithery.ai") {
        // Handle @org/repo format
        const orgRepoMatch = urlObject.pathname.match(/^\/(@[^/]+\/[^/]+)/);
        if (orgRepoMatch) {
          return orgRepoMatch[1]; // Returns @org/repo
        }

        // Handle simple name format like /exa/mcp
        const simpleMatch = urlObject.pathname.match(/^\/([^/]+)/);
        if (simpleMatch && simpleMatch[1] !== "mcp") {
          return simpleMatch[1]; // Returns just "exa"
        }
      }

      // For other URLs, create a truncated display name
      const domain = urlObject.hostname;
      let path = urlObject.pathname;

      // Truncate anything after "/mcp"
      const mcpIndex = path.indexOf("/mcp");
      if (mcpIndex !== -1) {
        path = path.substring(0, mcpIndex + 4); // Keep "/mcp" but remove everything after
      }

      // If path is just "/mcp" or similar, just show domain
      if (path === "/mcp" || path === "/" || path === "") {
        return domain;
      }

      // Truncate long paths
      const fullPath = domain + path;
      if (fullPath.length > 40) {
        return fullPath.substring(0, 37) + "...";
      }

      return fullPath;
    } catch {
      return url;
    }
  };

  const handleAddUrl = () => {
    if (!newUrl.trim()) {
      setValidationError("URL is required");
      return;
    }

    // Check for duplicate URLs
    const trimmedUrl = newUrl.trim();
    if (urls?.some((url) => url.url === trimmedUrl)) {
      setValidationError("This URL has already been added");
      return;
    }

    const urlValidation = validateUrl(trimmedUrl);
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

    const serverName = generateServerName(trimmedUrl);

    const newUrlObj: McpUrl = {
      id: crypto.randomUUID(),
      name: serverName,
      url: trimmedUrl,
    };

    const updatedUrls = [...(urls || []), newUrlObj];
    setUrls(updatedUrls);
    setNewUrl("");
    setValidationError("");
    // Immediately connect to the new server
    mcpClient.getTools();
  };

  const handleDeleteUrl = (id: string) => {
    const updatedUrls = (urls || []).filter((url) => url.id !== id);
    setUrls(updatedUrls);
    // Immediately refresh connections after removing a server
    mcpClient.getTools();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newUrl) {
      handleAddUrl();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Get the pasted content
    const pastedText = e.clipboardData.getData("text");

    // Check if it looks like a URL
    if (
      pastedText.trim().startsWith("http://") ||
      pastedText.trim().startsWith("https://")
    ) {
      // Set the URL in the input
      setNewUrl(pastedText.trim());

      // Clear any existing validation errors
      setValidationError("");

      // Validate and add the URL automatically after a short delay
      setTimeout(() => {
        const trimmedPastedText = pastedText.trim();

        // Check for duplicate URLs
        if (urls?.some((url) => url.url === trimmedPastedText)) {
          setValidationError("This URL has already been added");
          return;
        }

        const urlValidation = validateUrl(trimmedPastedText);
        if (urlValidation.valid) {
          // Auto-add the URL
          const serverName = generateServerName(trimmedPastedText);
          const newUrlObj: McpUrl = {
            id: crypto.randomUUID(),
            name: serverName,
            url: trimmedPastedText,
          };

          const updatedUrls = [...(urls || []), newUrlObj];
          setUrls(updatedUrls);
          setNewUrl("");
          setValidationError("");
          // Immediately connect to the new server
          mcpClient.getTools();
        } else {
          // Show validation error but keep the URL in the input
          setValidationError(
            urlValidation.message || "Please enter a valid HTTP/HTTPS URL"
          );
        }
      }, 100); // Small delay to ensure the input value is set first
    }
  };

  const handleReconnect = async (serverName: string) => {
    await mcpClient.reconnectServer(serverName);
  };

  const getConnectionStatusIcon = (serverName: string) => {
    const status = connectionStatus[serverName];
    switch (status) {
      case "connected":
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case "failed":
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      case "connecting":
        return (
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        );
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            MCP Servers & Tools
          </DialogTitle>
          <DialogDescription>
            Manage your MCP server URLs and view available tools. URLs should
            point to valid MCP endpoints.
            <br />
            <span className="text-sm font-bold">
              New to MCP?{" "}
              <a
                href="https://smithery.ai/server/exa"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600"
              >
                Try Exa from Smithery for free
              </a>{" "}
              to enable web search.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
          {/* Add new URL section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium">Add New MCP Server</h4>
            <div className="space-y-3">
              <Input
                placeholder="Paste or type MCP URL (auto-adds on paste)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                onPaste={handlePaste}
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

          {/* Servers and Tools section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Connected Servers & Tools</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!isLoading) {
                    await mcpClient.getTools();
                  }
                }}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh All
              </Button>
            </div>

            {isLoading ? (
              urls && urls.length > 0 ? (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full space-y-8"
                >
                  {urls.map((url) => {
                    const serverStatus =
                      connectionStatus[url.name] || "connecting";

                    return (
                      <AccordionItem key={url.id} value={url.id}>
                        <div className="border rounded-md">
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3 flex-1">
                              {getConnectionStatusIcon(url.name)}
                              <div className="flex flex-col gap-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <AccordionTrigger className="hover:no-underline p-0 font-medium">
                                    {url.name}
                                  </AccordionTrigger>
                                  {serverStatus === "connecting" && (
                                    <span className="text-xs text-yellow-600">
                                      (Connecting)
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {getCleanUrlForDisplay(url.url)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUrl(url.id)}
                                title="Remove server"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <AccordionContent className="px-3 pb-3">
                            <div className="text-sm text-yellow-600 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              Tools are loading...
                            </div>
                          </AccordionContent>
                        </div>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">Loading tools...</p>
                </div>
              )
            ) : error ? (
              <div className="p-4 text-sm text-red-500 text-center">
                {error}
              </div>
            ) : !urls || urls.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No MCP servers configured.</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full space-y-2">
                {urls.map((url) => {
                  const serverTools = tools?.breakdown?.[url.name] || {};
                  const failedKey = `${url.name} (Failed)`;
                  const hasFailedEntry = tools?.breakdown?.[failedKey];
                  const hasTools = Object.keys(serverTools).length > 0;
                  const serverStatus = connectionStatus[url.name] || "unknown";

                  return (
                    <AccordionItem key={url.id} value={url.id}>
                      <div className="border rounded-md">
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 flex-1">
                            {getConnectionStatusIcon(url.name)}
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2">
                                <AccordionTrigger className="hover:no-underline p-0 font-medium">
                                  {url.name}
                                </AccordionTrigger>
                                {hasFailedEntry && (
                                  <span className="text-xs text-red-500">
                                    (Failed)
                                  </span>
                                )}
                                {hasTools && (
                                  <span className="text-xs text-muted-foreground">
                                    ({Object.keys(serverTools).length} tools)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground font-mono">
                                {getCleanUrlForDisplay(url.url)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(serverStatus === "failed" || hasFailedEntry) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReconnect(url.name)}
                                disabled={serverStatus === "connecting"}
                                title="Reconnect to server"
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${
                                    serverStatus === "connecting"
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUrl(url.id)}
                              title="Remove server"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {(hasTools ||
                          hasFailedEntry ||
                          serverStatus === "connecting") && (
                          <AccordionContent className="px-3 pb-3">
                            {serverStatus === "connecting" ? (
                              <div className="text-sm text-yellow-600 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                Tools are loading...
                              </div>
                            ) : hasFailedEntry ? (
                              <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                Failed to connect to this server. Check the URL
                                and try reconnecting.
                              </div>
                            ) : hasTools ? (
                              <div className="space-y-3 pl-4">
                                {Object.entries(serverTools).map(
                                  ([toolName, tool]) => (
                                    <div
                                      key={`${url.name}-${toolName}`}
                                      className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                                    >
                                      <p className="text-sm font-medium">
                                        {toolName}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {(tool as Tool).description ||
                                          "No description available"}
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground p-2">
                                No tools available from this server.
                              </div>
                            )}
                          </AccordionContent>
                        )}
                      </div>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <DialogFooter>
          <Button onClick={() => setIsOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
