import { SaveError, deserializeWorld, serializeWorld } from './serialize';
import type { GameSave } from './serialize';

export function exportGame(save: GameSave): string {
  return encodeBase64(serializeWorld(save.world, save.meta));
}

export function importGame(data: string): GameSave {
  return deserializeWorld(decodeBase64(data));
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(data: string): string {
  const trimmed = data.trim();
  if (trimmed.length === 0) {
    throw new SaveError('invalid-format', 'Import string is empty.');
  }
  let binary: string;
  try {
    binary = atob(trimmed);
  } catch {
    throw new SaveError('invalid-format', 'Import string is not valid base64.');
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}