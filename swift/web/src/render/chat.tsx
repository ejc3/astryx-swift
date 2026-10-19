import { ChatComposer, ChatLayout, ChatMessage, ChatMessageBubble, ChatMessageList, ChatMessageMetadata } from "@astryxdesign/core/Chat";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import type { Node } from "@astryx-native/core";
import { press, set } from "../client.ts";
import { Ic } from "../icons.tsx";
import { PersonAvatar } from "./Avatar.tsx";

type Of<K extends Node["kind"]> = Extract<Node, { kind: K }>;

export function ChatNode({ node }: { node: Of<"chat"> }) {
  const { composer } = node;
  const send = () => { if (composer.canSend) press(composer.sendId); };
  return (
    <div className="an-chat">
      <ChatLayout
        composer={
          <ChatComposer
            value={composer.value}
            placeholder={composer.placeholder}
            onChange={(v) => set(composer.id, v)}
            onSubmit={send}
            sendButton={
              <IconButton variant="primary" label={composer.sendLabel} tooltip={composer.sendLabel} isDisabled={!composer.canSend} icon={<Ic name="send" />} onClick={send} />
            }
          />
        }
      >
        <ChatMessageList>
          {node.messages.map((m) => (
            <ChatMessage
              key={m.id}
              sender={m.mine ? "user" : "assistant"}
              avatar={<PersonAvatar initials={m.initials} hue={m.hue} name={m.author} />}
              name={m.author}
              metadata={<ChatMessageMetadata timestamp={m.time} />}
            >
              <ChatMessageBubble><Text>{m.text}</Text></ChatMessageBubble>
            </ChatMessage>
          ))}
        </ChatMessageList>
      </ChatLayout>
    </div>
  );
}
