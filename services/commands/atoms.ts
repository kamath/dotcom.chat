import { AvailableModel } from "@/sharedTypes";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const modelNameAtom = atomWithStorage<AvailableModel>(
  "modelName",
  "anthropic/claude-sonnet-4-20250514"
);

export const pendingMessageConfigAtom = atom((get) => {
  const modelName = get(modelNameAtom);
  // Default fallback
  return {
    modelName: modelName,
  };
});

export const cmdkOpenAtom = atom(false);
export const dialogOpenAtom = atom(false);

// Global state for keybindings - when true, keybindings are active
export const keybindingsActiveAtom = atom(true);
