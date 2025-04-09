import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getOrgFullOrigin } from "@calcom/features/oe/organizations/lib/orgDomains";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import { HeadSeo } from "@calcom/ui";

import UserPage from "./users-public-view";

vi.mock("@calcom/ui", () => ({
  HeadSeo: vi.fn(),
  Button: vi.fn(() => <button>Mocked Button</button>),
}));

vi.mock("@calcom/lib/constants", () => ({
  SIGNUP_URL: "https://mocked-signup-url.com",
}));

function mockedUserPageComponentProps(props: Partial<React.ComponentProps<typeof UserPage>["userFound"]>) {
  return {
    userFound: {
      trpcState: {
        mutations: [],
        queries: [],
      },
      themeBasis: "dark",
      safeBio: "My Bio",
      profile: {
        name: "John Doe",
        image: "john-profile-url",
        theme: "dark",
        brandColor: "red",
        darkBrandColor: "black",
        organization: { requestedSlug: "slug", slug: "slug", id: 1 },
        allowSEOIndexing: true,
        username: "john",
      },
      users: [
        {
          name: "John Doe",
          username: "john",
          avatarUrl: "john-user-url",
          bio: "",
          verified: false,
          profile: {
            upId: "1",
            id: 1,
            username: "john",
            organizationId: null,
            organization: null,
          },
        },
      ],
      markdownStrippedBio: "My Bio",
      entity: props?.entity ?? {
        considerUnpublished: false,
        orgSlug: "default-org-slug",
      },
      eventTypes: [],
      isOrgSEOIndexable: false,
      hideBranding: false,
      bannerUrl: null,
      faviconUrl: null,
    },
  } satisfies React.ComponentProps<typeof UserPage>;
}

describe("UserPage Component", () => {
  it("should render HeadSeo with correct props", () => {
    const mockData = {
      props: mockedUserPageComponentProps({
        entity: {
          considerUnpublished: false,
          orgSlug: "org1",
        },
      }),
    };

    vi.mocked(getOrgFullOrigin).mockReturnValue("org1.cal.local");

    vi.mocked(useRouterQuery).mockReturnValue({
      uid: "uid",
    });

    render(<UserPage {...mockData.props} />);

    const expectedDescription = "Default description";
    const expectedTitle = expectedDescription;
    expect(HeadSeo).toHaveBeenCalledWith(
      {
        origin: `${mockData.props.userFound.entity.orgSlug}.cal.local`,
        title: "Oops no one's here",
        description: "Register and claim this Cal ID username before it's gone!",
        nextSeoProps: {
          nofollow: true,
          noindex: true,
        },
      },
      {}
    );
  });
});
