import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import dayjs from "@calcom/dayjs";
import { useTimePreferences } from "@calcom/features/bookings/lib";
import { FULL_NAME_LENGTH_MAX_LIMIT } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import type { TCreateInputSchema } from "@calcom/trpc/server/routers/viewer/eventTypes/create.schema";
import { Button, TimezoneSelect, Input, Select } from "@calcom/ui";
import { ArrowRight } from "@calcom/ui/components/icon";

import { UsernameAvailabilityField } from "@components/ui/UsernameAvailability";

interface IUserSettingsProps {
  nextStep: () => void;
  hideUsername?: boolean;
}

type TProfessionTypeAndEventTypes = {
  [key: string]: TCreateInputSchema[];
};
const ProfessionTypeAndEventTypes: TProfessionTypeAndEventTypes = {
  recruiter: [
    {
      title: "intitial_screening",
      slug: "intitial_screening",
      description: "intitial_screening_meeting_description",
      length: [15, 30],
    },
    {
      title: "collaborative_evaluation",
      slug: "collaborative_evaluation",
      description: "collaborative_evaluation_meeting_description",
      length: [30, 45],
    },
    {
      title: "offer_dicussion",
      slug: "offer_dicussion",
      description: "offer_dicussion_meeting_description",
      length: [15, 30],
    },
    {
      title: "campus_relations",
      slug: "campus_relations",
      description: "campus_relations_meeting_description",
      length: [30, 45],
    },
    {
      title: "staffing_and_consultants",
      slug: "staffing_and_consultants",
      description: "staffing_and_consultants_meeting_description",
      length: [15, 30, 45],
    },
    {
      title: "everything_else",
      slug: "everything_else",
      description: "everything_else_recruiter_meeting_description",
      length: [15, 30],
    },
  ],
  sales: [
    {
      title: "discovery_call",
      slug: "discovery_call",
      description: "discovery_call_meeting_description",
      length: [15, 30],
    },
    {
      title: "product_demo",
      slug: "product_demo",
      description: "product_demo_meeting_description",
      length: [30, 45],
    },
    {
      title: "proposal_review",
      slug: "proposal_review",
      description: "proposal_review_meeting_description",
      length: [30, 45],
    },
    {
      title: "account_checkin",
      slug: "account_checkin",
      description: "account_checkin_meeting_description",
      length: [15, 30],
    },
    {
      title: "everything_else",
      slug: "everything_else",
      description: "everything_else_sales_meeting_description",
      length: [15, 30],
    },
  ],
  founder: [
    {
      title: "interview",
      slug: "interview",
      description: "interview_meeting_description",
      length: [15, 30],
    },
    {
      title: "partnership",
      slug: "partnership",
      length: [15, 30],
      description: "partnership_meeting_description",
    },
    {
      title: "raise_funding",
      slug: "raise_funding",
      description: "raise_funding_meeting_description",
      length: [30, 45],
    },
    {
      title: "product_walkthrough",
      slug: "product_walkthrough",
      description: "product_walkthrough_meeting_description",
      length: [15, 30],
    },
    {
      title: "connect_with_founder",
      slug: "connect_with_founder",
      description: "connect_with_founder_meeting_description",
      length: [15, 30],
    },
  ],
  freelancer: [
    {
      title: "project_briefing",
      slug: "project_briefing",
      description: "project_briefing_meeting_description",
      length: [15, 30],
    },
    {
      title: "technical_consultation",
      slug: "technical_consultation",
      description: "technical_consultation_meeting_description",
      length: [30, 45],
    },
    {
      title: "creative_collaration",
      slug: "creative_collaration",
      description: "creative_collaration_meeting_description",
      length: [30, 60],
    },
    {
      title: "portfolio_showcase",
      slug: "portfolio_showcase",
      description: "portfolio_showcase_meeting_description",
      length: [15, 30],
    },
    {
      title: "skillset_expansion",
      slug: "skillset_expansion",
      description: "skillset_expansion_meeting_description",
      length: [30, 45],
    },
    {
      title: "everything_else",
      slug: "everything_else",
      description: "everything_else_freelancer_meeting_description",
      length: [30, 45],
    },
  ],
  education: [
    {
      title: "introductory_call",
      slug: "introductory_call",
      description: "introductory_call_meeting_description",
      length: [15, 30],
    },
    {
      title: "group_session",
      slug: "group_session",
      description: "group_session_meeting_description",
      length: [30, 60],
    },
    {
      title: "skills_workshop",
      slug: "skills_workshop",
      description: "skills_workshop_meeting_description",
      length: [30, 45, 60],
    },
    {
      title: "one_on_one_coaching",
      slug: "one_on_one_coaching",
      description: "one_on_one_coaching_meeting_description",
      length: [30, 45, 60],
    },
    {
      title: "mocktest_and_feedback",
      slug: "mocktest_and_feedback",
      description: "mocktest_and_feedback_meeting_description",
      length: [45, 60],
    },
    {
      title: "career_counselling",
      slug: "career_counselling",
      description: "career_counselling_meeting_description",
      length: [45, 60],
    },
    {
      title: "everything_else",
      slug: "everything_else",
      description: "everything_else_education_meeting_description",
      length: [15, 30],
    },
  ],
  health: [
    {
      title: "intial_consultation",
      slug: "intial_consultation",
      description: "intial_consultation_meeting_description",
      length: [15, 30],
    },
    {
      title: "yoga_session",
      slug: "yoga_session",
      description: "yoga_session_meeting_description",
      length: [30, 45, 60],
    },
    {
      title: "fitness_coaching",
      slug: "fitness_coaching",
      description: "fitness_coaching_meeting_description",
      length: [30, 45, 60],
    },
    {
      title: "nutrition_planning",
      slug: "nutrition_planning",
      description: "nutrition_planning_meeting_description",
      length: [30, 45],
    },
    {
      title: "mental_health_consultation",
      slug: "mental_health_consultation",
      description: "mental_health_consultation_meeting_description",
      length: [30, 45],
    },
    {
      title: "followup_appointment",
      slug: "followup_appointment",
      description: "followup_appointment_meeting_description",
      length: [15, 30],
    },
    {
      title: "holistic_wellness",
      slug: "holistic_wellness",
      description: "holistic_wellness_meeting_description",
      length: [30, 45],
    },
    {
      title: "everything_else",
      slug: "everything_else",
      description: "everything_else_health_meeting_description",
      length: [15, 30],
    },
  ],
  others: [
    { title: "15min_meeting", slug: "15min", length: [15] },
    {
      title: "30min_meeting",
      slug: "30min",
      length: [30],
    },
    {
      title: "secret_meeting",
      slug: "secret",
      length: [15],
      hidden: true,
    },
  ],
};
const UserSettings = (props: IUserSettingsProps) => {
  const { nextStep } = props;
  const [user] = trpc.viewer.me.useSuspenseQuery();
  const { t } = useLocale();
  const { setTimezone: setSelectedTimeZone, timezone: selectedTimeZone } = useTimePreferences();
  const telemetry = useTelemetry();
  const userSettingsSchema = z.object({
    name: z
      .string()
      .min(1)
      .max(FULL_NAME_LENGTH_MAX_LIMIT, {
        message: t("max_limit_allowed_hint", { limit: FULL_NAME_LENGTH_MAX_LIMIT }),
      }),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof userSettingsSchema>>({
    defaultValues: {
      name: user?.name || "",
    },
    reValidateMode: "onChange",
    resolver: zodResolver(userSettingsSchema),
  });

  useEffect(() => {
    telemetry.event(telemetryEventTypes.onboardingStarted);
  }, [telemetry]);

  const utils = trpc.useContext();
  const { data: eventTypes } = trpc.viewer.eventTypes.list.useQuery();

  const createEventType = trpc.viewer.eventTypes.create.useMutation();

  const onSuccess = async () => {
    if (eventTypes?.length === 0) {
      let _selectedBusiness = selectedBusiness;
      if (!_selectedBusiness) _selectedBusiness = "others";
      await Promise.all(
        ProfessionTypeAndEventTypes[_selectedBusiness].map(async (event): Promise<void> => {
          const eventType = {
            ...event,
            title: t(event.title),
            description: t(event.description as string),
            length: (event.length as number[])[0],
            metadata: {
              multipleDuration: event.length as number[],
            },
          };
          return createEventType.mutate(eventType);
        })
      );
    }
    await utils.viewer.me.invalidate();
    nextStep();
  };
  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: onSuccess,
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate({
      name: data.name,
      timeZone: selectedTimeZone,
    });
  });

  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  const designationTypeOptions: {
    value: string;
    label: string;
  }[] = [
    { value: "recruiter", label: t("recruiter") },
    { value: "sales", label: t("sales") },
    { value: "founder", label: t("founder") },
    { value: "freelancer", label: t("freelancer") },
    { value: "education", label: t("education") },
    { value: "health", label: t("health") },
    { value: "others", label: t("others") },
  ];

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-6">
        {/* Username textfield: when not coming from signup */}
        {!props.hideUsername && <UsernameAvailabilityField />}

        {/* Full name textfield */}
        <div className="w-full">
          <label htmlFor="name" className="text-default mb-2 block text-sm font-medium">
            {t("full_name")}
          </label>
          <Input
            {...register("name", {
              required: true,
            })}
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            autoCorrect="off"
          />
          {errors.name && (
            <p data-testid="required" className="py-2 text-xs text-red-500">
              {errors.name.message}
            </p>
          )}
        </div>
        {/* Designation select field */}
        <div className="w-full">
          <label htmlFor="timeZone" className="text-default block text-sm font-medium">
            {t("business_type")}
          </label>

          <Select
            className="mt-2 text-sm capitalize"
            onChange={(input) => {
              if (input) {
                setSelectedBusiness(input.value);
              }
            }}
            options={designationTypeOptions}
          />
        </div>
        {/* Timezone select field */}
        <div className="w-full">
          <label htmlFor="timeZone" className="text-default block text-sm font-medium">
            {t("timezone")}
          </label>

          <TimezoneSelect
            id="timeZone"
            value={selectedTimeZone}
            onChange={({ value }) => setSelectedTimeZone(value)}
            className="mt-2 w-full rounded-md text-sm"
          />

          <p className="text-subtle mt-3 flex flex-row font-sans text-xs leading-tight">
            {t("current_time")} {dayjs().tz(selectedTimeZone).format("LT").toString().toLowerCase()}
          </p>
        </div>
      </div>
      <Button
        type="submit"
        className="mt-8 flex w-full flex-row justify-center bg-blue-500 hover:bg-blue-600"
        disabled={mutation.isPending}>
        {t("next_step_text")}
        <ArrowRight className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </form>
  );
};

export { UserSettings };
