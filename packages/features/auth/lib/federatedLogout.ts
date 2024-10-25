import { signOut } from "next-auth/react";

export default async function federatedLogout() {
  try {
    const response = await fetch("/api/auth/federated-logout");
    const data = await response.json();
    if (response.ok) {
      await signOut({ redirect: false });
      window.location.href = data.data;
      return;
    }
    await signOut();
  } catch (error) {
    console.log(error);
    alert(error);
    await signOut({ redirect: false });
    window.location.href = "/auth/login";
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
