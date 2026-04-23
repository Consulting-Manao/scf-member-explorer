import { Account, Contract, Keypair, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import { NETWORK_PASSPHRASE, RPC_URL } from "@/config/networks";

const server = new Server(RPC_URL);

/**
 * Read-only Soroban contract invocation via simulateTransaction.
 *
 * Uses a throwaway keypair — no signing, no fee, no on-chain side effects.
 * Returns the raw `xdr.ScVal` so callers can apply their own `scValToNative`
 * conversions and domain-specific normalization.
 */
export async function simulate(
  contractAddress: string,
  method: string,
  ...args: xdr.ScVal[]
): Promise<xdr.ScVal> {
  const keypair = Keypair.random();
  const account = new Account(keypair.publicKey(), "0");
  const contract = new Contract(contractAddress);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(tx);

  if (Api.isSimulationError(response)) {
    console.error("Soroban simulation error", { contractAddress, method, error: response.error });
    throw new Error("Contract call failed");
  }

  if (!Api.isSimulationSuccess(response)) {
    console.error("Soroban simulation did not succeed", { contractAddress, method, response });
    throw new Error("Contract call failed");
  }

  return response.result!.retval;
}
