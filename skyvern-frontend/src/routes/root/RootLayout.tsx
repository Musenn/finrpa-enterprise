import { Toaster } from "@/components/ui/toaster";
import { useSidebarStore } from "@/store/SidebarStore";
import { cn } from "@/util/utils";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useDebugStore } from "@/store/useDebugStore";
import { GlobalNotificationListener } from "@/components/GlobalNotificationListener";
import { SelfHealApiKeyBanner } from "@/components/SelfHealApiKeyBanner";

function RootLayout() {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const embed = new URLSearchParams(window.location.search).get("embed");
  const isEmbedded = embed === "true";
  const debugStore = useDebugStore();

  // Floating sidebar: 12px left offset + sidebar width + 12px gap
  const horizontalPadding = cn("lg:pl-[264px]", {
    "lg:pl-[88px]": collapsed,
    "lg:pl-4": isEmbedded,
  });

  return (
    <div className="glass-page">
      {!isEmbedded && <Sidebar />}
      <div className="h-full w-full">
        <div className={horizontalPadding}>
          <SelfHealApiKeyBanner />
          <GlobalNotificationListener />
        </div>
        <Header />
        <main
          className={cn("lg:pb-4", horizontalPadding, {
            "lg:pb-0": debugStore.isDebugMode,
          })}
        >
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export { RootLayout };
