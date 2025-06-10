"use client";

import NoSSR from "@calcom/core/components/NoSSR";

import { UsersTable } from "../components/UsersTable";

const UserManagementGridPage = () => {
  const renderUsersTableComponent = () => <UsersTable />;

  const wrapWithClientSideRendering = (component: React.ReactNode) => <NoSSR>{component}</NoSSR>;

  return wrapWithClientSideRendering(renderUsersTableComponent());
};

export default UserManagementGridPage;
