(function () {
  // Single source of truth for site config.
  // Exposed globally as window.CAPI_CONFIG for plain JS modules.

  const CFG = {
    TOKEN_SYMBOL_EXPECTED: "CAPI",
    TOKEN_DECIMALS_EXPECTED: 18,

    // Ownership renounce countdown (fixed to GMT-4 moment)
    // 17-Apr-2026 19:17 GMT-4 == 2026-04-17T23:17:00Z
    renounce: {
      targetUtcIso: "2026-04-17T23:17:00Z",
      label: "RENOUNCE IN:",
      labelDone: "RENOUNCED ✅",
    },

    // Official CAPI token contract (Ethereum Mainnet)
    CONTRACT_ADDRESS: "0xF2dA6C9B945c688A52D3B72340E622014920de6a",

    // Genesis Council (ERC-721) – dynamic eligibility portal (pre-mint stage)
    genesisNft: {
      enabled: true,
      standard: "ERC-721",
      maxSupply: 7000,
      maxPerWallet: 1,

      // Eligibility threshold (whole tokens, decimals handled in JS)
      minCapiBalance: 150000000,

      // Mint window (UI only for now)
      mintClosesUtcIso: "2026-04-17T23:17:00Z",

      // Relative paths (work in staging + production)
      metadataJsonPath: "/genesis/metadata/1.json",
      imagePath: "/genesis/images/genesis.png",

      // After NFT deployment, set here (keep empty until then)
      nftContractAddress: "0x63f818ae9890A73B75Eb978063Ff9F4157e4B587",
    },

    // Read-only RPC fallback (no wallet needed)
    rpcFallback: {
      // Cloudflare Ethereum Gateway (rate-limited but good as fallback)
      http: "https://cloudflare-eth.com",
    },
  };

  window.CAPI_CONFIG = CFG;
})();
