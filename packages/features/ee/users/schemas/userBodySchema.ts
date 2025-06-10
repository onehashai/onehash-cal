import { z } from "zod";

import { optionToValueSchema } from "@calcom/prisma/zod-utils";

const userRoleValidation = z.enum(["USER", "ADMIN"]);
const identityProviderValidation = z.enum(["CAL", "GOOGLE", "SAML", "KEYCLOAK"]);
const localeFieldValidation = optionToValueSchema(z.string());
const roleFieldValidation = optionToValueSchema(userRoleValidation);
const weekStartFieldValidation = optionToValueSchema(z.string());
const timeFormatFieldValidation = optionToValueSchema(z.number());
const identityProviderFieldValidation = optionToValueSchema(identityProviderValidation);

export const userDataStructureSchema = z
  .object({
    locale: localeFieldValidation,
    role: roleFieldValidation,
    weekStart: weekStartFieldValidation,
    timeFormat: timeFormatFieldValidation,
    identityProvider: identityProviderFieldValidation,
  })
  .passthrough();

export const userBodySchema = userDataStructureSchema;
