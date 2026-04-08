// Change these values to switch between testnet and mainnet
export const NETWORK = "testnet" as const;

export const CONTRACT_ADDRESS = "CCB5WS2RRUNKEY7CHBX52ILKX4SH3BRNGQ3PWUWQZ43FXKIZGUCFTIDN";

export const RPC_URL =
  NETWORK === "testnet"
    ? "https://soroban-testnet.stellar.org"
    : "https://soroban.stellar.org";

export const NETWORK_PASSPHRASE =
  NETWORK === "testnet"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

export const EXPLORER_URL =
  NETWORK === "testnet"
    ? "https://stellar.expert/explorer/testnet"
    : "https://stellar.expert/explorer/public";
