import React from "react";

import { SkeletonText } from "@calcom/ui";

const SkeletonLoaderTeamList = () => {
  const listItems = [];
  for (let index = 0; index < 3; index++) {
    listItems.push(<SkeletonItem key={index} />);
  }

  return (
    <React.Fragment>
      <ul className="border-subtle bg-default divide-subtle -mx-4 animate-pulse divide-y rounded-md border sm:mx-0 sm:overflow-hidden">
        {listItems}
      </ul>
    </React.Fragment>
  );
};

export default SkeletonLoaderTeamList;

const SkeletonItem = function () {
  const profileSection = (
    <div className="flex justify-start space-x-2 px-2 rtl:space-x-reverse">
      <SkeletonText className="h-10 w-10 rounded-full" />
      <div className="flex flex-col space-y-2">
        <SkeletonText className="h-4 w-32" />
        <SkeletonText className="h-4 w-16" />
      </div>
    </div>
  );

  const actionSection = (
    <div className="mt-4 hidden flex-shrink-0 pr-4 sm:ml-5 sm:mt-0 lg:flex">
      <div className="flex justify-between space-x-2 rtl:space-x-reverse">
        <SkeletonText className="h-4 w-12" />
        <SkeletonText className="h-4 w-4" />
        <SkeletonText className="h-4 w-4" />
      </div>
    </div>
  );

  const listItemElement = (
    <li className="group flex w-full items-center justify-between px-3 py-4">
      <div className="flex-grow truncate text-sm">{profileSection}</div>
      {actionSection}
    </li>
  );

  return listItemElement;
};
