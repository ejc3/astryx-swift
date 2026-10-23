import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Spinner } from "@astryxdesign/core/Spinner";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import type { AppSnapshot } from "@astryx-native/core";
import { press } from "./client.ts";
import { ButtonView } from "./render/controls.tsx";
import { DOT } from "./render/text.tsx";

/**
 * The account at the foot of the nav (core/src/account.ts): "Sign in to sync" when signed out, and
 * when signed in the email and the sync status, with Sign out in a menu (the core asks to confirm).
 * Every word is the core's; nothing is drawn when sign-in is off.
 */
export function AccountPanel({ account }: { account: AppSnapshot["account"] }) {
  if (!account.available) return null;
  if (account.state === "signing-in") {
    return (
      <div className="an-account" aria-live="polite">
        <div className="an-account-row">
          <Spinner size="sm" aria-label={account.title} />
          <span className="an-account-text">
            <Text weight="medium">{account.title}</Text>
            <Text type="supporting" size="xsm">{account.detail}</Text>
          </span>
        </div>
      </div>
    );
  }
  if (account.state === "signed-out") {
    return (
      <div className="an-account">
        <Text type="supporting" size="xsm">{account.detail}</Text>
        {account.signIn ? <ButtonView node={account.signIn} size="sm" /> : null}
      </div>
    );
  }
  const items = [account.signIn, account.signOut].flatMap((b) => (b ? [{ id: b.id, label: b.label, onClick: () => press(b.id) }] : []));
  const status = account.status;
  return (
    <div className="an-account">
      <DropdownMenu
        placement="above"
        hasChevron={false}
        items={items}
        renderTrigger={(trigger) => (
          <button type="button" className="an-account-row an-account-button" aria-label={account.accessibilityLabel} {...trigger}>
            {status ? <StatusDot variant={DOT[status.tone]} label={status.text} /> : null}
            <span className="an-account-text">
              <Text weight="medium" maxLines={1}>{account.title}</Text>
              <Text type="supporting" size="xsm">{account.detail}</Text>
            </span>
          </button>
        )}
      />
    </div>
  );
}
