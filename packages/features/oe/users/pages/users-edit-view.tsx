"use client";

import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";

import NoSSR from "@calcom/core/components/NoSSR";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { getParserWithGeneric } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui";

import LicenseRequired from "../../common/components/LicenseRequired";
import { UserForm } from "../components/UserForm";
import { userBodySchema } from "../schemas/userBodySchema";
import type { UserManagementRouterOutputs } from "../server/trpc-router";

type User = UserManagementRouterOutputs["get"]["user"];
const idValidationSchema = z.object({ id: z.coerce.number() });

const EditUserPage = () => {
  const routeParams = useParamsWithFallback();
  const validatedInput = idValidationSchema.safeParse(routeParams);

  if (!validatedInput.success) return <div>Invalid input</div>;

  const [queryResult] = trpc.viewer.users.get.useSuspenseQuery({ userId: validatedInput.data.id });
  const { user: userData } = queryResult;

  return (
    <LicenseRequired>
      <NoSSR>
        <UsersEditView user={userData} />
      </NoSSR>
    </LicenseRequired>
  );
};

export const UsersEditView = ({ user: selectedUser }: { user: User }) => {
  const currentPath = usePathname();
  const navigationRouter = useRouter();

  const trpcUtilities = trpc.useUtils();
  const updateUserMutation = trpc.viewer.users.update.useMutation({
    onSuccess: async () => {
      Promise.all([
        trpcUtilities.viewer.users.list.invalidate(),
        trpcUtilities.viewer.users.get.invalidate(),
      ]);
      showToast("User updated successfully", "success");
      navigationRouter.replace(`${currentPath?.split("/users/")[0]}/users`);
    },
    onError: (error) => {
      console.error(error.message);
      showToast("There has been an error updating this user.", "error");
    },
  });

  return (
    <UserForm
      key={JSON.stringify(selectedUser)}
      onSubmit={(values) => {
        const parser = getParserWithGeneric(userBodySchema);
        const parsedValues = parser(values);
        const data: Partial<typeof parsedValues & { userId: number }> = {
          ...parsedValues,
          userId: selectedUser.id,
        };
        if (selectedUser.username === data.username) delete data.username;
        updateUserMutation.mutate(data);
      }}
      defaultValues={selectedUser}
    />
  );
};

export default UsersEditView;
