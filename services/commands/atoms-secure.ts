import { AvailableModel } from "@/sharedTypes";
import { atomWithStorage } from "jotai/utils";
import { createOriginIsolatedStorage, createSecureStorage } from "@/utils/secureStorage";

// For non-sensitive data, just use origin-isolated storage
export const modelNameAtom = atomWithStorage<AvailableModel>(
  "modelName",
  "anthropic/claude-4-sonnet-20250514",
  createOriginIsolatedStorage<AvailableModel>()
);

// For sensitive data, use encrypted storage (async)
export const sensitiveDataAtom = atomWithStorage<string>(
  "sensitiveData",
  "",
  createSecureStorage<string>()
);

// Example: If you want to store API keys or tokens
export const apiKeyAtom = atomWithStorage<string | null>(
  "apiKey",
  null,
  createSecureStorage<string | null>()
);