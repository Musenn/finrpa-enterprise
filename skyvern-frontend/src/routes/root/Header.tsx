import GitHubButton from "react-github-btn";
import { useMatch, useSearchParams } from "react-router-dom";
import { NavigationHamburgerMenu } from "./NavigationHamburgerMenu";
import { LanguageSwitcher } from "@/components/enterprise/LanguageSwitcher";

function Header() {
  const [searchParams] = useSearchParams();
  const embed = searchParams.get("embed");
  const match =
    useMatch("/workflows/:workflowPermanentId/edit") ||
    location.pathname.includes("build") ||
    location.pathname.includes("debug") ||
    embed === "true";

  if (match) {
    return null;
  }

  return (
    <header>
      <div className="flex h-24 items-center px-6">
        <NavigationHamburgerMenu />
        <div className="ml-auto flex items-center gap-4">
          <LanguageSwitcher />
          <div className="h-7">
            <GitHubButton
              href="https://github.com/Musenn/finrpa-enterprise"
              data-color-scheme="no-preference: dark; light: dark; dark: dark;"
              data-size="large"
              data-show-count="true"
              aria-label="Star Musenn/finrpa-enterprise on GitHub"
            >
              Star
            </GitHubButton>
          </div>
        </div>
      </div>
    </header>
  );
}

export { Header };
