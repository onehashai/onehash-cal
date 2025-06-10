import type { FormResponse, Fields } from "@calcom/app-store/routing-forms/types/types";
import { zodRoutes } from "@calcom/app-store/routing-forms/zod";
import { acrossQueryValueCompatiblity } from "@calcom/lib/raqb/raqbUtils";
import { getUsersAttributes } from "@calcom/lib/service/attribute/server/getAttributes";
import prisma from "@calcom/prisma";
import { AssignmentReasonEnum } from "@calcom/prisma/enums";

const { getAttributesQueryValue } = acrossQueryValueCompatiblity;

export default class AssignmentReasonRecorder {
  static async routingFormRoute(parameters: {
    bookingId: number;
    routingFormResponseId: number;
    organizerId: number;
    teamId: number;
  }): Promise<void> {
    const { bookingId, routingFormResponseId, organizerId, teamId } = parameters;

    const formResponseData = await this.fetchRoutingFormData(routingFormResponseId);
    if (!formResponseData) return;

    const selectedRoute = await this.determineSelectedRoute(formResponseData);
    if (!selectedRoute) return;

    const memberAttributes = await getUsersAttributes({ userId: organizerId, teamId });

    const attributeFilterData = this.extractAttributeQuery(selectedRoute);
    if (!attributeFilterData) return;

    const processedAttributes = this.processAttributeQuery({
      formAttributesQuery: attributeFilterData,
      userAttributes: memberAttributes,
      formData: formResponseData,
    });

    if (!processedAttributes?.children1) return;

    const attributeDescriptions = this.buildAttributeDescriptions(
      processedAttributes.children1,
      memberAttributes
    );

    await this.persistRoutingReason(bookingId, attributeDescriptions);
  }

  private static async fetchRoutingFormData(responseId: number) {
    return await prisma.app_RoutingForms_FormResponse.findFirst({
      where: { id: responseId },
      include: {
        form: {
          select: {
            routes: true,
            fields: true,
          },
        },
      },
    });
  }

  private static async determineSelectedRoute(responseData: any) {
    const { form } = responseData;
    if (!form.routes || !form.fields) return null;

    const validatedRoutes = zodRoutes.safeParse(form.routes);
    if (!validatedRoutes.success || !validatedRoutes.data) return null;

    const selectedRouteId = responseData.chosenRouteId;
    return validatedRoutes.data.find((route) => route.id === selectedRouteId);
  }

  private static extractAttributeQuery(route: any) {
    return "attributesQueryValue" in route ? route.attributesQueryValue : null;
  }

  private static processAttributeQuery({
    formAttributesQuery,
    userAttributes,
    formData,
  }: {
    formAttributesQuery: any;
    userAttributes: any[];
    formData: any;
  }) {
    return getAttributesQueryValue({
      attributesQueryValue: formAttributesQuery,
      attributes: userAttributes,
      dynamicFieldValueOperands: {
        fields: (formData.form.fields as Fields) || [],
        response: formData.response as FormResponse,
      },
    });
  }

  private static buildAttributeDescriptions(
    attributeFilters: Record<string, any>,
    userAttributes: any[]
  ): string[] {
    const descriptions: string[] = [];

    Object.keys(attributeFilters).forEach((key) => {
      const filterProperties = attributeFilters[key].properties;
      if (!filterProperties) return;

      const matchingAttribute = userAttributes.find((attr) => filterProperties.field === attr.id);

      const filterValue = filterProperties.value;
      if (!matchingAttribute || !filterValue || typeof filterValue[0] === null) return;

      if (filterValue?.[0]) {
        const valueString = Array.isArray(filterValue[0]) ? filterValue[0][0] : filterValue[0];

        descriptions.push(`${matchingAttribute?.name}: ${valueString}`);
      }
    });

    return descriptions;
  }

  private static async persistRoutingReason(bookingId: number, attributeDescriptions: string[]) {
    await prisma.assignmentReason.create({
      data: {
        bookingId,
        reasonEnum: AssignmentReasonEnum.ROUTING_FORM_ROUTING,
        reasonString: attributeDescriptions.join(", "),
      },
    });
  }

  static async CRMOwnership(config: {
    bookingId: number;
    crmAppSlug: string;
    teamMemberEmail: string;
    recordType: string;
    routingFormResponseId: number;
  }): Promise<void> {
    const { bookingId, crmAppSlug, teamMemberEmail, recordType, routingFormResponseId } = config;

    const handlerModule = await import("./appAssignmentReasonHandler");
    const crmHandler = handlerModule.default[crmAppSlug];

    if (!crmHandler) return;

    const ownershipReason = await crmHandler({
      recordType,
      teamMemberEmail,
      routingFormResponseId,
    });

    if (!ownershipReason?.assignmentReason) return;

    await this.saveAssignmentReason({
      bookingId,
      reasonType: ownershipReason.reasonEnum,
      description: ownershipReason.assignmentReason,
    });
  }

  static async roundRobinReassignment(params: {
    bookingId: number;
    reassignById: number;
    reassignReason?: string;
  }): Promise<void> {
    const { bookingId, reassignById, reassignReason } = params;

    const reassignUser = await this.fetchReassignUser(reassignById);
    const reassignmentDescription = this.buildReassignmentDescription(
      reassignUser?.username ?? undefined,
      reassignReason
    );

    await this.saveAssignmentReason({
      bookingId,
      reasonType: AssignmentReasonEnum.REASSIGNED,
      description: reassignmentDescription,
    });
  }

  private static async fetchReassignUser(userId: number) {
    return await prisma.user.findFirst({
      where: { id: userId },
      select: { username: true },
    });
  }

  private static buildReassignmentDescription(username?: string, reason?: string): string {
    const reassignedByText = `Reassigned by: ${username || "team member"}`;
    const reasonText = reason ? `. Reason: ${reason}` : "";
    return `${reassignedByText}${reasonText}`;
  }

  private static async saveAssignmentReason({
    bookingId,
    reasonType,
    description,
  }: {
    bookingId: number;
    reasonType: AssignmentReasonEnum;
    description: string;
  }) {
    await prisma.assignmentReason.create({
      data: {
        bookingId,
        reasonEnum: reasonType,
        reasonString: description,
      },
    });
  }
}
