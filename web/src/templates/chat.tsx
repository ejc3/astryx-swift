// Astryx's `ai-chat` template, refactored onto the core: the JSX of
// src/stock/templates/ai-chat.tsx, drawing `view` (core/src/templates/chat/model.ts) and sending
// actions with `send`. It must look pixel-for-pixel like the stock copy (npm run parity).
// Left to React on purpose: the artifact panel's dragged width (useResizable) and the
// pixel measure that picks panel or dialog.

'use client';

import {useRef, type CSSProperties} from 'react';

import {
  HStack,
  VStack,
  StackItem,
  Layout,
  LayoutContent,
} from '@astryxdesign/core/Layout';
import {Text, Heading} from '@astryxdesign/core/Text';
import {
  ChatComposer,
  ChatComposerInput,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
  ChatSystemMessage,
  ChatTokenizedText,
  ChatToolCalls,
} from '@astryxdesign/core/Chat';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Card} from '@astryxdesign/core/Card';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Section} from '@astryxdesign/core/Section';
import {Markdown} from '@astryxdesign/core/Markdown';
import {CodeBlock} from '@astryxdesign/core/CodeBlock';
import {Timestamp} from '@astryxdesign/core/Timestamp';
import {Token} from '@astryxdesign/core/Token';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Toolbar} from '@astryxdesign/core/Toolbar';
import {useResizable, ResizeHandle} from '@astryxdesign/core/Resizable';

import {
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ShareIcon,
  AtSymbolIcon,
  PaperClipIcon,
  XMarkIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

import type {
  ChatItem,
  ChatPart,
  ChatView as View,
  ToolCall,
} from '../../../core/src/templates/chat/model.ts';
import type {TemplateProps} from './props.ts';

// Below this width the split-pane collapses to a single chat column. Shared by
// the CSS container query and the JS check in openArtifact so they can't drift.
const MOBILE_MAX_WIDTH = 767;

const root: CSSProperties = {
  height: '100dvh',
  width: '100%',
  containerType: 'inline-size',
  containerName: 'artifact',
};
const chatColumn: CSSProperties = {
  flex: 1,
  width: '100%',
  minWidth: 0,
  height: '100%',
};
const chatLayout: CSSProperties = {
  flex: 1,
  minHeight: 0,
};
const artifactScroll: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};
const articleBody: CSSProperties = {
  maxWidth: 720,
  marginInline: 'auto',
};

// Runtime width for the artifact panel, passed in via the --artifact-panel-width
// custom property so the MOBILE container query can still override it to 100%
// (an inline `width` would beat the class rule). The container query lives in a
// plain <style> tag below so it needs NO CSS compiler.
const artifactPanelWidthVar = (size: number | string): CSSProperties =>
  ({
    '--artifact-panel-width': typeof size === 'number' ? `${size}px` : size,
  }) as CSSProperties;

const AI_CHAT_CSS = `
.ai-chat-resize-handle {
  display: flex;
}
.ai-chat-artifact-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: var(--artifact-panel-width);
  flex-shrink: 0;
}
@container artifact (max-width: ${MOBILE_MAX_WIDTH}px) {
  .ai-chat-resize-handle {
    display: none;
  }
  .ai-chat-artifact-panel {
    display: none;
    width: 100%;
    flex-shrink: 1;
  }
}
`;

// Artifact subviews

type Artifact = View['artifact'];

// Header actions: version menu, copy, share. Pass `onClose` for the desktop
// close button. A fragment so each control is a direct child of the toolbar.
function ArtifactActions({
  versions,
  onClose,
}: {
  versions: string[];
  onClose?: () => void;
}) {
  return (
    <>
      <DropdownMenu
        button={{
          label: 'v2',
          variant: 'ghost',
          size: 'sm',
        }}
        items={versions.map(label => ({label}))}
      />
      <Button
        label="Copy"
        variant="ghost"
        size="sm"
        icon={<Icon icon={ClipboardDocumentIcon} size="sm" />}
        isIconOnly
      />
      <Button
        label="Share"
        variant="ghost"
        size="sm"
        icon={<Icon icon={ShareIcon} size="sm" />}
        isIconOnly
      />
      {onClose != null && (
        <Button
          label="Close document"
          variant="ghost"
          size="sm"
          icon={<Icon icon={XMarkIcon} size="sm" />}
          isIconOnly
          onClick={onClose}
        />
      )}
    </>
  );
}

// Mobile variant: the actions collapse into an overflow menu.
function MobileArtifactActions({versions}: {versions: string[]}) {
  return (
    <MoreMenu
      label="Document actions"
      size="sm"
      items={[
        {
          type: 'section',
          title: 'Version',
          items: versions.map(label => ({label, onClick: () => {}})),
        },
        {type: 'divider'},
        {label: 'Copy', icon: ClipboardDocumentIcon},
        {label: 'Share', icon: ShareIcon},
      ]}
    />
  );
}

// Scrollable artifact body — the formatted document.
function ArtifactBody({artifact}: {artifact: Artifact}) {
  return (
    <Section variant="transparent" style={artifactScroll}>
      <VStack gap={2} style={articleBody}>
        <Heading level={1}>{artifact.title}</Heading>
        <Markdown>{artifact.content}</Markdown>
      </VStack>
    </Section>
  );
}

// In-message card that opens the artifact panel/dialog.
function ArtifactCard({
  label,
  title,
  caption,
  onOpen,
}: {
  label: string;
  title: string;
  caption: string;
  onOpen: () => void;
}) {
  return (
    <ClickableCard
      label={label}
      onClick={onOpen}
      variant="muted"
      padding={3}
      maxWidth={360}>
      <HStack gap={3} vAlign="center" width="100%">
        <Icon icon={DocumentTextIcon} size="md" color="secondary" />
        <StackItem size="fill">
          <VStack gap={0}>
            <Text type="label" weight="semibold">
              {title}
            </Text>
            <Text type="supporting" color="secondary">
              {caption}
            </Text>
          </VStack>
        </StackItem>
        <Icon icon={ChevronRightIcon} size="sm" color="secondary" />
      </HStack>
    </ClickableCard>
  );
}

// Conversation

function Time({at}: {at: string}) {
  return <Timestamp value={at} format="time" />;
}

function BubbleContent({
  content,
  onOpen,
}: {
  content: Extract<ChatPart, {kind: 'bubble'}>['content'];
  onOpen: () => void;
}) {
  switch (content.kind) {
    case 'text':
      return <>{content.text}</>;
    case 'mention':
      return (
        <ChatTokenizedText tokens={content.tokens}>
          {content.text}
        </ChatTokenizedText>
      );
    case 'markdown':
      return <Markdown density="compact">{content.text}</Markdown>;
    case 'code':
      return (
        <CodeBlock
          title={content.title}
          language={content.language}
          code={content.code}
        />
      );
    case 'artifact':
      return (
        <ArtifactCard
          label={content.label}
          title={content.title}
          caption={content.caption}
          onOpen={onOpen}
        />
      );
  }
}

function MessagePart({part, onOpen}: {part: ChatPart; onOpen: () => void}) {
  switch (part.kind) {
    case 'bubble':
      return (
        <ChatMessageBubble
          variant={part.variant}
          group={part.group}
          width={part.width}
          metadata={
            part.time ? (
              <ChatMessageMetadata
                timestamp={<Time at={part.time.at} />}
                status={part.status}
              />
            ) : undefined
          }>
          <BubbleContent content={part.content} onOpen={onOpen} />
        </ChatMessageBubble>
      );
    case 'tools':
      return (
        <ChatToolCalls
          defaultIsExpanded={part.expanded || undefined}
          calls={part.calls satisfies ToolCall[]}
        />
      );
    case 'meta':
      return (
        <ChatMessageMetadata
          timestamp={<Time at={part.time.at} />}
          footer={
            part.footer ? (
              <Text type="supporting" color="secondary">
                {part.footer}
              </Text>
            ) : undefined
          }
        />
      );
  }
}

function Item({item, onOpen}: {item: ChatItem; onOpen: () => void}) {
  switch (item.kind) {
    case 'divider':
      return <ChatSystemMessage variant="divider">{item.text}</ChatSystemMessage>;
    case 'status':
      return <ChatSystemMessage>{item.text}</ChatSystemMessage>;
    case 'message':
      return (
        <ChatMessage
          sender={item.sender}
          avatar={
            item.avatar ? <Avatar name={item.avatar} size="md" /> : undefined
          }>
          {item.files.length > 0 && (
            <HStack gap={1} wrap="wrap">
              {item.files.map(file => (
                <Token key={file} label={file} />
              ))}
            </HStack>
          )}
          {item.parts.map((part, i) => (
            <MessagePart key={i} part={part} onOpen={onOpen} />
          ))}
        </ChatMessage>
      );
  }
}

// Main component

export default function AIChatConversationTemplate({
  view: raw,
  send,
}: TemplateProps) {
  const view = raw as View;
  const {composer, artifact} = view;
  const rootRef = useRef<HTMLElement>(null);
  const artifactResize = useResizable({
    defaultSize: 640,
    minSize: 480,
    maxSize: 960,
    autoSaveId: 'ai-chat-artifact-panel',
  });
  const setDialogOpen = (open: boolean) =>
    send({type: 'set', id: 'tpl.chat.dialog', value: open});

  // Match the container-query breakpoint by measuring the root, not the viewport.
  const openArtifact = () => {
    const width = rootRef.current?.offsetWidth ?? Infinity;
    send({
      type: 'press',
      id:
        width <= MOBILE_MAX_WIDTH
          ? 'tpl.chat.openArtifact:dialog'
          : 'tpl.chat.openArtifact:panel',
    });
  };

  return (
    <VStack ref={rootRef} style={root}>
      <style>{AI_CHAT_CSS}</style>
      <Layout
        height="fill"
        content={
          <LayoutContent padding={0}>
            <HStack height="100%">
              {/* Chat column — flexes to fill the space the artifact leaves */}
              <VStack style={chatColumn}>
                <ChatLayout
                  density="spacious"
                  style={chatLayout}
                  composer={
                    <ChatComposer
                      onSubmit={() => send({type: 'press', id: 'tpl.chat.send'})}
                      value={composer.draft}
                      onChange={value =>
                        send({type: 'set', id: 'tpl.chat.draft', value})
                      }
                      placeholder={composer.placeholder}
                      input={<ChatComposerInput />}
                      headerActions={
                        <>
                          <Button
                            label="Mention"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={AtSymbolIcon} size="sm" />}
                            isIconOnly
                          />
                          <Button
                            label="Attach"
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={PaperClipIcon} size="sm" />}
                            isIconOnly
                          />
                        </>
                      }
                      footerActions={
                        <DropdownMenu
                          button={{
                            label: composer.modeLabel,
                            variant: 'ghost',
                            size: 'sm',
                          }}
                          items={composer.modes.map(mode => ({
                            label: mode.label,
                            onClick: () =>
                              send({
                                type: 'set',
                                id: 'tpl.chat.mode',
                                value: mode.id,
                              }),
                          }))}
                        />
                      }
                    />
                  }>
                  <ChatMessageList>
                    {view.items.map((item, i) => (
                      <Item key={i} item={item} onOpen={openArtifact} />
                    ))}
                  </ChatMessageList>
                </ChatLayout>
              </VStack>

              {/* Desktop split-pane: resize handle + artifact panel */}
              {artifact.panelOpen && (
                <>
                  <ResizeHandle
                    direction="horizontal"
                    resizable={artifactResize.props}
                    isReversed
                    pillPlacement="start"
                    hasDivider
                    label="Resize artifact panel"
                    className="ai-chat-resize-handle"
                  />

                  {/* Toolbar as the card header, body below */}
                  <Card
                    variant="transparent"
                    height="100%"
                    className="ai-chat-artifact-panel"
                    style={artifactPanelWidthVar(artifactResize.size)}>
                    <Toolbar
                      label="Artifact actions"
                      dividers={['bottom']}
                      startContent={
                        <HStack gap={3} vAlign="center">
                          <Icon
                            icon={DocumentTextIcon}
                            size="sm"
                            color="secondary"
                          />
                          <VStack gap={0}>
                            <Text type="label" weight="semibold">
                              {artifact.title}
                            </Text>
                            <Text type="supporting" color="secondary">
                              {artifact.subtitle}
                            </Text>
                          </VStack>
                        </HStack>
                      }
                      endContent={
                        <ArtifactActions
                          versions={artifact.versions}
                          onClose={() =>
                            send({type: 'press', id: 'tpl.chat.closeArtifact'})
                          }
                        />
                      }
                    />

                    <ArtifactBody artifact={artifact} />
                  </Card>
                </>
              )}
            </HStack>
          </LayoutContent>
        }
      />
      {/* Mobile artifact view — full-screen Dialog */}
      <Dialog
        isOpen={artifact.dialogOpen}
        onOpenChange={setDialogOpen}
        purpose="info"
        variant="fullscreen">
        <Layout
          header={
            <DialogHeader
              title={artifact.title}
              subtitle={artifact.subtitle}
              hasDivider
              onOpenChange={setDialogOpen}
              endContent={<MobileArtifactActions versions={artifact.versions} />}
            />
          }
          content={
            <LayoutContent padding={0}>
              <ArtifactBody artifact={artifact} />
            </LayoutContent>
          }
        />
      </Dialog>
    </VStack>
  );
}
