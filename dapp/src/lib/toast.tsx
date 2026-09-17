/**
 * Notifications. One component, three tones, and a progress handle which
 * turns into the result instead of stacking toasts.
 */
import type { ReactElement } from "react";
import { toast } from "sonner";

import { Toast } from "@/components/Toast";

import { explorerUrl } from "./config";
import type { Executed } from "./tx";
import { errorMessage, isCancelled } from "./utils";

interface SuccessOptions {
  detail?: string;
  /** Links the transaction on the explorer. */
  tx?: Executed<unknown>;
}

interface FailureOptions {
  onRetry?: () => void;
}

function rawError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function txDetail(tx: Executed<unknown> | undefined) {
  if (!tx?.hash) return {};
  return {
    detail: tx.ledger ? `Confirmed in ledger ${tx.ledger}` : "Confirmed",
    link: { href: explorerUrl("tx", tx.hash), label: "View transaction" },
  };
}

function show(
  id: string | number | undefined,
  render: (dismiss: () => void) => ReactElement,
  duration: number,
) {
  return toast.custom((toastId) => render(() => toast.dismiss(toastId)), {
    id,
    duration,
  });
}

export const notify = {
  success(title: string, options: SuccessOptions = {}, id?: string | number) {
    return show(
      id,
      (dismiss) => (
        <Toast
          tone="success"
          title={title}
          detail={options.detail}
          onDismiss={dismiss}
          {...txDetail(options.tx)}
        />
      ),
      6000,
    );
  },

  /** Silent when the user cancelled in the wallet. */
  failure(
    title: string,
    error: unknown,
    options: FailureOptions = {},
    id?: string | number,
  ) {
    if (isCancelled(error)) {
      if (id !== undefined) toast.dismiss(id);
      return id;
    }
    return show(
      id,
      (dismiss) => (
        <Toast
          tone="failure"
          title={title}
          detail={errorMessage(error)}
          raw={rawError(error)}
          action={
            options.onRetry && {
              label: "Try again",
              onClick: () => {
                dismiss();
                options.onRetry?.();
              },
            }
          }
          onDismiss={dismiss}
        />
      ),
      12000,
    );
  },

  info(
    title: string,
    detail?: string,
    action?: { label: string; onClick: () => void },
  ) {
    return show(
      undefined,
      (dismiss) => (
        <Toast
          tone="info"
          title={title}
          detail={detail}
          action={action}
          onDismiss={dismiss}
        />
      ),
      action ? Infinity : 5000,
    );
  },

  /** A toast which follows an action and becomes its outcome. */
  progress(title: string, detail?: string) {
    const id = show(
      undefined,
      () => <Toast tone="progress" title={title} detail={detail} />,
      Infinity,
    );
    return {
      update: (detail: string) =>
        show(
          id,
          () => <Toast tone="progress" title={title} detail={detail} />,
          Infinity,
        ),
      success: (title: string, options?: SuccessOptions) =>
        notify.success(title, options, id),
      failure: (title: string, error: unknown, options?: FailureOptions) =>
        notify.failure(title, error, options, id),
      dismiss: () => toast.dismiss(id),
    };
  },
};
