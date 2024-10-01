"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

import type { inferSSRProps } from "@calcom/types/inferSSRProps";

import type { getServerSideProps } from "@server/lib/auth/signin/getServerSideProps";

export type PageProps = inferSSRProps<typeof getServerSideProps>;
function Signin({ providers }: PageProps) {
  useEffect(() => {
    const redirectToKeycloak = async () => {
      signIn("keycloak");
    };

    redirectToKeycloak();
  }, []);
  return null;

  // if (!providers) {
  //   return null;
  // }

  return <></>;
  // return (
  //   <div className="center mt-10 justify-between space-y-5 text-center align-baseline">
  //     {/* {Object.values(providers).map((provider) => {
  //       return (
  //         <div key={provider.name}>
  //           <Button onClick={() => signIn(provider.id)}>Sign in with {provider.name}</Button>
  //         </div>
  //       );
  //     })} */}
  //   </div>
  // );
}

export default Signin;
