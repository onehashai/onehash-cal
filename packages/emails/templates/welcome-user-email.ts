import { APP_NAME } from "@calcom/lib/constants";

import { renderEmail } from "../";
import type { WelcomeEmailProps } from "../src/templates/WelcomeUserEmail";
import BaseEmail from "./_base-email";

export default class WelcomeUserEmail extends BaseEmail {
  userData: WelcomeEmailProps;

  constructor(userData: WelcomeEmailProps) {
    super();
    this.userData = userData;
  }

  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    return {
      from: `${APP_NAME} <${this.getMailerOptions().from}>`,
      to: this.userData.user.email,
      subject: `${APP_NAME}: Welcome onboard`,
      html: await renderEmail("WelcomeUserEmail", this.userData),
      text: "",
    };
  }
}
