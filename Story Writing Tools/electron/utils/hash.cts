import { createHash } from "node:crypto";

/**
 * Produces a lowercase hexadecimal SHA-256 digest of any UTF-8 string.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Produces a stable, key-sorted JSON string so equivalent objects always produce the same hash.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`
  );
  return `{${entries.join(",")}}`;
}

/**
 * Computes a deterministic SHA-256 content hash for any structured entity
 * (used by AiSyncCache delta scanning to avoid re-sending unchanged records).
 */
export function computeContentHash(payload: unknown): string {
  return sha256Hex(canonicalStringify(payload));
}

export interface WorldHashInput {
  title: string;
  genre?: string | null;
  worldSummary?: string | null;
  worldRulesJson?: string | null;
}

export function computeWorldHash(world: WorldHashInput): string {
  return computeContentHash({
    title: world.title.trim(),
    genre: (world.genre ?? "").trim(),
    worldSummary: (world.worldSummary ?? "").trim(),
    worldRulesJson: world.worldRulesJson ?? "[]",
  });
}

export interface CharacterHashInput {
  name: string;
  gender?: string | null;
  age?: string | null;
  family?: string | null;
  abilities?: string | null;
  personality?: string | null;
  appearance?: string | null;
  alignment: number;
  about?: string | null;
  customModulesJson?: string | null;
}

export function computeCharacterHash(character: CharacterHashInput): string {
  return computeContentHash({
    name: character.name.trim(),
    gender: (character.gender ?? "").trim(),
    age: (character.age ?? "").trim(),
    family: (character.family ?? "").trim(),
    abilities: (character.abilities ?? "").trim(),
    personality: (character.personality ?? "").trim(),
    appearance: (character.appearance ?? "").trim(),
    alignment: character.alignment,
    about: (character.about ?? "").trim(),
    customModulesJson: character.customModulesJson ?? "[]",
  });
}
