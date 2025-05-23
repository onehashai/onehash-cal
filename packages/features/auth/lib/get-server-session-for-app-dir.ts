import { getServerSession } from "next-auth";
import { cookies } from "next/headers";

import { getOptions } from "./next-auth-options";

export async function getServerSessionForAppDir() {
  return await getServerSession(
    getOptions({
      keycloak_token: cookies().get("keycloak_token")?.value,
    })
  );
}
