import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(length: number) {
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join(
    "",
  );
}

export function generateLinkCode() {
  return `${randomChunk(3)}-${randomChunk(3)}`;
}

export function normalizeLinkCode(code: string) {
  return code.trim().toUpperCase();
}
