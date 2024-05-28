import type { GetServerSidePropsContext } from "next";
import { setCookie } from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { localStorage } from "@calcom/lib/webstorage";

function RedirectPage() {
  return;
}

export async function getServerSideProps({ req, res }: GetServerSidePropsContext) {
  const session = await getServerSession({ req, res });
  console.log("Yeah session", session);
  if (session?.id_token) {
    setCookie(null, "keycloak-id_token", session.id_token, { httpOnly: true, path: "/" });
    localStorage.setItem("keycloak-id_token", session.id_token);
  }
  if (!session?.user?.id) {
    return { redirect: { permanent: false, destination: "/auth/login" } };
  }

  return { redirect: { permanent: false, destination: "/event-types" } };
}

export default RedirectPage;
