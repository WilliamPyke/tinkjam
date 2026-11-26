import { isSignInPath } from "../sidebar/mainAppLocation";

function signedInCookie(part: string): boolean {
  const [name = "", ...rest] = part.trim().split("=");
  const value = rest.join("=");
  if (name === "__session" || name.startsWith("__session_")) return value !== "";
  // Clerk keeps when the client last signed in here; "0" once it signed out.
  if (name === "__client_uat" || name.startsWith("__client_uat_")) {
    return value !== "" && value !== "0";
  }
  return false;
}

/**
 * Whether sign-in (Clerk) must start with the page: someone is or was signed in here, the page is
 * sign-in itself, or the link carries something for Clerk (a development instance's hand-over, an
 * invitation). Anyone else is signed out, and Clerk loads when they ask to sign in.
 */
export function needsClerkAtStartup(input: {
  readonly cookie: string;
  readonly pathname: string;
  readonly search: string;
  readonly signedInHere: boolean;
}): boolean {
  return (
    input.signedInHere ||
    isSignInPath(input.pathname) ||
    [...new URLSearchParams(input.search).keys()].some((key) => key.startsWith("__clerk")) ||
    input.cookie.split(";").some(signedInCookie)
  );
}
