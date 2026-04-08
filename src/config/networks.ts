// Change these values to switch between testnet and mainnet
export const NETWORK = "testnet" as const;

export const CONTRACT_ADDRESS = "CATJ45GRCHCTXLR4H2GKTUW7L5CBCKYO6P3PTRLHPASBIVT3BESZ37WN";

export const RPC_URL = NETWORK === "testnet" ? "https://soroban-testnet.stellar.org" : "https://soroban.stellar.org";

export const NETWORK_PASSPHRASE =
  NETWORK === "testnet" ? "Test SDF Network ; September 2015" : "Public Global Stellar Network ; September 2015";

export const EXPLORER_URL =
  NETWORK === "testnet" ? "https://stellar.expert/explorer/testnet" : "https://stellar.expert/explorer/public";
