import handleDeleteCredential from "@calcom/features/credentials/handleDeleteCredential";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import type { TDeleteCredentialInputSchema } from "./deleteCredential.schema";

type DeleteCredentialOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteCredentialInputSchema;
};

type App = {
  slug: string;
  categories: AppCategories[];
  dirName: string;
} | null;

const isVideoOrConferencingApp = (app: App) =>
  app?.categories.includes(AppCategories.video) || app?.categories.includes(AppCategories.conferencing);

const getRemovedIntegrationNameFromAppSlug = (slug: string) =>
  slug === "msteams" ? "office365_video" : slug.split("-")[0];

const locationsSchema = z.array(z.object({ type: z.string() }));
type TlocationsSchema = z.infer<typeof locationsSchema>;

export const deleteCredentialHandler = async ({ ctx, input }: DeleteCredentialOptions) => {
  const { user } = ctx;
  const { id, teamId } = input;

  await handleDeleteCredential({ userId: user.id, userMetadata: user.metadata, credentialId: id, teamId });
};

const removeAppFromEventTypeMetadata = (
  appSlugToDelete: string,
  eventTypeMetadata: z.infer<typeof EventTypeMetaDataSchema>
) => {
  const appMetadata = eventTypeMetadata?.apps
    ? Object.entries(eventTypeMetadata.apps).reduce((filteredApps, [appName, appData]) => {
        if (appName !== appSlugToDelete) {
          filteredApps[appName as keyof typeof eventTypeMetadata.apps] = appData;
        }
        return filteredApps;
      }, {} as z.infer<typeof EventTypeAppMetadataSchema>)
    : {};

  return appMetadata;
};
