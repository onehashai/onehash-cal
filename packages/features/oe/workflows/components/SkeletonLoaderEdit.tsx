import { SkeletonContainer, SkeletonText } from "@calcom/ui";

function SkeletonLoader() {
  const MainWrapper = () => {
    const containerStyles = "ml-2 mt-10 md:flex";

    return <div className={containerStyles}>{renderContent()}</div>;
  };

  const renderContent = () => {
    const sidebarSection = createSidebarSection();
    const mainContentSection = createMainContentSection();

    return (
      <>
        {sidebarSection}
        {mainContentSection}
      </>
    );
  };

  const createSidebarSection = () => {
    const sidebarContainerStyles = "mr-6 flex flex-col md:flex-none";

    const elementConfigs = [
      { height: "h-4", width: "w-28", marginTop: "", marginBottom: "" },
      { height: "h-8", width: "w-full md:w-64", marginTop: "mt-2", marginBottom: "mb-6" },
      { height: "h-4", width: "w-28", marginTop: "", marginBottom: "" },
      { height: "h-8", width: "w-full md:w-64", marginTop: "mt-2", marginBottom: "" },
      {
        height: "h-0.5",
        width: "w-full",
        marginTop: "mt-8",
        marginBottom: "",
        additionalClasses: "hidden md:block",
      },
      { height: "h-8", width: "w-40", marginTop: "mt-8", marginBottom: "mb-6" },
    ];

    const sidebarElements = elementConfigs.map((config, index) => {
      const combinedClasses = [
        config.height,
        config.width,
        config.marginTop,
        config.marginBottom,
        config.additionalClasses || "",
      ]
        .filter(Boolean)
        .join(" ");

      return <SkeletonText key={index} className={combinedClasses} />;
    });

    return <div className={sidebarContainerStyles}>{sidebarElements}</div>;
  };

  const createMainContentSection = () => {
    const mainContentContainerStyles = "hidden flex-grow md:flex";
    const contentSkeletonStyles = "h-64 w-full";

    const contentElement = <SkeletonText className={contentSkeletonStyles} />;

    return <div className={mainContentContainerStyles}>{contentElement}</div>;
  };

  const skeletonStructure = (
    <SkeletonContainer>
      <MainWrapper />
    </SkeletonContainer>
  );

  return skeletonStructure;
}

export default SkeletonLoader;
