// eslint-disable-next-line no-restricted-imports
import { get } from "lodash";
import type { TFunction } from "next-i18next";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type z from "zod";

import type { FormValues } from "@calcom/features/eventtypes/lib/types";
import { classNames } from "@calcom/lib";
import type { Prisma } from "@calcom/prisma/client";
import { SchedulingType } from "@calcom/prisma/enums";
import type { _EventTypeModel } from "@calcom/prisma/zod/eventtype";
import { Badge, Icon, Switch, Tooltip } from "@calcom/ui";

interface FieldToggleConfig {
  simple: boolean;
}

interface LockStateManager {
  fieldState: Record<string, boolean>;
  setFieldState: Dispatch<SetStateAction<Record<string, boolean>>>;
}

interface EventTypeConfig {
  eventType: Pick<z.infer<typeof _EventTypeModel>, "schedulingType" | "userId" | "metadata" | "id">;
  translate: TFunction;
  formMethods: UseFormReturn<FormValues>;
}

type FieldUnlockHandler = (fieldName: string, val: boolean | undefined) => void;

const LockedSwitch = (
  shouldShowSwitch: boolean,
  lockManager: LockStateManager,
  fieldIdentifier: string,
  unlockHandler: FieldUnlockHandler,
  configuration: FieldToggleConfig = { simple: false }
) => {
  if (!shouldShowSwitch) return null;

  const { fieldState, setFieldState } = lockManager;

  return (
    <Switch
      data-testid={`locked-indicator-${fieldIdentifier}`}
      onCheckedChange={(isEnabled) => {
        const updatedState = {
          ...fieldState,
          [fieldIdentifier]: isEnabled,
        };
        setFieldState(updatedState);
        unlockHandler(fieldIdentifier, !isEnabled || undefined);
      }}
      checked={fieldState[fieldIdentifier]}
      small={!configuration.simple}
    />
  );
};

const LockedIndicator = (
  isChildManaged: boolean,
  isParentManaged: boolean,
  lockManager: LockStateManager,
  translator: TFunction,
  fieldIdentifier: string,
  unlockHandler: FieldUnlockHandler,
  configuration: FieldToggleConfig = { simple: false }
) => {
  const { fieldState, setFieldState } = lockManager;
  const lockStatus = fieldState[fieldIdentifier];
  const statusLabel = translator(lockStatus ? "locked" : "unlocked");
  const helpText = translator(
    `${lockStatus ? "locked" : "unlocked"}_fields_${isParentManaged ? "admin" : "member"}_description`
  );

  const shouldRender = isParentManaged || isChildManaged;
  if (!shouldRender) return null;

  return (
    <Tooltip content={<>{helpText}</>}>
      <div className="inline">
        <Badge
          variant={lockStatus ? "gray" : "green"}
          className={classNames(
            "ml-2 transform justify-between gap-1.5 p-1",
            isParentManaged && !configuration.simple && "w-28"
          )}>
          {!configuration.simple && (
            <span className="inline-flex">
              <Icon name={lockStatus ? "lock" : "lock-open"} className="text-subtle h-3 w-3" />
              <span className="ml-1 font-medium">{statusLabel}</span>
            </span>
          )}
          {isParentManaged && (
            <Switch
              data-testid={`locked-indicator-${fieldIdentifier}`}
              onCheckedChange={(isEnabled) => {
                const updatedState = {
                  ...fieldState,
                  [fieldIdentifier]: isEnabled,
                };
                setFieldState(updatedState);
                unlockHandler(fieldIdentifier, !isEnabled || undefined);
              }}
              checked={lockStatus}
              small={!configuration.simple}
            />
          )}
        </Badge>
      </div>
    </Tooltip>
  );
};

const useLockedFieldsManager = ({ eventType, translate, formMethods }: EventTypeConfig) => {
  const { setValue, getValues } = formMethods;
  const [lockStates, setLockStates] = useState<Record<string, boolean>>({});

  const availableUnlocks = eventType.metadata?.managedEventConfig?.unlockedFields ?? {};
  const isManaged = eventType.schedulingType === SchedulingType.MANAGED;
  const isChildOfManaged =
    eventType.metadata?.managedEventConfig !== undefined &&
    eventType.schedulingType !== SchedulingType.MANAGED;

  const modifyUnlockState = (fieldIdentifier: string, newValue: boolean | undefined) => {
    const configPath = "metadata.managedEventConfig.unlockedFields";
    const currentUnlocks = getValues(configPath);

    if (!currentUnlocks) return;

    if (newValue === undefined) {
      delete currentUnlocks[fieldIdentifier as keyof typeof currentUnlocks];
      setValue(configPath, { ...currentUnlocks }, { shouldDirty: true });
    } else {
      const updatedUnlocks = {
        ...currentUnlocks,
        [fieldIdentifier]: newValue,
      };
      setValue(configPath, updatedUnlocks, { shouldDirty: true });
    }
  };

  const determineInitialLockState = (fieldIdentifier: string): boolean => {
    let shouldBeLocked = isManaged || isChildOfManaged;

    if (fieldIdentifier.includes(".")) {
      shouldBeLocked = shouldBeLocked && get(availableUnlocks, fieldIdentifier) === undefined;
    } else {
      const existingUnlocks = getValues("metadata")?.managedEventConfig?.unlockedFields as
        | Record<string, boolean>
        | undefined;
      const fieldIsAccessible = !!existingUnlocks?.[fieldIdentifier];
      shouldBeLocked = shouldBeLocked && !fieldIsAccessible;
    }

    return shouldBeLocked;
  };

  const ensureFieldStateExists = (fieldIdentifier: string) => {
    if (typeof lockStates[fieldIdentifier] === "undefined") {
      const newStates = {
        ...lockStates,
        [fieldIdentifier]: determineInitialLockState(fieldIdentifier),
      };
      setLockStates(newStates);
    }
  };

  const buildLockIndicator = (fieldIdentifier: string, config?: { simple: true }) => {
    ensureFieldStateExists(fieldIdentifier);

    return LockedIndicator(
      isChildOfManaged,
      isManaged,
      { fieldState: lockStates, setFieldState: setLockStates },
      translate,
      fieldIdentifier,
      modifyUnlockState,
      config
    );
  };

  const createLabelWithLock = (fieldIdentifier: string, config?: { simple: true }) => {
    ensureFieldStateExists(fieldIdentifier);

    const currentLockState = lockStates[fieldIdentifier];
    const shouldDisable =
      !isManaged &&
      eventType.metadata?.managedEventConfig !== undefined &&
      availableUnlocks[fieldIdentifier as keyof Omit<Prisma.EventTypeSelect, "id">] === undefined;

    return {
      disabled: shouldDisable,
      LockedIcon: buildLockIndicator(fieldIdentifier, config),
      isLocked: currentLockState,
    };
  };

  const buildToggleSwitch = (fieldIdentifier: string, config: FieldToggleConfig = { simple: false }) => {
    ensureFieldStateExists(fieldIdentifier);

    return () =>
      LockedSwitch(
        isManaged,
        { fieldState: lockStates, setFieldState: setLockStates },
        fieldIdentifier,
        modifyUnlockState,
        config
      );
  };

  const createDisableProperties = (fieldIdentifier: string, config?: { simple: true }) => {
    ensureFieldStateExists(fieldIdentifier);

    const shouldDisable =
      !isManaged &&
      eventType.metadata?.managedEventConfig !== undefined &&
      availableUnlocks[fieldIdentifier as keyof Omit<Prisma.EventTypeSelect, "id">] === undefined;

    return {
      disabled: shouldDisable,
      LockedIcon: buildLockIndicator(fieldIdentifier, config),
      isLocked: lockStates[fieldIdentifier],
    };
  };

  return {
    shouldLockIndicator: buildLockIndicator,
    shouldLockDisableProps: createDisableProperties,
    useLockedLabel: createLabelWithLock,
    useLockedSwitch: buildToggleSwitch,
    isManagedEventType: isManaged,
    isChildrenManagedEventType: isChildOfManaged,
  };
};

export { LockedSwitch, LockedIndicator };
export default useLockedFieldsManager;
