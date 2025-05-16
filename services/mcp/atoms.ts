import { Tool } from "ai";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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

export const serverConfigAtom = atomWithStorage<Record<string, unknown> | null>(
  "serverConfig",
  null
);
