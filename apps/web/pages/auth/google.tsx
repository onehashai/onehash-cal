"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function GoogleLoginPage() {
  useEffect(() => {
    signIn("google", {
      callbackUrl: "/event-types",
    });
  }, []);

  return <p>Redirecting to Google login...</p>;
}
