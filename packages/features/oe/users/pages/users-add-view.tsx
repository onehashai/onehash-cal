"use client";

import { usePathname, useRouter } from "next/navigation";

import { getParserWithGeneric } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui";

import LicenseRequired from "../../common/components/LicenseRequired";
import { UserForm } from "../components/UserForm";
import { userBodySchema } from "../schemas/userBodySchema";

const CreateUserPage = () => {
  const currentPath = usePathname();
  const navigationRouter = useRouter();
  const trpcUtilities = trpc.useUtils();

  const userCreationMutation = trpc.viewer.users.add.useMutation({
    onSuccess: async () => {
      showToast("User added successfully", "success");
      await trpcUtilities.viewer.users.list.invalidate();

      if (currentPath !== null) {
        navigationRouter.replace(currentPath.replace("/add", ""));
      }
    },
    onError: (error) => {
      console.error(error.message);
      showToast("There has been an error adding this user.", "error");
    },
  });

  const handleFormSubmission = async (formData: any) => {
    const schemaParser = getParserWithGeneric(userBodySchema);
    const validatedData = schemaParser(formData) as {
      email: string;
      timeZone: string;
      weekStart: string;
      identityProvider: "CAL" | "GOOGLE" | "SAML" | "KEYCLOAK";
      role: "USER" | "ADMIN";
      locale?: string | null;
      allowDynamicBooking?: boolean;
      timeFormat?: number;
    };
    userCreationMutation.mutate(validatedData);
  };

  const renderUserCreationForm = () => <UserForm submitLabel="Add user" onSubmit={handleFormSubmission} />;

  return (
    <div>
      <LicenseRequired>{renderUserCreationForm()}</LicenseRequired>
    </div>
  );
};

export default CreateUserPage;
