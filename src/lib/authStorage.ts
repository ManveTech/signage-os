// "Keep me signed in" decides which Web Storage the session token lives in —
// localStorage survives closing the browser entirely; sessionStorage is
// cleared the moment the tab closes. The token's own lifetime (a 7-day exp,
// enforced server-side in verifyJwt) is unchanged either way; this only
// controls whether the session outlives the browser session itself.
const TOKEN_KEY = 'signageos_token';

export function setAuthToken(token: string, persist: boolean): void {
  if (persist) {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
