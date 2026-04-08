import { Contract, TransactionBuilder, Account, xdr, Keypair, Address, scValToNative } from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { TANSU_CONTRACT_ADDRESS, RPC_URL, NETWORK_PASSPHRASE } from "@/config/networks";
import { fetchMemberMeta, type MemberProfile } from "./ipfs";

const server = new Server(RPC_URL);
const contract = new Contract(TANSU_CONTRACT_ADDRESS);

async function simulateCall(method: string, ...args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const keypair = Keypair.random();
  const account = new Account(keypair.publicKey(), "0");

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(tx);

  if (Api.isSimulationError(response)) {
    throw new Error(`Simulation error: ${response.error}`);
  }

  if (!Api.isSimulationSuccess(response)) {
    throw new Error("Simulation failed");
  }

  return response.result!.retval;
}

export async function getMember(ownerAddress: string): Promise<{ meta: string } | null> {
  try {
    const result = await simulateCall(
      "get_member",
      new Address(ownerAddress).toScVal()
    );
    const raw = scValToNative(result);
    if (!raw || typeof raw !== "object") return null;

    // raw could be a Map or plain object
    let meta = "";
    if (raw instanceof Map) {
      meta = String(raw.get("meta") ?? "");
    } else {
      meta = String((raw as Record<string, unknown>).meta ?? "");
    }

    return meta ? { meta } : null;
  } catch {
    return null;
  }
}

export async function fetchMemberProfile(ownerAddress: string): Promise<MemberProfile | null> {
  try {
    const member = await getMember(ownerAddress);
    if (!member?.meta) return null;

    const profile = await fetchMemberMeta(member.meta);
    return profile;
  } catch {
    return null;
  }
}
