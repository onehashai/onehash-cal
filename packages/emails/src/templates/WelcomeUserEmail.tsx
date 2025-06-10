import { APP_NAME, SUPPORT_MAIL_ADDRESS, WEBAPP_URL } from "@calcom/lib/constants";

import { BaseEmailHtml, CallToAction } from "../components";

export type WelcomeEmailProps = {
  user: {
    name?: string | null;
    email: string;
  };
};

export const WelcomeUserEmail = (
  props: WelcomeEmailProps & Partial<React.ComponentProps<typeof BaseEmailHtml>>
) => {
  return (
    <BaseEmailHtml subject="Welcome to Our Platform">
      <p>
        <>Hello {props.user.name || "there"}!</>
      </p>
      <p style={{ fontWeight: 400, lineHeight: "24px" }}>
        <>Welcome to {APP_NAME} your go-to platform for effortless event scheduling.</>
      </p>
      <CallToAction label="Start Scheduling Events" href={WEBAPP_URL} />
      <div style={{ lineHeight: "6px" }}>
        <p style={{ fontWeight: 400, lineHeight: "24px" }}>
          <>
            If you have any questions, feel free to{" "}
            <a
              href={`mailto:${SUPPORT_MAIL_ADDRESS}`}
              style={{ color: "#3E3E3E" }}
              target="_blank"
              rel="noreferrer">
              contact our support team
            </a>
            .
          </>
        </p>
      </div>
    </BaseEmailHtml>
  );
};
