import type { SyncStorage } from 'jotai/vanilla/utils/atomWithStorage'

// Create a generic storage adapter that handles JSON serialization
function createStorage<T>(): SyncStorage<T> {
  return {
    getItem(key: string, initialValue: T): T {
      try {
        const item = localStorage.getItem(key);
        if (item === null) return initialValue;
        return JSON.parse(item);
      } catch {
        return initialValue;
      }
    },
    setItem(key: string, value: T): void {
      localStorage.setItem(key, JSON.stringify(value));
    },
    removeItem(key: string): void {
      localStorage.removeItem(key);
    },
  };
}

// Async storage for encrypted data
class SecureStorageAsync<T> {
  private key: CryptoKey | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  async initKey() {
    if (this.key) return;
    
    const rawKey = localStorage.getItem('encryption-key');
    if (rawKey) {
      const keyData = Uint8Array.from(atob(rawKey), c => c.charCodeAt(0));
      this.key = await crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        false,
        ['encrypt', 'decrypt']
      );
    } else {
      this.key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exported = await crypto.subtle.exportKey('raw', this.key);
      const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
      localStorage.setItem('encryption-key', base64Key);
    }
  }

  private async encrypt(text: string): Promise<string> {
    await this.initKey();
    if (!this.key) throw new Error('No encryption key');
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      this.encoder.encode(text)
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(data: string): Promise<string> {
    await this.initKey();
    if (!this.key) throw new Error('No encryption key');
    
    const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      encrypted
    );
    
    return this.decoder.decode(decrypted);
  }

  async getItem(key: string, initialValue: T): Promise<T> {
    try {
      const encrypted = localStorage.getItem(`secure-${key}`);
      if (!encrypted) return initialValue;
      
      const decrypted = await this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch {
      return initialValue;
    }
  }

  async setItem(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    const encrypted = await this.encrypt(serialized);
    localStorage.setItem(`secure-${key}`, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(`secure-${key}`);
  }
}

// Factory functions for creating storage
export function createOriginIsolatedStorage<T>() {
  return createStorage<T>();
}

// Create async storage adapter for Jotai
export function createSecureStorage<T>() {
  const storage = new SecureStorageAsync<T>();
  
  return {
    getItem: (key: string, initialValue: T) => storage.getItem(key, initialValue),
    setItem: (key: string, value: T) => storage.setItem(key, value),
    removeItem: (key: string) => storage.removeItem(key),
  };
}