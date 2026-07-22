/**
 * Cross-platform confirm / notify dialogs.
 *
 * `Alert` from react-native is a no-op stub in react-native-web:
 *
 *     class Alert { static alert() {} }
 *
 * so any screen that gates an action behind `Alert.alert(..., [buttons])`
 * silently does nothing in the browser — the button just looks broken. These
 * helpers keep the native look on iOS/Android and fall back to the DOM dialogs
 * on web.
 */
import { Alert, Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the confirming button (default "OK"). */
  confirmText?: string;
  /** Label of the dismissing button (default "Bekor qilish"). */
  cancelText?: string;
  /** Renders the confirm button in red on native. */
  destructive?: boolean;
};

/** Ask the user to confirm an action. Resolves `true` when they accept. */
export function confirmAsync({
  title,
  message,
  confirmText = "OK",
  cancelText = "Bekor qilish",
  destructive,
}: ConfirmOptions): Promise<boolean> {
  if (IS_WEB) {
    const text = message ? `${title}\n\n${message}` : title;
    // Sandboxed frames can strip `confirm`; proceed rather than dead-end the tap.
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(text)
        : true;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Show a plain informational / error message. */
export function notify(title: string, message?: string): void {
  if (IS_WEB) {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(text);
    } else {
      console.warn("[notify]", text);
    }
    return;
  }
  Alert.alert(title, message);
}
