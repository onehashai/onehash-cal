"use client";

import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { inferSSRProps } from "@lib/types/inferSSRProps";

import type { getServerSideProps } from "@server/lib/auth/logout/getServerSideProps";

export type PageProps = inferSSRProps<typeof getServerSideProps>;

export function Logout(props: PageProps) {
  // const [btnLoading, setBtnLoading] = useState<boolean>(false);
  const { status } = useSession();
  const router = useRouter();
  // useEffect(() => {
  //   if (!!ACCOUNT_DELETE_SURVEY && props.query?.survey === "true") {
  //     router.push(`${WEBSITE_URL}/cancellation`);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [props.query?.survey]);
  // const { t } = useLocale();

  // const message = () => {
  //   if (props.query?.passReset === "true") return "reset_your_password";
  //   if (props.query?.emailChange === "true") return "email_change";
  //   return "hope_to_see_you_soon";
  // };

  const navigateToHome = () => {
    router.replace("/");
  };
  const redirectToKeycloak = async () => {
    signIn("keycloak");
  };
  useEffect(() => {
    navigateToHome();
  }, [status]);

  return <></>;
  // return (
  //   <AuthContainer title={t("logged_out")} description={t("youve_been_logged_out")} showLogo>
  //     <div className="mb-4">
  //       <div className="bg-success mx-auto flex h-12 w-12 items-center justify-center rounded-full">
  //         <Icon name="check" className="h-6 w-6 text-green-600" />
  //       </div>
  //       <div className="mt-3 text-center sm:mt-5">
  //         <h3 className="text-emphasis text-lg font-medium leading-6" id="modal-title">
  //           {t("youve_been_logged_out")}
  //         </h3>
  //         <div className="mt-2">
  //           <p className="text-subtle text-sm">{t(message())}</p>
  //         </div>
  //       </div>
  //     </div>
  //     <Button
  //       data-testid="logout-btn"
  //       onClick={navigateToLogin}
  //       className="flex w-full justify-center"
  //       loading={btnLoading}>
  //       {t("go_back_login")}
  //     </Button>
  //   </AuthContainer>
  // );
}

export default Logout;
