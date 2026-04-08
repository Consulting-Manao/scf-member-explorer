// Change these values to switch between testnet and mainnet
export const NETWORK = "testnet" as const;

export const CONTRACT_ADDRESS = "CAKFPHWM6PGD5QQXMYFQ6X4BB62KO3E4VXC5MY4O2QQ65AUAFPYVOCJN";

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
