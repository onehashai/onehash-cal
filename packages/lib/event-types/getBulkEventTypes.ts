import { JitsiLocationType } from "@calcom/app-store/locations";
import { getAppFromLocationValue } from "@calcom/app-store/utils";
import { prisma } from "@calcom/prisma";
import { eventTypeLocations as eventTypeLocationsSchema } from "@calcom/prisma/zod-utils";

const getBulkEventTypes = async (userId: number) => {
  const eventTypes = await prisma.eventType.findMany({
    where: {
      userId,
      team: null,
    },
    select: {
      id: true,
      title: true,
      locations: true,
    },
  });

  const eventTypesWithLogo = eventTypes.map((eventType) => {
    const locationParsed = eventTypeLocationsSchema.safeParse(eventType.locations);

    //CHANGE:JITSI
    // // some events has null as location for legacy reasons, so this fallbacks to daily video
    // const app = getAppFromLocationValue(
    //   locationParsed.success && locationParsed.data?.[0]?.type
    //     ? locationParsed.data[0].type
    //     : "integrations:daily"
    // );
    // some events has null as location for legacy reasons, so this fallbacks to jitsi video
    const app = getAppFromLocationValue(
      locationParsed.success && locationParsed.data?.[0]?.type
        ? locationParsed.data[0].type
        : JitsiLocationType
    );
    return {
      ...eventType,
      logo: app?.logo,
    };
  });

  return {
    eventTypes: eventTypesWithLogo,
  };
};

export default getBulkEventTypes;
