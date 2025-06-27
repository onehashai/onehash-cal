import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { TimeUnit } from "@calcom/prisma/enums";
import {
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  TextField,
} from "@calcom/ui";

const DURATION_UNITS = [TimeUnit.DAY, TimeUnit.HOUR, TimeUnit.MINUTE] as const;

interface ComponentProps {
  disabled: boolean;
}

const DurationUnitSelector = ({
  menuElements,
  unitTranslations,
}: {
  menuElements: JSX.Element;
  unitTranslations: { [key: string]: string };
}) => {
  const formInstance = useFormContext();
  const selectedUnit = formInstance.getValues("timeUnit") ?? TimeUnit.MINUTE;
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <Dropdown onOpenChange={setMenuVisible}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center">
          <div className="mr-1 w-3/5">{selectedUnit ? unitTranslations[selectedUnit] : "undefined"}</div>
          <div className="w-1/4 pt-1">
            {menuVisible ? <Icon name="chevron-up" /> : <Icon name="chevron-down" />}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>{menuElements}</DropdownMenuContent>
    </Dropdown>
  );
};

export const TimeTimeUnitInput = (componentProps: ComponentProps) => {
  const formInstance = useFormContext();
  const { t } = useLocale();

  const unitTranslations = DURATION_UNITS.reduce((accumulator, unit) => {
    accumulator[unit] = t(`${unit.toLowerCase()}_timeUnit`);
    return accumulator;
  }, {} as { [key: string]: string });

  return (
    <div className="flex">
      <div className="grow">
        <TextField
          type="number"
          min="1"
          label=""
          disabled={componentProps.disabled}
          defaultValue={formInstance.getValues("time") || 24}
          className="-mt-2 rounded-r-none text-sm focus:ring-0"
          {...formInstance.register("time", { valueAsNumber: true })}
          addOnSuffix={
            <DurationUnitSelector
              unitTranslations={unitTranslations}
              menuElements={
                <>
                  {DURATION_UNITS.map((unit, idx) => (
                    <DropdownMenuItem key={idx} className="outline-none">
                      <DropdownItem
                        key={idx}
                        type="button"
                        onClick={() => {
                          formInstance.setValue("timeUnit", unit, { shouldDirty: true });
                        }}>
                        {unitTranslations[unit]}
                      </DropdownItem>
                    </DropdownMenuItem>
                  ))}
                </>
              }
            />
          }
        />
      </div>
    </div>
  );
};
