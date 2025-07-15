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

// New URL-based storage instead of JSON config
export const mcpUrlsAtom = atomWithStorage<McpUrl[]>("mcpUrls", []);

// Keep for backwards compatibility during migration
export const serverConfigAtom = atomWithStorage<Record<string, unknown> | null>(
  "serverConfig",
  null
);
