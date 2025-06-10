import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import slugify from "@calcom/lib/slugify";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { Alert, Button, DialogFooter, Form, TextField } from "@calcom/ui";

import { useOrgBranding } from "../../organizations/context/provider";
import { subdomainSuffix } from "../../organizations/lib/orgDomains";
import type { NewTeamFormValues } from "../lib/types";

interface TeamCreationFormProps {
  onCancel: () => void;
  submitLabel: string;
  onSuccess: (data: RouterOutputs["viewer"]["teams"]["create"]) => void;
  inDialog?: boolean;
  slug?: string;
}

export const CreateANewTeamForm = (formProps: TeamCreationFormProps) => {
  const {
    inDialog: isModalView,
    onCancel: handleCancel,
    slug: initialSlug,
    submitLabel: buttonText,
    onSuccess: handleSuccess,
  } = formProps;
  const { t, isLocaleReady: localeLoaded } = useLocale();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const brandingConfiguration = useOrgBranding();

  const teamFormController = useForm<NewTeamFormValues>({
    defaultValues: {
      slug: initialSlug,
    },
  });

  const teamCreationMutation = trpc.viewer.teams.create.useMutation({
    onSuccess: (result) => handleSuccess(result),
    onError: (error) => {
      if (error.message === "team_url_taken") {
        teamFormController.setError("slug", { type: "custom", message: t("url_taken") });
      } else {
        setErrorMessage(error.message);
      }
    },
  });

  const ActionButtons = () => (
    <>
      <Button
        disabled={teamCreationMutation.isPending}
        color="secondary"
        onClick={handleCancel}
        className="w-full justify-center">
        {t("cancel")}
      </Button>
      <Button
        disabled={teamFormController.formState.isSubmitting || teamCreationMutation.isPending}
        color="primary"
        EndIcon="arrow-right"
        type="submit"
        className="w-full justify-center"
        data-testid="continue-button">
        {t(buttonText)}
      </Button>
    </>
  );

  return (
    <>
      <Form
        form={teamFormController}
        handleSubmit={(formValues) => {
          if (!teamCreationMutation.isPending) {
            setErrorMessage(null);
            teamCreationMutation.mutate(formValues);
          }
        }}>
        <div className="mb-8">
          {errorMessage && (
            <div className="mb-4">
              <Alert severity="error" message={t(errorMessage)} />
            </div>
          )}

          <Controller
            name="name"
            control={teamFormController.control}
            defaultValue=""
            rules={{
              required: t("must_enter_team_name"),
            }}
            render={({ field: { value: fieldValue } }) => (
              <>
                <TextField
                  disabled={!localeLoaded || teamCreationMutation.isPending}
                  className="mt-2"
                  placeholder="Acme Inc."
                  name="name"
                  label={t("team_name")}
                  defaultValue={fieldValue}
                  onChange={(event) => {
                    teamFormController.setValue("name", event?.target.value);
                    if (teamFormController.formState.touchedFields["slug"] === undefined) {
                      teamFormController.setValue("slug", slugify(event?.target.value));
                    }
                  }}
                  autoComplete="off"
                  data-testid="team-name"
                />
              </>
            )}
          />
        </div>

        <div className="mb-8">
          <Controller
            name="slug"
            control={teamFormController.control}
            rules={{ required: t("team_url_required") }}
            render={({ field: { value: slugValue } }) => (
              <TextField
                className="mt-2"
                name="slug"
                placeholder="acme"
                label={t("team_url")}
                addOnLeading={`${
                  brandingConfiguration
                    ? `${brandingConfiguration.fullDomain.replace("https://", "").replace("http://", "")}/`
                    : `${subdomainSuffix()}/team/`
                }`}
                value={slugValue}
                defaultValue={slugValue}
                onChange={(inputEvent) => {
                  teamFormController.setValue("slug", slugify(inputEvent?.target.value, true), {
                    shouldTouch: true,
                  });
                  teamFormController.clearErrors("slug");
                }}
              />
            )}
          />
        </div>

        {isModalView ? (
          <DialogFooter>
            <div className="flex space-x-2 rtl:space-x-reverse">
              <ActionButtons />
            </div>
          </DialogFooter>
        ) : (
          <div className="flex space-x-2 rtl:space-x-reverse">
            <ActionButtons />
          </div>
        )}
      </Form>
    </>
  );
};
