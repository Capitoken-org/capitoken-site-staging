// STAGING_SOCIALS_UPDATED 2026-01-27 21:16 UTC
// Capitoken runtime config (public)
// Load this in the browser BEFORE trust-engine/market-engine.
// You only need to edit RPC_HTTP.

(function () {
  const CFG = {
  // Etherscan (optional) — used for holders count. Leave blank to disable holders.
  // IMPORTANT: never expose API keys in client-side JS.
  // Pulse runs in free mode; Etherscan is used only as an external link.
  ETHERSCAN_API_KEY: '',
  // UI label for Pulse Stage
  PULSE_STAGE_LABEL: 'Live (Early)',

    // Ethereum mainnet
    CHAIN_ID_HEX: '0x1',

    // ✅ Put your Alchemy HTTP URL here (client-side key)
    RPC_HTTP: 'https://eth-mainnet.g.alchemy.com/v2/alcht_3m8w8aRpitNPLBNJjgUCaLM91pUrB2',

    // Verified token contract (mainnet)
    CONTRACT_ADDRESS: '0xF2dA6C9B945c688A52D3B72340E622014920de6a',

    // Uniswap V2 pair (CAPI/WETH)
    // This is NOT Etherscan; it is the PAIR address (the pool contract).
    DEX_PAIR_ADDRESS: '0xb96808b1270A89eA8A237d52df389619f347AeA2',

    // Pulse Baseline (Global)
    // Launch price observed on DexScreener at initial activity (used as a fixed baseline).
    PULSE_BASELINE_USD: 0.000000006676,
    PULSE_BASELINE_CAPTURED_AT: '2026-01-14T00:00:00Z',

    // DexScreener (live stats for "CAPI Pulse")
    DEXSCREENER: {
      apiBase: 'https://api.dexscreener.com/latest/dex/pairs',
      chain: 'ethereum',
      pair: '0xb96808b1270A89eA8A237d52df389619f347AeA2',
      pollMs: 30000,   // refresh interval (30s)
      timeoutMs: 6500, // network timeout for fetch
    },

    // Optional sanity checks
    TOKEN_SYMBOL_EXPECTED: 'CAPI',
    TOKEN_DECIMALS_EXPECTED: 18,

    // Ownership renounce countdown (fixed to GMT-4 moment)
    // 17-Apr-2026 19:17 GMT-4 == 2026-04-17T23:17:00Z
    renounce: {
      targetUtcIso: '2026-04-17T23:17:00Z',
      label: 'RENOUNCE IN:',
      labelDone: 'RENOUNCED ✅',
    },

    // Genesis Council NFT (Phase: optional community layer)
    // NOTE: Mint closes permanently at the same instant as token ownership renounce.
    genesisNft: {
      enabled: true,
      name: 'CAPI Genesis Council',
      symbol: 'CAPI-GEN',
      maxSupply: 7000,
      maxPerWallet: 1,
      minCapiBalance: 150000000, // 150,000,000 CAPI (display value; on-chain checks use 18 decimals)
      mintClosesUtcIso: '2026-04-17T23:17:00Z',
      contractAddress: '', // set once deployed
      metadataUrl: 'https://capitoken.org/genesis/metadata/1.json',
      imageUrl: 'https://capitoken.org/genesis/images/genesis.png',
      pagePath: '/genesis/',
    },

    // Optional helper token addresses (mainnet)
    TOKENS: {
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    // Official social links (leave empty string if not available yet)
    // Community panel (Telegram + first-party updates)
    TELEGRAM_CHANNEL: 'capitoken_official',
    TELEGRAM_PINNED_POST_ID: '13',
    ANNOUNCEMENTS_GIST_URL: 'https://gist.githubusercontent.com/Capitoken-org/fb30847eaea89c2c1861ebcca5f21f77/raw/fd6ee70e93095e4b54e30c63d637189da3cc6b9b/announcements.json',

    SOCIALS: {
  x: "https://x.com/Capitokenorg",
  telegram: "https://t.me/CapitokenOfficial",
  youtube: "https://www.youtube.com/channel/UCY5xCVzo-k6hGdR4xhUhTNQ",
  medium: "https://medium.com/@info_43649",
  reddit: "https://www.reddit.com/user/CapiToken/",
  tiktok: "https://www.tiktok.com/@capitoken.official",
  facebook: "https://www.facebook.com/Capitoken.official/",
  instagram: "https://www.instagram.com/capitoken.official/",
	  discord: "https://discord.gg/XVHVaVWPq5"
},
  };

  // Public config objects used by the engines
  window.CAPI_CONFIG = CFG;
  // Back-compat for older code paths
  window.CAPI_RPC_HTTP = window.CAPI_RPC_HTTP || CFG.RPC_HTTP;
})();