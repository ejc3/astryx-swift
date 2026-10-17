import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Toast } from "@astryxdesign/core/Toast";
import { useEffect, useRef } from "react";
import type { AppSnapshot } from "@astryx-native/core";
import { press, send } from "./client.ts";
import { Ic } from "./icons.tsx";

const TOAST_MS = 4000;

const TOAST_ICON = { success: "check", danger: "warning", warning: "warning", info: "info", accent: "sparkle", neutral: "info" } as const;

export function Overlays({ app }: { app: AppSnapshot }) {
  const { toast, dialog } = app;
  // The core owns the toast; the host only times it out.
  const toastId = toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const t = setTimeout(() => send({ type: "dismissToast" }), TOAST_MS);
    return () => clearTimeout(t);
  }, [toastId]);

  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const action = toast?.action;

  return (
    <>
      {toast ? (
        <div className="an-toast" key={toast.id}>
          <Toast
            type={toast.tone === "danger" ? "error" : "info"}
            isAutoHide={false}
            autoHideDuration={TOAST_MS}
            onDismiss={() => send({ type: "dismissToast" })}
            body={
              <HStack gap={2} align="center">
                <Ic name={TOAST_ICON[toast.tone]} color="inherit" />
                <Text color="inherit">{toast.text}</Text>
              </HStack>
            }
            {...(action ? { endContent: <Button size="sm" variant="ghost" label={action.label} onClick={() => press(action.id)} /> } : {})}
          />
        </div>
      ) : null}
      {dialog ? (
        <AlertDialog
          isOpen
          title={dialog.title}
          description={dialog.text}
          cancelLabel={dialog.cancel.label}
          actionLabel={dialog.confirm.label}
          actionVariant={dialog.confirm.variant === "destructive" ? "destructive" : "primary"}
          onAction={() => press(dialog.confirm.id)}
          onOpenChange={(open) => { if (!open && dialogRef.current) press(dialog.cancel.id); }}
        />
      ) : null}
    </>
  );
}
