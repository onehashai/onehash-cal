import { Fragment } from "react";

import { Icon, SkeletonText } from "@calcom/ui";

function SkeletonLoader() {
  const generateSkeletonItems = () => {
    const numberOfItems = 3;
    const items = [];

    for (let i = 0; i < numberOfItems; i++) {
      items.push(<SkeletonItem key={i} />);
    }

    return items;
  };

  const containerClassList = [
    "divide-subtle",
    "border-subtle",
    "bg-default",
    "animate-pulse",
    "divide-y",
    "rounded-md",
    "border",
    "sm:overflow-hidden",
  ];

  const composedContainerClass = containerClassList.join(" ");

  return <ul className={composedContainerClass}>{generateSkeletonItems()}</ul>;
}

export default SkeletonLoader;

function SkeletonItem() {
  const listItemClass = [
    "group",
    "flex",
    "w-full",
    "items-center",
    "justify-between",
    "px-4",
    "py-4",
    "sm:px-6",
  ].join(" ");
  const contentWrapperClass = ["flex-grow", "truncate", "text-sm"].join(" ");
  const columnContainerClass = ["flex", "flex-col", "space-y-2"].join(" ");
  const rowContainerClass = "flex";
  const iconClass = ["mr-1.5", "mt-0.5", "inline", "h-4", "w-4", "text-gray-200"].join(" ");
  const actionAreaClass = ["mt-0", "flex", "flex-shrink-0", "sm:ml-5"].join(" ");
  const buttonContainerClass = ["flex", "justify-between", "space-x-2", "rtl:space-x-reverse"].join(" ");

  const TitleSkeleton = () => {
    const titleClass = ["h-4", "w-16", "sm:w-24"].join(" ");
    return <SkeletonText className={titleClass} />;
  };

  const IconElement = ({ iconName }: { iconName: "bell" | "link" }) => (
    <Icon name={iconName} className={iconClass} />
  );

  const DetailRow = () => {
    const firstTextClass = ["h-4", "w-16", "ltr:mr-2", "rtl:ml-2", "sm:w-28"].join(" ");
    const secondTextClass = ["h-4", "w-28", "sm:w-36"].join(" ");

    const detailElements = [
      { icon: "bell" as const, textClass: firstTextClass },
      { icon: "link" as const, textClass: secondTextClass },
    ];

    return (
      <div className={rowContainerClass}>
        {detailElements.map((detail, idx) => (
          <Fragment key={idx}>
            <IconElement iconName={detail.icon} />
            <SkeletonText className={detail.textClass} />
          </Fragment>
        ))}
      </div>
    );
  };

  const ContentSection = () => (
    <div className={contentWrapperClass}>
      <div className={rowContainerClass}>
        <div className={columnContainerClass}>
          <TitleSkeleton />
          <DetailRow />
        </div>
      </div>
    </div>
  );

  const ActionSection = () => {
    const actionButtonClass = ["h-8", "w-8", "sm:w-16"].join(" ");

    return (
      <div className={actionAreaClass}>
        <div className={buttonContainerClass}>
          <SkeletonText className={actionButtonClass} />
        </div>
      </div>
    );
  };

  return (
    <li className={listItemClass}>
      <ContentSection />
      <ActionSection />
    </li>
  );
}
