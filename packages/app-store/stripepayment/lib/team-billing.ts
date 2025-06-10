import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export function getRequestedSlugError(error: unknown, requestedSlug: string) {
  let message = `Unknown error`;
  let statusCode = 500;
  // This covers the edge case if an unpublished team takes too long to publish
  // and another team gets the requestedSlug first.
  // https://www.prisma.io/docs/reference/api-reference/error-reference#p2002
  if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
    statusCode = 400;
    message = `It seems like the requestedSlug: '${requestedSlug}' is already taken. Please contact support at support@onehash.ai so we can resolve this issue.`;
  } else if (error instanceof Error) {
    message = error.message;
  }
  return { message, statusCode };
}
