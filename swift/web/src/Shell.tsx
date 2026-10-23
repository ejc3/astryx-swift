import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";


import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SideNav, SideNavItem } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect } from "react";
import type { AppSnapshot } from "@astryx-native/core";
import { navigate } from "./client.ts";
import { Ic } from "./icons.tsx";
import { Render } from "./render/Render.tsx";
import { ButtonView } from "./render/controls.tsx";
import { ThemeSwitcher } from "./ThemeSwitcher.tsx";
import { AccountPanel } from "./Account.tsx";
import { Overlays } from "./Overlays.tsx";


function NavItems({ app }: { app: AppSnapshot }) {
  return (
    <>
      {app.nav.map((item) => (
        <SideNavItem
          key={item.id}
          label={item.label}
          icon={<Ic name={item.icon} />}
          isSelected={item.id === app.current}
          onClick={() => navigate(item.id)}
          {...(item.badge ? { endContent: <Badge label={item.badge} /> } : {})}
        />
      ))}
    </>
  );
}

export function Shell({ app }: { app: AppSnapshot }) {
  const { screen } = app;
  useEffect(() => { document.title = `${screen.title} · ${app.appName}`; }, [screen.title, app.appName]);
  return (
    <>
      <AppShell
        height="auto"
        variant="elevated"
        topNav={<TopNav label={app.appName} heading={<TopNavHeading heading={app.appName} />} />}
        sideNav={
          <SideNav
            footer={<><AccountPanel account={app.account} /><ThemeSwitcher theme={app.theme} /></>}
          >
            <NavItems app={app} />
          </SideNav>
        }
      >
        <main className="an-page" id="an-main">
          <header className="an-header">
            <VStack gap={0.5}>
              <Heading level={1}>{screen.title}</Heading>
              <Text type="supporting">{screen.subtitle}</Text>
            </VStack>
            {screen.toolbar.length > 0 ? (
              <HStack gap={2} wrap="wrap">
                {screen.toolbar.map((b, i) => <ButtonView key={i} node={b} />)}
              </HStack>
            ) : null}
          </header>
          <Render node={screen.body} />
        </main>
      </AppShell>
      <Overlays app={app} />
    </>
  );
}
