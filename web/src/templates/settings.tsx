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
import {searchSettings} from '../../../core/src/templates/settings/model.ts';
import type {View} from '../../../core/src/templates/settings/model.ts';
import type {TemplateProps} from './props.ts';

export default function SettingsTemplate({view: raw, send}: TemplateProps) {
  const view = raw as View;
  const {words, rules} = view;
  const isNarrow = useMediaQuery(`(max-width: ${rules.narrowMaxWidth}px)`);
  // The core's rule (searchSettings), called here so typing needs no round trip.
  const searchSource = useMemo<SearchSource<SearchableItem>>(
    () => ({
      search: (query: string) => searchSettings(view.searchItems, query),
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
      contentWidth={rules.contentMaxWidth}
      header={
        <LayoutHeader hasDivider>
          <HStack vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>{words.title}</Heading>
            </StackItem>
            <Typeahead
              label={words.searchLabel}
              isLabelHidden
              placeholder={words.searchPlaceholder}
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
          <LayoutPanel
            hasDivider={false}
            width={rules.sidebarWidth}
            padding={2}>
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
            <Grid columns={{minWidth: rules.groupColumnMin}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>{words.basic.title}</Heading>
                <Text type="supporting" color="secondary">{words.basic.detail}</Text>
              </VStack>
              <VStack gap={4}>
                <TextInput
                  label={words.basic.username}
                  value={view.username}
                  onChange={setText('username')}
                />
                <TextInput
                  label={words.basic.firstName}
                  value={view.firstName}
                  onChange={setText('firstName')}
                />
                <TextInput
                  label={words.basic.lastName}
                  value={view.lastName}
                  onChange={setText('lastName')}
                />
                <TextInput
                  label={words.basic.email}
                  value={view.email}
                  onChange={setText('email')}
                />
                <HStack>
                  <Button label={words.save} variant="primary" />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            <Grid columns={{minWidth: rules.groupColumnMin}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>{words.password.title}</Heading>
                <Text type="supporting" color="secondary">{words.password.detail}</Text>
              </VStack>
              <VStack gap={4}>
                <TextInput
                  label={words.password.current}
                  type="password"
                  value={view.currentPw}
                  onChange={setText('currentPw')}
                />
                <TextInput
                  label={words.password.new}
                  type="password"
                  value={view.newPw}
                  onChange={setText('newPw')}
                />
                <TextInput
                  label={words.password.confirm}
                  type="password"
                  value={view.confirmPw}
                  onChange={setText('confirmPw')}
                />
                <HStack>
                  <Button label={words.save} variant="primary" />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            <Grid columns={{minWidth: rules.groupColumnMin}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>{words.advanced.title}</Heading>
                <Text type="supporting" color="secondary">{words.advanced.detail}</Text>
              </VStack>
              <VStack gap={5}>
                <CheckboxInput
                  label={words.advanced.dataExport}
                  description={words.advanced.dataExportDetail}
                  value={view.dataExport}
                  onChange={setToggle('dataExport')}
                />
                <CheckboxInput
                  label={words.advanced.adminMembers}
                  description={words.advanced.adminMembersDetail}
                  value={view.adminMembers}
                  onChange={setToggle('adminMembers')}
                />
                <CheckboxInput
                  label={words.advanced.twoFactor}
                  description={words.advanced.twoFactorDetail}
                  value={view.twoFactor}
                  onChange={setToggle('twoFactor')}
                />
                <HStack>
                  <Button label={words.save} variant="primary" />
                </HStack>
              </VStack>
            </Grid>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
