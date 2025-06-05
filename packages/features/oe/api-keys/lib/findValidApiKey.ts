import { hashAPIKey } from "@calcom/features/oe/api-keys/lib/apiKeys";
import prisma from "@calcom/prisma";

const findValidApiKey = async (apiKey: string, appId?: string) => {
  const prefixLength = process.env.API_KEY_PREFIX?.length || 0;
  const keyWithoutPrefix = apiKey.substring(prefixLength);
  const computedHash = hashAPIKey(keyWithoutPrefix);

  const currentTimestamp = new Date(Date.now());

  const authenticatedKey = await prisma.apiKey.findFirst({
    where: {
      hashedKey: computedHash,
      appId,
      OR: [
        {
          expiresAt: {
            gte: currentTimestamp,
          },
        },
        {
          expiresAt: null,
        },
      ],
    },
  });

  return authenticatedKey;
};

export default findValidApiKey;
