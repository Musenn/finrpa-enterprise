import { useSidebarStore } from "@/store/SidebarStore";
import { cn } from "@/util/utils";
import { SidebarContent } from "./SidebarContent";

function Sidebar() {
  const collapsed = useSidebarStore((state) => state.collapsed);

  return (
    <aside
      className={cn(
        "glass-sidebar fixed left-3 top-3 hidden lg:block",
        collapsed ? "w-16" : "w-60",
      )}
      style={{ height: "calc(100vh - 24px)" }}
    >
      <SidebarContent useCollapsedState />
    </aside>
  );
}

export { Sidebar };
