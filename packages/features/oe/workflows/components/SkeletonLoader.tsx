import { SkeletonAvatar, SkeletonContainer, SkeletonText, Icon } from "@calcom/ui";

function SkeletonLoaderEdit() {
  return (
    <SkeletonContainer>
      <div className="ml-2 mt-10 md:flex">
        <div className="mr-6 flex flex-col md:flex-none">
          <SkeletonText className="h-4 w-28" />
          <SkeletonText className="mb-6 mt-2 h-8 w-full md:w-64" />
          <SkeletonText className="h-4 w-28" />
          <SkeletonText className="mt-2 h-8 w-full md:w-64" />
          <SkeletonText className="mt-8 hidden h-0.5 w-full md:block" />
          <SkeletonText className="mb-6 mt-8 h-8 w-40" />
        </div>
        <div className="hidden flex-grow md:flex">
          <SkeletonText className="h-64 w-full" />
        </div>
      </div>
    </SkeletonContainer>
  );
}

function SkeletonLoaderList() {
  return (
    <ul className="divide-subtle border-subtle bg-default animate-pulse divide-y  rounded-md border sm:overflow-hidden">
      <SkeletonLoaderItem />
      <SkeletonLoaderItem />
      <SkeletonLoaderItem />
    </ul>
  );
}

function SkeletonLoaderItem() {
  return (
    <li className="group flex w-full items-center justify-between px-4 py-4 sm:px-6">
      <div className="flex-grow truncate text-sm">
        <div className="flex">
          <div className="flex flex-col space-y-2">
            <SkeletonText className="h-4 w-16 sm:w-24" />
            <div className="flex">
              <Icon name="bell" className="mr-1.5 mt-0.5 inline h-4 w-4 text-gray-200" />
              <SkeletonText className="h-4 w-16 sm:w-28 ltr:mr-2 rtl:ml-2" />
              <Icon name="link" className="mr-1.5 mt-0.5 inline h-4 w-4 text-gray-200" />
              <SkeletonText className="h-4 w-28 sm:w-36" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-0 flex flex-shrink-0 sm:ml-5">
        <div className="flex justify-between space-x-2 rtl:space-x-reverse">
          <SkeletonText className="h-8 w-8 sm:w-16" />
        </div>
      </div>
    </li>
  );
}

function SkeletonLoaderEventWorkflowsTab() {
  return (
    <ul className="bg-default divide-subtle animate-pulse sm:overflow-hidden">
      <SkeletonEventWorkflowsTabItem />
      <SkeletonEventWorkflowsTabItem />
    </ul>
  );
}

function SkeletonEventWorkflowsTabItem() {
  return (
    <li className="border-subtle group mb-4 flex h-[90px] w-full items-center justify-between rounded-md border px-4 py-4 sm:px-6">
      <div className="flex-grow truncate text-sm">
        <div className="flex">
          <SkeletonAvatar className="h-10 w-10" />

          <div className="ml-4 mt-1 flex flex-col space-y-1">
            <SkeletonText className="h-5 w-20 sm:w-24" />
            <div className="flex">
              <SkeletonText className="h-4 w-16 sm:w-28 ltr:mr-2 rtl:ml-2" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-0 flex flex-shrink-0 sm:ml-5">
        <div className="flex justify-between space-x-2 rtl:space-x-reverse">
          <SkeletonText className="h-8 w-8 sm:w-16" />
          <SkeletonText className="h-8 w-8 sm:w-16" />
        </div>
      </div>
    </li>
  );
}

export { SkeletonLoaderEdit, SkeletonLoaderList, SkeletonLoaderEventWorkflowsTab };
