import { SkeletonAvatar, SkeletonText } from "@calcom/ui";

function SkeletonLoader() {
  const listContainerClasses = ["bg-default", "divide-subtle", "animate-pulse", "sm:overflow-hidden"].join(
    " "
  );

  const itemCount = 2;
  const skeletonItems = Array.from({ length: itemCount }, (_, index) => <SkeletonItem key={index} />);

  const ListContainer = ({ children }: { children: React.ReactNode }) => (
    <ul className={listContainerClasses}>{children}</ul>
  );

  return <ListContainer>{skeletonItems}</ListContainer>;
}

export default SkeletonLoader;

function SkeletonItem() {
  const itemWrapperStyles = [
    "border-subtle",
    "group",
    "mb-4",
    "flex",
    "h-[90px]",
    "w-full",
    "items-center",
    "justify-between",
    "rounded-md",
    "border",
    "px-4",
    "py-4",
    "sm:px-6",
  ].join(" ");

  const contentAreaStyles = ["flex-grow", "truncate", "text-sm"].join(" ");

  const AvatarSection = () => {
    const avatarDimensions = "h-10 w-10";
    return <SkeletonAvatar className={avatarDimensions} />;
  };

  const TextSection = () => {
    const textContainerStyles = ["ml-4", "mt-1", "flex", "flex-col", "space-y-1"].join(" ");
    const primaryTextStyles = ["h-5", "w-20", "sm:w-24"].join(" ");
    const secondaryTextStyles = ["h-4", "w-16", "ltr:mr-2", "rtl:ml-2", "sm:w-28"].join(" ");

    return (
      <div className={textContainerStyles}>
        <SkeletonText className={primaryTextStyles} />
        <div className="flex">
          <SkeletonText className={secondaryTextStyles} />
        </div>
      </div>
    );
  };

  const ActionSection = () => {
    const actionContainerStyles = ["mt-0", "flex", "flex-shrink-0", "sm:ml-5"].join(" ");
    const buttonGroupStyles = ["flex", "justify-between", "space-x-2", "rtl:space-x-reverse"].join(" ");
    const buttonStyles = ["h-8", "w-8", "sm:w-16"].join(" ");

    const actionButtons = [0, 1].map((buttonIndex) => (
      <SkeletonText key={buttonIndex} className={buttonStyles} />
    ));

    return (
      <div className={actionContainerStyles}>
        <div className={buttonGroupStyles}>{actionButtons}</div>
      </div>
    );
  };

  const MainContent = () => (
    <div className={contentAreaStyles}>
      <div className="flex">
        <AvatarSection />
        <TextSection />
      </div>
    </div>
  );

  return (
    <li className={itemWrapperStyles}>
      <MainContent />
      <ActionSection />
    </li>
  );
}
