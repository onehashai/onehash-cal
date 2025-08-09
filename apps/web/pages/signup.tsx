import { getServerSideProps } from "@lib/signup/getServerSideProps";

import PageWrapper from "@components/PageWrapper";

import type { PageProps } from "~/signup-view";
import Signup from "~/signup-view";

const Page = (props: PageProps) => <Signup {...props} />;
// const Page = () => <Signup />;

export { getServerSideProps };
Page.PageWrapper = PageWrapper;
export default Page;
