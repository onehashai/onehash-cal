import type { TFunction } from "next-i18next";

import { DYNAMIC_TEXT_VARIABLES, FORMATTED_DYNAMIC_TEXT_VARIABLES } from "./constants";

export function getTranslatedText(
  inputText: string,
  languageConfig: { locale: string; t: TFunction }
): string {
  const { locale, t } = languageConfig;

  if (locale === "en") {
    return inputText;
  }

  const extractedVariables = extractVariableTokens(inputText);

  return extractedVariables.reduce((processedText, currentVariable) => {
    const variablePattern = createVariableRegex(currentVariable);
    const transformedVariable = processVariableTranslation(currentVariable, t);
    return processedText.replace(variablePattern, `{${transformedVariable}}`);
  }, inputText);
}

export function translateVariablesToEnglish(
  inputText: string,
  languageConfig: { locale: string; t: TFunction }
): string {
  const { locale, t } = languageConfig;

  if (locale === "en") {
    return inputText;
  }

  const extractedVariables = extractVariableTokens(inputText);

  return extractedVariables.reduce((processedText, currentVariable) => {
    const englishEquivalent = findEnglishVariableEquivalent(currentVariable, t);
    return englishEquivalent ? processedText.replace(currentVariable, englishEquivalent) : processedText;
  }, inputText);
}

function extractVariableTokens(textContent: string): string[] {
  const variableMatches = textContent.match(/\{(.+?)}/g);
  return variableMatches?.map((match) => match.slice(1, -1)) ?? [];
}

function createVariableRegex(variableName: string): RegExp {
  return new RegExp(`{${variableName}}`, "g");
}

function processVariableTranslation(originalVariable: string, translationFunction: TFunction): string {
  const lowerCaseVariable = originalVariable.toLowerCase();

  if (DYNAMIC_TEXT_VARIABLES.includes(lowerCaseVariable)) {
    return generateTranslatedVariableName(lowerCaseVariable, translationFunction);
  }

  const legacyVariableName = `${lowerCaseVariable}_name`;
  if (DYNAMIC_TEXT_VARIABLES.includes(legacyVariableName)) {
    return generateLegacyTranslatedVariableName(lowerCaseVariable, translationFunction);
  }

  const formattedVariableResult = processFormattedVariable(originalVariable, translationFunction);
  return formattedVariableResult || originalVariable;
}

function generateTranslatedVariableName(baseVariable: string, translationFunction: TFunction): string {
  const translationKey = `${baseVariable}_variable`;
  return normalizeTranslatedText(translationFunction(translationKey));
}

function generateLegacyTranslatedVariableName(baseVariable: string, translationFunction: TFunction): string {
  const legacyTranslationKey = `${baseVariable}_name_variable`;
  return normalizeTranslatedText(translationFunction(legacyTranslationKey));
}

function processFormattedVariable(variableToken: string, translationFunction: TFunction): string | null {
  const matchingFormattedVariable = FORMATTED_DYNAMIC_TEXT_VARIABLES.find((formattedVar) =>
    variableToken.toLowerCase().startsWith(formattedVar)
  );

  if (!matchingFormattedVariable) {
    return null;
  }

  const separatorIndex = matchingFormattedVariable.lastIndexOf("_");
  const baseVariableName = `${matchingFormattedVariable.substring(0, separatorIndex).toLowerCase()}_variable`;
  const formatSuffix = matchingFormattedVariable.substring(separatorIndex);

  const translatedBaseName = normalizeTranslatedText(translationFunction(baseVariableName));
  return `${translatedBaseName}${formatSuffix}`;
}

function normalizeTranslatedText(translatedContent: string): string {
  return translatedContent.replace(/ /g, "_").toLocaleUpperCase();
}

function findEnglishVariableEquivalent(
  translatedVariable: string,
  translationFunction: TFunction
): string | null {
  const normalizedVariable = translatedVariable.replace("_NAME", "");

  for (const baseVariable of DYNAMIC_TEXT_VARIABLES) {
    const variableTranslationKey = `${baseVariable}_variable`;
    const normalizedTranslation = normalizeTranslatedText(translationFunction(variableTranslationKey));

    const isDirectMatch = normalizedTranslation === translatedVariable;
    const isNameVariantMatch = normalizedTranslation === normalizedVariable;

    if (isDirectMatch || isNameVariantMatch) {
      return normalizeTranslatedText(translationFunction(variableTranslationKey, { lng: "en" }));
    }
  }

  for (const formattedVariable of FORMATTED_DYNAMIC_TEXT_VARIABLES) {
    const formattedTranslationKey = `${formattedVariable}variable`;
    const normalizedFormattedTranslation = normalizeTranslatedText(
      translationFunction(formattedTranslationKey)
    );

    if (translatedVariable.startsWith(normalizedFormattedTranslation)) {
      const englishPrefix = formattedVariable.slice(0, -1).toUpperCase();
      return translatedVariable.replace(normalizedFormattedTranslation, englishPrefix);
    }
  }

  return null;
}
