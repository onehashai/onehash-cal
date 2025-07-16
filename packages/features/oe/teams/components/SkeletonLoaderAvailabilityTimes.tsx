import { SkeletonContainer, SkeletonText } from "@calcom/ui";

const SkeletonLoader = function () {
  const containerElement = (
    <SkeletonContainer>
      <div className="mr-3">
        <SkeletonText className="h-4 w-28" />
        <SkeletonText className="mt-3 h-11 w-full" />
        <SkeletonText className="mt-2 h-11 w-full" />
      </div>
    </SkeletonContainer>
  );

  return containerElement;
};

export default SkeletonLoader;
