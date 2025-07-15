import { Tool } from "ai";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface McpUrl {
  id: string;
  name: string;
  url: string;
}

export const toolsAtom = atom<Record<string, Record<string, Tool>> | null>(
  null
);
export const isMcpLoadingAtom = atom<boolean>(true);
export const errorAtom = atom<string | null>(null);
export const reloadToolsAtom = atom<boolean>(true);
export const breakdownAtom = atom<Record<string, Record<string, Tool>> | null>(
  null
);
export const isMcpConfigOpenAtom = atom<boolean>(false);

// Store MCP URLs in localStorage instead of JSON file
export const mcpUrlsAtom = atomWithStorage<McpUrl[]>("mcpUrls", []);
