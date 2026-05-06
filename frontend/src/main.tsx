import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, UserButton, useAuth, useClerk, useUser } from "@clerk/react";

import App from "./App";
import type { AppAuthClient } from "./App";
import { setAuthTokenProvider } from "./lib/api";
import "./styles/index.css";

const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ??
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const signedOutAuthClient: AppAuthClient = {
  frontendConfigured: false,
  isLoaded: true,
  isSignedIn: false,
  user: null,
  signIn: () => undefined,
  signUp: () => undefined,
  signOut: () => undefined
};

function ClerkBackedApp() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  React.useLayoutEffect(() => {
    setAuthTokenProvider(() => getToken());
    return () => setAuthTokenProvider(null);
  }, [getToken]);

  const authClient: AppAuthClient = {
    frontendConfigured: true,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? null,
          name: user.fullName ?? user.username ?? null,
          picture: user.imageUrl ?? null
        }
      : null,
    accountControl: <UserButton />,
    signIn: () => clerk.openSignIn({ afterSignInUrl: "/app", afterSignUpUrl: "/app" }),
    signUp: () => clerk.openSignUp({ afterSignInUrl: "/app", afterSignUpUrl: "/app" }),
    signOut: () => {
      void clerk.signOut({ redirectUrl: "/" });
    }
  };

  return <App authClient={authClient} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        <ClerkBackedApp />
      </ClerkProvider>
    ) : (
      <App authClient={signedOutAuthClient} />
    )}
  </React.StrictMode>
);
