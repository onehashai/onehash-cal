import { assignmentReasonHandler as salesforceAssignmentReasonHandler } from "@calcom/app-store/salesforce/lib/assignmentReasonHandler";
import type { AssignmentReasonEnum } from "@calcom/prisma/enums";

interface CrmHandlerParameters {
  recordType: string;
  teamMemberEmail: string;
  routingFormResponseId: number;
}

interface AssignmentReasonResult {
  assignmentReason: string | undefined;
  reasonEnum: AssignmentReasonEnum;
}

type CrmReasonProcessor = (parameters: CrmHandlerParameters) => Promise<AssignmentReasonResult | undefined>;

const appBookingFormHandler: Record<string, CrmReasonProcessor> = {
  salesforce: salesforceAssignmentReasonHandler,
};

export default appBookingFormHandler;
