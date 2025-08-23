const WorkflowListSkeletonLoader = () => {
  return (
    <div className="bg-default min-h-screen">
      {/* Header Section Skeleton */}
      <div className="border-subtle border-b px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="bg-emphasis mb-2 h-6 w-80 animate-pulse rounded sm:h-8 sm:w-96" />
              <div className="bg-emphasis h-4 w-64 animate-pulse rounded sm:h-5 sm:w-80" />
            </div>
            <div className="bg-emphasis h-10 w-full animate-pulse rounded-md sm:w-40" />
          </div>
        </div>
      </div>
      {/* Workflows List Skeleton */}
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="bg-default border-subtle rounded-lg border p-4 transition-shadow hover:shadow-sm sm:p-6">
                {/* Mobile Layout Skeleton */}
                <div className="block sm:hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="bg-emphasis mb-1 h-5 w-48 animate-pulse rounded" />
                      <div className="mb-3 flex items-center gap-2">
                        <div className="bg-emphasis h-2 w-2 animate-pulse rounded-full" />
                        <div className="bg-emphasis h-4 w-16 animate-pulse rounded" />
                      </div>
                    </div>

                    {/* Mobile Action Buttons Skeleton */}
                    <div className="flex items-center gap-1">
                      <div className="bg-emphasis h-8 w-8 animate-pulse rounded" />
                      <div className="bg-emphasis h-8 w-8 animate-pulse rounded" />
                    </div>
                  </div>

                  {/* Mobile Details Skeleton */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <div className="bg-emphasis h-4 w-16 animate-pulse rounded" />
                      <div className="bg-emphasis h-4 w-24 animate-pulse rounded" />
                    </div>
                    <div className="flex justify-between">
                      <div className="bg-emphasis h-4 w-20 animate-pulse rounded" />
                      <div className="bg-emphasis h-4 w-16 animate-pulse rounded" />
                    </div>
                  </div>
                </div>

                {/* Desktop Layout Skeleton */}
                <div className="hidden sm:flex sm:items-center sm:justify-between">
                  <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
                    {/* Workflow Name Skeleton */}
                    <div>
                      <div className="bg-emphasis mb-1 h-5 w-32 animate-pulse rounded" />
                      <div className="bg-emphasis h-4 w-16 animate-pulse rounded" />
                    </div>

                    {/* Trigger On Skeleton */}
                    <div>
                      <div className="bg-emphasis mb-1 h-5 w-24 animate-pulse rounded" />
                      <div className="bg-emphasis h-4 w-12 animate-pulse rounded" />
                    </div>

                    {/* Delivery Channels Skeleton */}
                    <div className="hidden md:block">
                      <div className="bg-emphasis mb-1 h-5 w-20 animate-pulse rounded" />
                      <div className="bg-emphasis h-4 w-16 animate-pulse rounded" />
                    </div>

                    {/* Status Skeleton */}
                    <div className="hidden md:block">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="bg-emphasis h-2 w-2 animate-pulse rounded-full" />
                        <div className="bg-emphasis h-5 w-16 animate-pulse rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Desktop Action Buttons Skeleton */}
                  <div className="ml-4 flex items-center gap-2 md:ml-8">
                    <div className="bg-emphasis h-8 w-8 animate-pulse rounded" />
                    <div className="bg-emphasis h-8 w-8 animate-pulse rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default WorkflowListSkeletonLoader;
