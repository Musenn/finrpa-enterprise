import { CompassIcon } from "@/components/icons/CompassIcon";
import { NavLinkGroup } from "@/components/NavLinkGroup";
import { useSidebarStore } from "@/store/SidebarStore";
import { cn } from "@/util/utils";
import {
  CounterClockwiseClockIcon,
  GearIcon,
  GlobeIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import { KeyIcon } from "@/components/icons/KeyIcon.tsx";
import { useI18n } from "@/i18n/useI18n";

function SideNav() {
  const { t } = useI18n();
  const { collapsed } = useSidebarStore();

  return (
    <nav
      className={cn("space-y-5", {
        "items-center": collapsed,
      })}
    >
      <NavLinkGroup
        title={t("nav.build")}
        links={[
          {
            label: t("nav.discover"),
            to: "/discover",
            icon: <CompassIcon className="size-6" />,
          },
          {
            label: t("nav.workflows"),
            to: "/workflows",
            icon: <LightningBoltIcon className="size-6" />,
          },
          {
            label: t("nav.runs"),
            to: "/runs",
            icon: <CounterClockwiseClockIcon className="size-6" />,
          },
          {
            label: t("nav.browsers"),
            to: "/browser-sessions",
            icon: <GlobeIcon className="size-6" />,
          },
        ]}
      />
      <NavLinkGroup
        title={t("nav.general")}
        links={[
          {
            label: t("nav.settings"),
            to: "/settings",
            icon: <GearIcon className="size-6" />,
          },
          {
            label: t("nav.credentials"),
            to: "/credentials",
            icon: <KeyIcon className="size-6" />,
          },
        ]}
      />
    </nav>
  );
}

export { SideNav };
