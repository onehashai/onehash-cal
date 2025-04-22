import Head from "next/head";

import { Icon, UserAvatar } from "@calcom/ui";

interface Props {
  base64?: string;
  avatarUrl?: string;
  bio?: string;
  name?: string;
  username?: string;
}

const UserFoundUI = ({ base64, avatarUrl, bio, name, username }: Props) => {
  console.log(name, username);
  const user = {
    name: name || "Manas Laud",
    username: username || "manaslaud",
    avatarUrl: avatarUrl || "https://via.placeholder.com/150",
    bio: bio || "This is a sample bio for Manas Laud.",
    verified: true,
    profile: {
      organization: null,
      username: "manaslaud",
      id: "12345",
      organizationId: null,
    },
  };

  const profile = {
    name: name || "Manas Laud",
    username: username || "manaslaud",
    allowSEOIndexing: true,
  };

  const eventTypes = [
    {
      id: 1,
      title: "Sample Event 1",
      slug: "sample-event-1",
      description: "This is a description for Sample Event 1.",
    },
    {
      id: 2,
      title: "Sample Event 2",
      slug: "sample-event-2",
      description: "This is a description for Sample Event 2.",
    },
  ];

  const isEventListEmpty = eventTypes.length === 0;
  const isOrg = !!user.profile.organization;

  return (
    <div className="border-subtle border ">
      <Head>
        <title>{profile.name}</title>
        <link rel="icon" href="https://via.placeholder.com/32" type="image/x-icon" />
      </Head>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-8 text-center">
          <UserAvatar
            size="xl"
            user={{
              avatarUrl: user.avatarUrl,
              profile: { ...user.profile, id: Number(user.profile.id) },
              name: profile.name,
              username: profile.username,
            }}
          />
          <h1 className="font-cal text-emphasis my-1 text-3xl">
            {profile.name}
            {!isOrg && user.verified && (
              <Icon
                name="badge-check"
                className="mx-1 -mt-1 inline h-6 w-6 fill-blue-500 text-white dark:text-black"
              />
            )}
            {isOrg && (
              <Icon
                name="badge-check"
                className="mx-1 -mt-1 inline h-6 w-6 fill-yellow-500 text-white dark:text-black"
              />
            )}
          </h1>
          {user.bio && <div className="text-subtle break-words text-sm">{user.bio}</div>}
        </div>

        <div
          className={`rounded-md ${!isEventListEmpty ? "border-subtle border" : ""}`}
          data-testid="event-types"
        />
        {isEventListEmpty && (
          <div className="text-subtle text-center text-sm">No events available for {profile.name}.</div>
        )}
      </div>
      <div className="mt-12 flex flex-col items-center justify-center gap-4">
        <img
          src="/links-preview/calendar.png"
          alt="Calendar Preview"
          className="rounded-md shadow-md"
          style={{ maxWidth: "100%", height: "auto" }}
        />
        <img src={base64} alt="Org Banner" className="aspect-square w-[64px]" />
      </div>
    </div>
  );
};

export default UserFoundUI;
