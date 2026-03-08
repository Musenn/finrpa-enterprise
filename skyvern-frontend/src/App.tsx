import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { router } from "./router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/QueryClient";

import { PostHogProvider } from "posthog-js/react";
import { LoggingContext, loggingStub } from "@/store/LoggingContext";
import { UserContext } from "@/store/UserContext";
import { useAuthStore } from "@/store/AuthStore";

// Restore auth state from localStorage before the first render.
useAuthStore.getState().initialize();

const postHogOptions = {
  api_host: "https://app.posthog.com",
};

const getLogging = () => {
  return loggingStub;
};

const getUser = () => {
  return null;
};

function App() {
  return (
    <LoggingContext.Provider value={getLogging}>
      <UserContext.Provider value={getUser}>
        <PostHogProvider
          apiKey="phc_bVT2ugnZhMHRWqMvSRHPdeTjaPxQqT3QSsI3r5FlQR5"
          options={postHogOptions}
        >
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="light">
              <RouterProvider router={router} />
            </ThemeProvider>
          </QueryClientProvider>
        </PostHogProvider>
      </UserContext.Provider>
    </LoggingContext.Provider>
  );
}

export default App;
