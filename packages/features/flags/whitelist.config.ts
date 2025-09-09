import { WHITELISTED_ORGS } from "@calcom/lib/constants";

// Whitelisted domains setup
const allowedDomains = (WHITELISTED_ORGS || "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean); // remove empty strings

export const allowedDomainSet = new Set(allowedDomains);

export function checkIfUserWhiteListed(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1].toLowerCase();
  return allowedDomainSet.has(domain);
}
