import { uuid } from "expo";

/** UUID v4 from Expo core; no separately linked ExpoCrypto module is required.
 * IDs are created on demand and retained by the caller when retrying a write.
 * Never replace this with timestamps or Math.random-based IDs.
 */
export function randomUUID(): string {
  return uuid.v4();
}
