import { safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

type VaultData = Record<string, string>;

let vaultFilePath = "";

export function initSecretVault(userDataDir: string): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  vaultFilePath = path.join(userDataDir, "story_studio.vault.enc.json");
}

function getVaultPath(): string {
  if (!vaultFilePath) {
    throw new Error("Secret vault has not been initialized.");
  }
  return vaultFilePath;
}

function readVault(): VaultData {
  const filePath = getVaultPath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as VaultData;
    }
  } catch {
    // Return empty vault if unreadable
  }
  return {};
}

function writeVault(data: VaultData): void {
  const filePath = getVaultPath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function isOsEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Encrypts an API key using OS-native encryption (Windows DPAPI / macOS Keychain / Linux Secret Service)
 * and persists only the ciphertext outside the SQLite database.
 */
export function setSecret(keyringRef: string, plainSecret: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS-level secret encryption (safeStorage) is not available on this system."
    );
  }

  const trimmed = plainSecret.trim();
  const vault = readVault();

  if (!trimmed) {
    delete vault[keyringRef];
    writeVault(vault);
    return;
  }

  const encryptedBuffer = safeStorage.encryptString(trimmed);
  vault[keyringRef] = encryptedBuffer.toString("base64");
  writeVault(vault);
}

/**
 * Decrypts and returns an API key strictly inside the Electron main process.
 * Never send the raw returned value over IPC to the renderer.
 */
export function getSecret(keyringRef: string): string | null {
  const vault = readVault();
  const base64Cipher = vault[keyringRef];
  if (!base64Cipher) {
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS-level secret encryption (safeStorage) is not available on this system."
    );
  }

  const encryptedBuffer = Buffer.from(base64Cipher, "base64");
  return safeStorage.decryptString(encryptedBuffer);
}

export function hasSecret(keyringRef: string): boolean {
  const vault = readVault();
  return Boolean(vault[keyringRef]);
}

export function getMaskedSecret(keyringRef: string): string {
  try {
    const secret = getSecret(keyringRef);
    if (!secret) return "";
    if (secret.length <= 6) {
      return "••••••";
    }
    const prefix = secret.slice(0, 3);
    const suffix = secret.slice(-4);
    return `${prefix}••••${suffix}`;
  } catch {
    return hasSecret(keyringRef) ? "••••••" : "";
  }
}

export function deleteSecret(keyringRef: string): void {
  const vault = readVault();
  if (keyringRef in vault) {
    delete vault[keyringRef];
    writeVault(vault);
  }
}
