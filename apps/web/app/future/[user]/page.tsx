import { withAppDirSsr } from "app/WithAppDirSsr";
import type { PageProps } from "app/_types";
import { _generateMetadata } from "app/_utils";
import { WithLayout } from "app/layoutHOC";
import { headers, cookies } from "next/headers";

import { getLayout } from "@calcom/features/MainLayoutAppDir";

import { buildLegacyCtx } from "@lib/buildLegacyCtx";

import { getServerSideProps } from "@server/lib/[user]/getServerSideProps";

import type { UserPageProps as LegacyPageProps } from "~/users/views/users-public-view";
import LegacyPage from "~/users/views/users-public-view";

export const generateMetadata = async ({ params, searchParams }: PageProps) => {
  const props = await getData(buildLegacyCtx(headers(), cookies(), params, searchParams));

  if (!props.userFound) {
    return null; // Handle the case where user is not found
  }

  const { profile, markdownStrippedBio } = props.userFound;

  return await _generateMetadata(
    () => profile.name,
    () => markdownStrippedBio
  );
};

const getData = withAppDirSsr<LegacyPageProps>(getServerSideProps);
export default WithLayout({ getLayout, getData, Page: LegacyPage })<"P">;
