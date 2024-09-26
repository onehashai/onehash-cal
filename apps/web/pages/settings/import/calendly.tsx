import { CalendlyOAuthProvider } from "@onehash/calendly";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { GetServerSidePropsContext } from "next/types";
import { useEffect, useState } from "react";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import prisma from "@calcom/prisma";
import { IntegrationProvider } from "@calcom/prisma/client";
import { Button, CheckboxField, Meta, SkeletonContainer } from "@calcom/ui";

import useCalendlyImport from "@lib/hooks/useCalendlyImport";

import PageWrapper from "@components/PageWrapper";

const SkeletonLoader = ({ title, description }: { title: string; description: string }) => {
  return (
    <SkeletonContainer>
      <Meta title={title} description={description} borderInShellHeader={true} />
    </SkeletonContainer>
  );
};

//Component responsible for importing data from Calendly if user has already authorized Calendly
const ImportFromCalendlyButton = ({
  importFromCalendly,
  importing,
}: {
  importFromCalendly: () => Promise<void>;
  importing: boolean | undefined;
}) => {
  const { t } = useLocale();

  return (
    <Button color="secondary" StartIcon="plus" onClick={importFromCalendly} loading={importing}>
      {t("import")}
    </Button>
  );
};

//Main view for Calendly import
const ImportLayout = ({ code }: { code?: string }) => {
  const [userId, setUserId] = useState<number>();

  const session = useSession();

  //checks if the user had already authorized Calendly on first load
  useEffect(() => {
    if (!session || !session.data) return;
    session.data.user.id && setUserId(session.data.user.id);
  }, [session]);

  return <> {userId ? <CalendlyImportComponent userId={userId} code={code} /> : <></>}</>;
};

const CalendlyImportComponent = ({ userId, code }: { userId: number; code?: string }) => {
  const { importFromCalendly, importing, handleChangeNotifyUsers, sendCampaignEmails } =
    useCalendlyImport(userId);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const { t } = useLocale();

  const router = useRouter();
  useEffect(() => {
    if (code) importFromCalendly().then(() => router.replace("/event-types"));
    else checkIfAuthorized(userId);
  }, [userId, code]);
  /**
   * Checks if the user has already authorized Calendly and sets the state accordingly
   * @param userId The user id of the current user
   */
  const checkIfAuthorized = async (userId: number) => {
    try {
      setLoading(true);
      if (!userId) return;
      const res = await fetch(`/api/import/calendly/auth?userId=${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("error", data);
        return;
      }
      const data = await res.json();
      setIsAuthorized(data.authorized);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleOnClickImport = () => {
    const queryParams = {
      client_id: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
      response_type: "code",
    };
    window.location.href = `${process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL}/authorize?${new URLSearchParams(
      queryParams
    )}`;
  };
  return (
    <>
      {loading ? (
        <SkeletonLoader title="Calendly" description={t("import_data_instructions")} />
      ) : (
        <div className="bg-default w-full sm:mx-0 xl:mt-0">
          <Meta
            title="Calendly"
            description={t("import_data_instructions")}
            CTA={
              isAuthorized ? (
                <ImportFromCalendlyButton
                  importFromCalendly={() => importFromCalendly().then(() => router.replace("/event-types"))}
                  importing={importing}
                />
              ) : (
                <Button onClick={handleOnClickImport} color="secondary" StartIcon="plus">
                  {t("import")}
                </Button>
              )
            }
            borderInShellHeader={true}
          />
          <div className="mt-3 px-4">
            <CheckboxField
              defaultChecked={sendCampaignEmails}
              description={t("notify_past_bookers")}
              onChange={(e) => {
                handleChangeNotifyUsers(e.target.checked);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

ImportLayout.getLayout = getLayout;
ImportLayout.PageWrapper = PageWrapper;

export default ImportLayout;

// pages/index.js
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { code } = context.query;

  if (code && typeof code === "string") {
    const session = await getServerSession(context);
    const user = session?.user;
    if (!user) return null;

    const authenticated = await handleOAuthRedirect({
      code,
      userId: user.id,
    });
    if (!authenticated) return { notFound: true } as const;

    await prisma.user.update({
      where: { id: user.id },
      data: { completedOnboarding: true },
    });
    // Return the data as props
    return {
      props: {
        code,
      },
    };
  } else
    return {
      props: {},
    };
}

async function handleOAuthRedirect({ code, userId }: { code: string; userId: number }) {
  try {
    const calendlyOAuthProvider = new CalendlyOAuthProvider({
      clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: process.env.CALENDLY_CLIENT_SECRET ?? "",
      redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
      oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
    });
    const { access_token, refresh_token, token_type, expires_in, created_at, owner } =
      await calendlyOAuthProvider.getAccessToken(code);
    // check if integration account for the user exists
    const integrationAccount = await prisma.integrationAccounts.findFirst({
      where: {
        userId: userId,
        provider: IntegrationProvider.CALENDLY,
      },
    });
    //if already exists update the token configs
    if (integrationAccount) {
      await prisma.integrationAccounts.update({
        where: {
          userId_provider: {
            userId: userId,
            provider: IntegrationProvider.CALENDLY,
          },
        },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenType: token_type,
          expiresIn: expires_in,
          createdAt: created_at,
          ownerUniqIdentifier: owner,
        },
      });
    } else {
      //else adding new integration account and linking to user
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          integrationAccounts: {
            create: {
              accessToken: access_token,
              refreshToken: refresh_token,
              tokenType: token_type,
              expiresIn: expires_in,
              createdAt: created_at,
              provider: IntegrationProvider.CALENDLY,
              ownerUniqIdentifier: owner, // calendly user's unique identifier to access his resources
            },
          },
        },
      });
      console.log("Creating new integration account and linking to user");
    }
    // res.setHeader("Set-Cookie", [
    //   `calendlyAccessToken=${access_token}; HttpOnly; Path=/; Max-Age=${expires_in}; SameSite=Lax`,
    //   `calendlyRefreshToken=${refresh_token}; HttpOnly; Path=/; Max-Age=${expires_in}; SameSite=Lax`,
    // ]);
    return true;
  } catch (error) {
    console.error("Internal Server Error:", String(error));
    return false;
  }
}
