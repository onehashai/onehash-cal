// import { useEffect } from "react";

// import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
// import { useLocale } from "@calcom/lib/hooks/useLocale";
// import { Button, Meta, SkeletonContainer, SkeletonText } from "@calcom/ui";
// import { Plus } from "@calcom/ui/components/icon";

// import PageWrapper from "@components/PageWrapper";
// import { useEffect } from "react";

// const SkeletonLoader = ({ title, description }: { title: string; description: string }) => {
//   return (
//     <SkeletonContainer>
//       <Meta title={title} description={description} borderInShellHeader={true} />
//       <div className="divide-subtle border-subtle space-y-6 rounded-b-lg border border-t-0 px-6 py-4">
//         <SkeletonText className="h-8 w-full" />
//         <SkeletonText className="h-8 w-full" />
//       </div>
//     </SkeletonContainer>
//   );
// };

// const ImportFromCalendlyButton = () => {
//   const { t } = useLocale();

//   return (
//     <Button color="secondary" StartIcon={Plus} href="/apps/categories/conferencing">
//       {t("integrate")}
//     </Button>
//   );
// };

// const ConferencingLayout = () => {
//   const { t } = useLocale();

//   useEffect(() => {
//     //get user
//   }, []);

//   return (
//     <>
//       <div className="bg-default w-full sm:mx-0 xl:mt-0">
//         <Meta
//           title={t("conferencing")}
//           description={t("conferencing_description")}
//           CTA={<ImportFromCalendlyButton />}
//           borderInShellHeader={true}
//         />

//         {/* <QueryCell
//           query={query}
//           customLoader={
//             <SkeletonLoader title={t("conferencing")} description={t("conferencing_description")} />
//           }
//           success={({ data }) => {
//             console.log(data);
//             if (!data.items.length) {
//               return (
//                 <EmptyScreen
//                   Icon={Calendar}
//                   headline={t("no_category_apps", {
//                     category: t("conferencing").toLowerCase(),
//                   })}
//                   description={t("no_category_apps_description_conferencing")}
//                   buttonRaw={
//                     <Button
//                       color="secondary"
//                       data-testid="connect-conferencing-apps"
//                       href="/apps/categories/conferencing">
//                       {t("connect_conference_apps")}
//                     </Button>
//                   }
//                 />
//               );
//             }
//             return (
//               <AppList
//                 listClassName="rounded-lg rounded-t-none border-t-0"
//                 handleDisconnect={handleDisconnect}
//                 data={data}
//                 variant="conferencing"
//               />
//             );
//           }}
//         /> */}
//       </div>
//     </>
//   );
// };

// ConferencingLayout.getLayout = getLayout;
// ConferencingLayout.PageWrapper = PageWrapper;

// export default ConferencingLayout;
