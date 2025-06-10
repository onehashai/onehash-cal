import { memo } from "react";

import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import { SkeletonButton, SkeletonContainer, SkeletonText } from "@calcom/ui";

const AppearanceSkeletonLoader = memo(() => {
  const skeletonCardClasses = "bg-emphasis h-32 flex-1 animate-pulse rounded-md p-5";

  return (
    <SkeletonContainer>
      <div className="border-subtle mt-6 flex items-center rounded-t-xl border p-6 text-sm">
        <SkeletonText className="h-8 w-1/3" />
      </div>

      <div className="border-subtle space-y-6 border-x px-4 py-6 sm:px-6">
        <div className="flex w-full items-center justify-center gap-6">
          <div className={skeletonCardClasses} />
          <div className={skeletonCardClasses} />
          <div className={skeletonCardClasses} />
        </div>

        <div className="flex justify-between">
          <SkeletonText className="h-8 w-1/3" />
          <SkeletonText className="h-8 w-1/3" />
        </div>

        <SkeletonText className="h-8 w-full" />
      </div>

      <div className="rounded-b-xl">
        <SectionBottomActions align="end">
          <SkeletonButton className="mr-6 h-8 w-20 rounded-md p-5" />
        </SectionBottomActions>
      </div>
    </SkeletonContainer>
  );
});

AppearanceSkeletonLoader.displayName = "AppearanceSkeletonLoader";

export { AppearanceSkeletonLoader as AppearanceSkeletonLoader };
