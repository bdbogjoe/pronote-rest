import { SessionHandle } from "@niicojs/pawnote";
import { Mutex } from "async-mutex";

// Map from child name to their pawnote session (with correct resource pre-selected)
export const children = new Map<string, SessionHandle>();

// Mutex for write operations (login/re-login)
// Reads proceed without locking since Node.js is single-threaded
export const writeMutex = new Mutex();

export let forceLogin = false;
export let errorCount = 0;
export let lastLoginTime = 0;

export function setForceLogin(v: boolean): void {
  forceLogin = v;
}

export function setErrorCount(v: number): void {
  errorCount = v;
}

export function setLastLoginTime(v: number): void {
  lastLoginTime = v;
}
