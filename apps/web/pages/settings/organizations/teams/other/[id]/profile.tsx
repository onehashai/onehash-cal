import OtherTeamProfileView from "@calcom/features/oe/organizations/pages/settings/other-team-profile-view";

import type { CalPageWrapper } from "@components/PageWrapper";
import PageWrapper from "@components/PageWrapper";

const Page = OtherTeamProfileView as CalPageWrapper;
Page.PageWrapper = PageWrapper;

export default Page;
