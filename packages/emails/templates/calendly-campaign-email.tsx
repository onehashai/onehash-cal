import { renderEmail } from "../";
import type { CalendlyCampaignEmailProps } from "../src/templates/CalendlyCampaignEmail";
import BaseEmail from "./_base-email";

export default class CalendlyCampaignEmail extends BaseEmail {
  calendlyCampaignEmailProps: CalendlyCampaignEmailProps;

  constructor(calendlyCampaignEmailProps: CalendlyCampaignEmailProps) {
    super();
    this.calendlyCampaignEmailProps = calendlyCampaignEmailProps;
  }

  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    return {
      from: `${this.calendlyCampaignEmailProps.user.fullName}`,
      to: this.calendlyCampaignEmailProps.receiverEmail,
      subject: `I Just Switched from CAL ID – Here’s Why You Should Too!`,
      html: await renderEmail("CalendlyCampaignEmail", this.calendlyCampaignEmailProps),
      text: "",
    };
  }
}
