import { v4 as uuidv4 } from "uuid";

import { prisma } from "@calcom/prisma";

export const uploadAvatar = async ({ userId, avatar: data }: { userId: number; avatar: string }) => {
  const objectKey = uuidv4();

  await prisma.avatar.upsert({
    where: {
      teamId_userId_isBanner_isFavicon: {
        teamId: 0,
        userId,
        isBanner: false,
        isFavicon: false,
      },
    },
    create: {
      userId: userId,
      data,
      objectKey,
      isBanner: false,
      isFavicon: false,
    },
    update: {
      data,
      objectKey,
    },
  });

  return `/api/avatar/${objectKey}.png`;
};

export const uploadLogo = async ({
  userId,
  teamId,
  logo: data,
  isBanner = false,
  isFavicon = false,
}: {
  userId?: number;
  teamId?: number;
  logo: string;
  isBanner?: boolean;
  isFavicon?: boolean;
}): Promise<string | null> => {
  if (data === "delete") {
    await prisma.avatar.deleteMany({
      where: {
        teamId: teamId ?? 0,
        userId: userId ?? 0,
        isBanner,
        isFavicon,
      },
    });
    return null;
  } else {
    const objectKey = uuidv4();

    await prisma.avatar.upsert({
      where: {
        teamId_userId_isBanner_isFavicon: {
          teamId: teamId ?? 0,
          userId: userId ?? 0,
          isBanner,
          isFavicon,
        },
      },
      create: {
        teamId: teamId ?? 0,
        userId: userId ?? 0,
        data,
        objectKey,
        isBanner,
        isFavicon,
      },
      update: {
        data,
        objectKey,
      },
    });

    return `/api/avatar/${objectKey}.png`;
  }
};

// export const uploadBrandingLogo = async ({
//   userId,
//   teamId,
//   logo: data,
// }: {
//   userId?: number;
//   teamId?: number;
//   logo: string;
// }): Promise<string | null> => {
//   if (data === "delete") {
//     await prisma.avatar.deleteMany({
//       where: {
//         teamId: teamId ?? 0,
//         userId: userId ?? 0,
//         isBanner: true,
//       },
//     });
//     return null;
//   } else {
//     const objectKey = uuidv4();
//     await prisma.avatar.upsert({
//       where: {
//         teamId_userId_isBanner_isFavicon: {
//           teamId: teamId ?? 0,
//           userId: userId ?? 0,
//           isBanner: true,
//           isFavicon: false,
//         },
//       },
//       create: {
//         userId: userId ?? 0,
//         teamId: teamId ?? 0,
//         data,
//         objectKey,
//         isBanner: true,
//       },
//       update: {
//         data,
//         objectKey,
//       },
//     });

//     return `/api/avatar/${objectKey}.png`;
//   }
// };

// export const uploadFaviconLogo = async ({
//   userId,
//   teamId,
//   logo: data,
// }: {
//   userId?: number;
//   teamId?: number;
//   logo: string;
// }): Promise<string | null> => {
//   if (data === "delete") {
//     await prisma.avatar.deleteMany({
//       where: {
//         teamId: teamId ?? 0,
//         userId: userId ?? 0,
//         isBanner: false,
//         isFavicon: true,
//       },
//     });
//     return null;
//   } else {
//     const objectKey = uuidv4();
//     await prisma.avatar.upsert({
//       where: {
//         teamId_userId_isBanner_isFavicon: {
//           teamId: teamId ?? 0,
//           userId: userId ?? 0,
//           isFavicon: true,
//           isBanner: false,
//         },
//       },
//       create: {
//         userId: userId ?? 0,
//         teamId: teamId ?? 0,
//         data,
//         objectKey,
//         isFavicon: true,
//       },
//       update: {
//         data,
//         objectKey,
//       },
//     });

//     return `/api/avatar/${objectKey}.png`;
//   }
// };
