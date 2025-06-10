import { default as PostHogProvider } from "./posthog_providers";
import SessionManager from "./session_providers";

export default function GlobalAppProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <PostHogProvider>
      <SessionManager>{children}</SessionManager>
    </PostHogProvider>
  );

  return content;
}
