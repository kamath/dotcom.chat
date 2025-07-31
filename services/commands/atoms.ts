import { AvailableModel } from "@/sharedTypes";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const modelNameAtom = atomWithStorage<AvailableModel>(
  "modelName",
  "anthropic/claude-4-sonnet-20250514"
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

// Session ID atom - generates a new session ID if none exists
export const sessionIdAtom = atom(() => {
  if (typeof window !== 'undefined') {
    const storedSessionId = sessionStorage.getItem('sessionId');
    if (storedSessionId) {
      return storedSessionId;
    }
    const newSessionId = crypto.randomUUID();
    sessionStorage.setItem('sessionId', newSessionId);
    return newSessionId;
  }
  return crypto.randomUUID();
});
