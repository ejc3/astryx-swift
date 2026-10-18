// Astryx's `settings` template, refactored onto the core: the JSX of
// src/stock/templates/settings.tsx, drawing `view` (core/src/templates/settings/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {useMemo} from 'react';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {List, ListItem} from '@astryxdesign/core/List';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';
import type {View} from '../../../core/src/templates/settings/model.ts';
import type {TemplateProps} from './props.ts';

export default function SettingsTemplate({view: raw, send}: TemplateProps) {
  const view = raw as View;
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const searchSource = useMemo<SearchSource<SearchableItem>>(
    () => ({
      search: (query: string) =>
        view.searchItems.filter(item =>
          item.label.toLowerCase().includes(query.toLowerCase()),
        ),
      bootstrap: () => view.searchItems,
    }),
    [view.searchItems],
  );
  const activeNav = view.navItems.find(item => item.isSelected)?.label ?? '';
  const setText = (field: string) => (value: string) =>
    send({type: 'set', id: `tpl.settings.${field}`, value});
  const setToggle = (field: string) => (value: boolean) =>
    send({type: 'set', id: `tpl.settings.${field}`, value});
  const pressNav = (label: string) =>
    send({type: 'press', id: `tpl.settings.nav:${label}`});

  return (
    <Layout
      height="fill"
      contentWidth={1440}
      header={
        <LayoutHeader hasDivider>
          <HStack vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Settings</Heading>
            </StackItem>
            <Typeahead
              label="Search"
              isLabelHidden
              placeholder="Search settings..."
              searchSource={searchSource}
              value={view.search}
              onChange={item =>
                send({
                  type: 'set',
                  id: 'tpl.settings.search',
                  value: item?.id ?? '',
                })
              }
              hasEntriesOnFocus
              startIcon={MagnifyingGlassIcon}
            />
          </HStack>
        </LayoutHeader>
      }
      start={
        isNarrow ? undefined : (
          <LayoutPanel hasDivider={false} width={260} padding={2}>
            <List density="balanced">
              {view.navItems.map(({label, isSelected}) => (
                <ListItem
                  key={label}
                  label={label}
                  isSelected={isSelected}
                  onClick={() => pressNav(label)}
                />
              ))}
            </List>
          </LayoutPanel>
        )
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {/* Mobile: the sidebar nav collapses to a horizontal, centered
                tab bar above the content. */}
            {isNarrow && (
              <VStack hAlign="center">
                <TabList value={activeNav} onChange={pressNav}>
                  {view.navItems.map(({label}) => (
                    <Tab key={label} value={label} label={label} />
                  ))}
                </TabList>
              </VStack>
            )}
            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Basic information</Heading>
                <Text type="supporting" color="secondary">
                  View and update your personal details and account information.
                </Text>
              </VStack>
              <VStack gap={4}>
                <TextInput
                  label="Username"
                  value={view.username}
                  onChange={setText('username')}
                />
                <TextInput
                  label="First name"
                  value={view.firstName}
                  onChange={setText('firstName')}
                />
                <TextInput
                  label="Last name"
                  value={view.lastName}
                  onChange={setText('lastName')}
                />
                <TextInput
                  label="Email address"
                  value={view.email}
                  onChange={setText('email')}
                />
                <HStack>
                  <Button label="Save" variant="primary" />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Change password</Heading>
                <Text type="supporting" color="secondary">
                  Update your password to keep your account secure.
                </Text>
              </VStack>
              <VStack gap={4}>
                <TextInput
                  label="Verify current password"
                  type="password"
                  value={view.currentPw}
                  onChange={setText('currentPw')}
                />
                <TextInput
                  label="New password"
                  type="password"
                  value={view.newPw}
                  onChange={setText('newPw')}
                />
                <TextInput
                  label="Confirm password"
                  type="password"
                  value={view.confirmPw}
                  onChange={setText('confirmPw')}
                />
                <HStack>
                  <Button label="Save" variant="primary" />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Advanced settings</Heading>
                <Text type="supporting" color="secondary">
                  Configure detailed account preferences and security options.
                </Text>
              </VStack>
              <VStack gap={5}>
                <CheckboxInput
                  label="Data Export Access"
                  description="Allow export of personal data and backups."
                  value={view.dataExport}
                  onChange={setToggle('dataExport')}
                />
                <CheckboxInput
                  label="Allow Admin to Add Members"
                  description="Admins can invite and manage members."
                  value={view.adminMembers}
                  onChange={setToggle('adminMembers')}
                />
                <CheckboxInput
                  label="Enable Two-Factor Authentication"
                  description="Require 2FA for added account security."
                  value={view.twoFactor}
                  onChange={setToggle('twoFactor')}
                />
                <HStack>
                  <Button label="Save" variant="primary" />
                </HStack>
              </VStack>
            </Grid>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
