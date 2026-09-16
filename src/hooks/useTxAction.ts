import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { useState } from "react";

import { notify } from "@/lib/toast";
import {
  execute,
  type Executed,
  type ExecuteOptions,
  type Step,
} from "@/lib/tx";
import { useWallet } from "@/lib/wallet";
import { useInvalidateMembers } from "@/queries/members";

type Options = Omit<ExecuteOptions, "signTransaction"> & {
  /** Members whose cached record the transaction changed. */
  touched: number[];
};

/**
 * Signs and submits a contract call with the connected wallet, then
 * refreshes the members it touched. `perform` throws, for callers which
 * show the outcome themselves; `run` notifies, with a retry.
 */
export function useTxAction() {
  const { signTransaction } = useWallet();
  const invalidate = useInvalidateMembers();
  const [step, setStep] = useState<Step | null>(null);

  const perform = async <T>(
    tx: AssembledTransaction<T>,
    { touched, onStep, ...options }: Options,
  ): Promise<Executed<T>> => {
    setStep("sign");
    try {
      const sent = await execute(tx, {
        ...options,
        signTransaction,
        onStep: (current) => {
          setStep(current);
          onStep?.(current);
        },
      });
      await invalidate(touched);
      return sent;
    } finally {
      setStep(null);
    }
  };

  const run = async <T>(
    build: () => Promise<AssembledTransaction<T>>,
    options: Options & { done: string; failed: string },
  ): Promise<Executed<T> | null> => {
    try {
      const sent = await perform(await build(), options);
      notify.success(options.done, { tx: sent });
      return sent;
    } catch (error) {
      notify.failure(options.failed, error, {
        onRetry: () => void run(build, options),
      });
      return null;
    }
  };

  return { step, busy: step !== null, perform, run };
}
