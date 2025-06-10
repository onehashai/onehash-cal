import { signOut } from "next-auth/react";

import { showToast } from "@calcom/ui";

export default async function federatedLogout() {
  try {
    const response = await fetch("/api/auth/federated-logout");
    const data = await response.json();

    if (response.ok) {
      await signOut({ callbackUrl: data.data });
      return;
    }
  } catch (error) {
    showToast(`Failed to signout from SSO`, "error");
  }
}

export async function logoutAndDeleteUser(deleteAccount: (url: string) => Promise<void>) {
  try {
    const response = await fetch("/api/auth/federated-logout");
    const data = await response.json();
    if (response.ok) {
      await deleteAccount(data.data);
      return;
    }
    console.error("Failed to logout user from Keycloak", status);
  } catch (error) {
    console.log(error);
  }
}
