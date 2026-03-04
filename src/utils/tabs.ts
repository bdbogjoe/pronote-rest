import * as pronote from "@niicojs/pawnote";

/**
 * Returns true if the session's current resource has access to the given tab.
 * Avoids making API calls that would fail with AccessDeniedError and corrupt the session sequence.
 */
export function hasTab(session: pronote.SessionHandle, tab: pronote.TabLocation): boolean {
  return session.userResource.tabs.has(tab);
}
