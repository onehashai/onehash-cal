import type { GetAppData, SetAppData } from "EventTypeAppContext";
import { useEffect, useState, useMemo } from "react";

import { TextField, SkeletonText } from "@calcom/ui";

function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-2 py-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <div className="relative flex flex-col gap-2" key={index}>
          <SkeletonText className="h-4 w-1/5" />
          <SkeletonText className="h-6 w-full" />
        </div>
      ))}
    </div>
  );
}

interface GenericEventTypeAppSettingsInterfaceProps {
  getAppData?: GetAppData;
  setAppData?: SetAppData;
  disabled?: boolean;
  appSchema: Record<string, any>;
}

const GenericEventTypeAppSettingsInterface = ({
  getAppData,
  setAppData,
  disabled,
  appSchema,
}: GenericEventTypeAppSettingsInterfaceProps) => {
  const appDataKeys = useMemo(() => appSchema.keyof().options as string[], [appSchema]);

  if (!getAppData || !setAppData) return null;

  if (appDataKeys.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 py-3">
      {appDataKeys.map((key) => {
        const value = getAppData(key);
        const name = key.replace(/[-_]/g, " ");

        return (
          <TextField
            key={key}
            name={name}
            value={value as string}
            disabled={disabled}
            onChange={(e) => setAppData(key, e.target.value)}
          />
        );
      })}
    </div>
  );
};

interface DynamicComponentProps<T> {
  componentMap: T;
  slug: string;
  wrapperClassName?: string;
  getAppData?: GetAppData;
  setAppData?: SetAppData;
  disabled?: boolean;
}

export function DynamicComponent<T extends Record<string, React.ComponentType<any>>>({
  componentMap,
  slug,
  wrapperClassName = "",
  ...rest
}: DynamicComponentProps<T>) {
  const dirName = slug === "stripe" ? "stripepayment" : slug;

  const [appSchema, setAppSchema] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppDataSchema = async () => {
      setLoading(true);
      try {
        const { appDataSchema } = await import(`@calcom/app-store/${dirName}/zod.ts`);
        const filteredSchema = appDataSchema.omit({
          enabled: true,
          credentialId: true,
          appCategories: true,
        });
        setAppSchema(filteredSchema);
      } catch (error) {
        console.error(`Error loading schema from ${dirName}:`, error);
      } finally {
        setLoading(false);
      }
    };

    loadAppDataSchema();
  }, [dirName]);

  if (loading) return <SkeletonLoader />;

  if (!componentMap[dirName]) {
    return appSchema ? <GenericEventTypeAppSettingsInterface {...rest} appSchema={appSchema} /> : null;
  }

  const Component = componentMap[dirName];

  return (
    <div className={wrapperClassName}>
      <Component {...rest} />
    </div>
  );
}
