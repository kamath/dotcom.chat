import { atomWithStorage } from "jotai/utils";
import { createOriginIsolatedStorage, createSecureStorage } from "./secureStorage";

// Example: Converting existing atoms to use secure storage

// Before:
// export const myAtom = atomWithStorage("myKey", "defaultValue");

// After (for non-sensitive data - still secure from other websites):
export const myAtom = atomWithStorage(
  "myKey", 
  "defaultValue",
  createOriginIsolatedStorage<string>()
);

// After (for sensitive data - encrypted):
export const mySecureAtom = atomWithStorage(
  "mySecureKey",
  "defaultValue", 
  createSecureStorage<string>()
);

// For complex types:
interface UserSettings {
  theme: 'light' | 'dark';
  apiKey?: string;
}

export const settingsAtom = atomWithStorage<UserSettings>(
  "userSettings",
  { theme: 'light' },
  createSecureStorage<UserSettings>()
);

// Usage in components remains the same:
// const [value, setValue] = useAtom(mySecureAtom);