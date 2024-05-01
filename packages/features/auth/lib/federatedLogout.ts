import { signOut } from "next-auth/react";

export default async function federatedLogout() {
  try {
    const res = await fetch("/api/auth/federated-logout");
    const status = await res.json();
    if (status.result === 204) {
      await signOut();
    }
  } catch (error) {
    console.log(error);
    alert(error);
  }
}
