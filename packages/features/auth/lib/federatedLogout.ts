import { signOut } from "next-auth/react";

import { WEBAPP_URL } from "@calcom/lib/constants";

export default async function federatedLogout() {
  try {
    const res = await fetch(`${WEBAPP_URL}/api/auth/federated-logout`);
    const status = await res.json();
    if (status.result === 204) {
      await signOut();
    }
  } catch (error) {
    console.log(error);
    alert(error);
  }
}
