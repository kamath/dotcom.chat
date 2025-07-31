import { Tool } from "ai";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface McpUrl {
  id: string;
  name: string;
  url: string;
}

export interface McpConnectionStatus {
  [serverName: string]: "connected" | "failed" | "connecting";
}

export const toolsAtom = atom<{ breakdown: Record<string, Record<string, Tool>> } | null>(
  null
);
export const isMcpLoadingAtom = atom<boolean>(true);
export const errorAtom = atom<string | null>(null);
export const reloadToolsAtom = atom<boolean>(true);
export const breakdownAtom = atom<Record<string, Record<string, Tool>> | null>(
  null
);
export const isMcpConfigOpenAtom = atom<boolean>(false);
export const connectionStatusAtom = atom<McpConnectionStatus>({});

// Store MCP URLs in localStorage instead of JSON file
export const mcpUrlsAtom = atomWithStorage<McpUrl[]>("mcpUrls", []);

// Track active server names for efficient lookups
export const activeServerNamesAtom = atom<Set<string>>(new Set<string>());

// Track servers currently being connected
export const connectingServersAtom = atom<Set<string>>(new Set<string>());
