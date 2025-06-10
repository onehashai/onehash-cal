import PageWrapper from "@components/PageWrapper";

import User, { type UserPageProps } from "~/users/views/users-public-view";

export { getServerSideProps } from "@server/lib/[user]/getServerSideProps";

const UserPage = (props: UserPageProps) => <User {...props} />;

UserPage.PageWrapper = PageWrapper;

export default UserPage;
