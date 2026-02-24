(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    connectBtn: $("gcConnectBtn"),
    refreshBtn: $("gcRefreshBtn"),
    switchBtn: $("gcSwitchBtn"),

    mintBtn: $("gcMintBtn"),
    mintHint: $("gcMintHint"),

    walletRow: $("gcWalletRow"),
    wallet: $("gcWallet"),
    netText: $("gcNetText"),
    netHint: $("gcNetHint"),

    countdownText: $("gcCountdownText"),
    closeUtc: $("gcCloseUtc"),

    required: $("gcRequired"),
    balance: $("gcBalance"),
    shortBy: $("gcShortBy"),

    statusText: $("gcStatusText"),
    nftAddr: $("gcNftAddr"),
  };

  const ETH_MAINNET_CHAIN_ID = "0x1";

  // -------- helpers --------
  function hasEthereum() {
    return typeof window !== "undefined" && window.ethereum && window.ethereum.request;
  }

  function setStatus(msg) {
    if (els.statusText) els.statusText.textContent = msg;
  }

  function commaInt(s) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatUnits(valueWeiBigInt, decimals) {
    const neg = valueWeiBigInt < 0n;
    let v = neg ? -valueWeiBigInt : valueWeiBigInt;

    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = v % base;

    let fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
    fracStr = fracStr.replace(/0+$/, "");

    const wholeStr = commaInt(whole.toString());
    const out = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
    return neg ? `-${out}` : out;
  }

  function encodeBalanceOf(address) {
    const selector = "70a08231"; // balanceOf(address)
    const addr = address.toLowerCase().replace(/^0x/, "");
    const padded = addr.padStart(64, "0");
    return "0x" + selector + padded;
  }

  function hexToBigInt(hex) {
    if (!hex) return 0n;
    return BigInt(hex);
  }

  async function getChainId() {
    return await window.ethereum.request({ method: "eth_chainId" });
  }

  async function getAccounts() {
    return await window.ethereum.request({ method: "eth_accounts" });
  }

  async function requestAccounts() {
    return await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  async function switchToEthereumMainnet() {
    return await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETH_MAINNET_CHAIN_ID }],
    });
  }

  async function ethCallViaWallet(to, data) {
    return await window.ethereum.request({
      method: "eth_call",
      params: [{ to, data }, "latest"],
    });
  }

  async function ethCallViaRpcHttp(rpcUrl, to, data) {
    if (!rpcUrl) throw new Error("RPC_HTTP not configured");
    const body = { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] };
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("RPC HTTP " + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "RPC error");
    return json.result;
  }

  // ✅ Read config LIVE (at time of action), not at file load.
  function getLiveConfig() {
    const CFG = window.CAPI_CONFIG || {};
    const G = CFG.genesisNft || {};

    const tokenAddrRaw =
      CFG.CONTRACT_ADDRESS ||
      CFG.CAPI_CONTRACT_ADDRESS ||
      CFG.TOKEN_CONTRACT_ADDRESS ||
      CFG.TOKEN_ADDRESS ||
      CFG.CAPI_ADDRESS ||
      "";

    return {
      CFG,
      G,
      TOKEN_ADDR: String(tokenAddrRaw).trim().toLowerCase(),
      RPC_HTTP: String(CFG.RPC_HTTP || "").trim(),
      DECIMALS: Number(CFG.TOKEN_DECIMALS_EXPECTED ?? 18),
      REQUIRED_CAPI: BigInt(G.minCapiBalance ?? 150000000),
      CLOSE_ISO: String(G.mintClosesUtcIso || "2026-04-17T23:17:00Z"),
      NFT_ADDR: String(G.nftContractAddress || "").trim(),
    };
  }

  function setNftAddr(nftAddr) {
    if (!els.nftAddr) return;
    if (nftAddr && /^0x[a-fA-F0-9]{40}$/.test(nftAddr)) els.nftAddr.textContent = nftAddr;
    else els.nftAddr.textContent = "TBA";
  }

  function setRequiredText(requiredCapi) {
    if (!els.required) return;
    els.required.textContent = `≥ ${commaInt(requiredCapi.toString())} CAPI`;
  }

  function setMintState({ connected, eligible, nftAddrOk }) {
    if (!els.mintBtn || !els.mintHint) return;

    if (!connected) {
      els.mintBtn.disabled = true;
      els.mintBtn.textContent = "Mint (coming soon)";
      els.mintHint.textContent = "Connect wallet to check eligibility.";
      return;
    }
    if (!eligible) {
      els.mintBtn.disabled = true;
      els.mintBtn.textContent = "Mint (locked)";
      els.mintHint.textContent = "Not eligible yet — reach the required CAPI balance.";
      return;
    }
    if (!nftAddrOk) {
      els.mintBtn.disabled = true;
      els.mintBtn.textContent = "Mint (coming soon)";
      els.mintHint.textContent = "Eligible ✅ Mint opens when the official NFT contract is deployed.";
      return;
    }
    els.mintBtn.disabled = true;
    els.mintBtn.textContent = "Mint (coming soon)";
    els.mintHint.textContent = "Eligible ✅ Mint UI will activate here after contract deployment.";
  }

  function updateCountdown(closeIso) {
    try {
      const end = new Date(closeIso).getTime();
      if (Number.isNaN(end)) {
        if (els.countdownText) els.countdownText.textContent = "—";
        if (els.closeUtc) els.closeUtc.textContent = "—";
        return;
      }
      if (els.closeUtc) els.closeUtc.textContent = closeIso;

      const now = Date.now();
      let diff = Math.max(0, end - now);

      const sec = Math.floor(diff / 1000);
      const days = Math.floor(sec / 86400);
      const hrs = Math.floor((sec % 86400) / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const s = sec % 60;

      const pad2 = (n) => String(n).padStart(2, "0");
      if (els.countdownText) els.countdownText.textContent = `${days}d ${pad2(hrs)}h ${pad2(mins)}m ${pad2(s)}s`;
    } catch (_) {}
  }

  async function refreshStatus(wallet) {
    const { TOKEN_ADDR, RPC_HTTP, DECIMALS, REQUIRED_CAPI, CLOSE_ISO, NFT_ADDR } = getLiveConfig();

    // Keep UI always synced with live config
    setRequiredText(REQUIRED_CAPI);
    setNftAddr(NFT_ADDR);
    updateCountdown(CLOSE_ISO);

    const nftAddrOk = !!(NFT_ADDR && /^0x[a-fA-F0-9]{40}$/.test(NFT_ADDR));

    // Validate token contract address
    if (!/^0x[a-fA-F0-9]{40}$/.test(TOKEN_ADDR)) {
      setStatus("Config error: token contract address is missing/invalid.");
      if (els.netHint) {
        els.netHint.textContent =
          "Fix capi-config.js: set CONTRACT_ADDRESS to the official CAPI token contract (0x...).";
      }
      if (els.balance) els.balance.textContent = "—";
      if (els.shortBy) els.shortBy.textContent = "—";
      setMintState({ connected: true, eligible: false, nftAddrOk });
      return;
    }

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      if (els.balance) els.balance.textContent = "—";
      if (els.shortBy) els.shortBy.textContent = "—";
      if (els.walletRow) els.walletRow.style.display = "none";
      if (els.refreshBtn) els.refreshBtn.disabled = true;
      if (els.switchBtn) els.switchBtn.style.display = "none";
      setStatus("Connect wallet to check eligibility.");
      setMintState({ connected: false, eligible: false, nftAddrOk });
      return;
    }

    if (els.walletRow) els.walletRow.style.display = "";
    if (els.refreshBtn) els.refreshBtn.disabled = false;

    let chainId = "unknown";
    try {
      chainId = await getChainId();
      if (els.netText) els.netText.textContent = chainId === "0x1" ? "Ethereum Mainnet" : `Wrong network (${chainId})`;
    } catch (_) {}

    const wrongNetwork = chainId !== ETH_MAINNET_CHAIN_ID;
    if (els.switchBtn) els.switchBtn.style.display = wrongNetwork ? "" : "none";
    if (els.netHint) {
      els.netHint.textContent = wrongNetwork
        ? "You are not on Ethereum Mainnet. Click “Switch to Ethereum”. (RPC fallback can still read balance.)"
        : "";
    }

    const data = encodeBalanceOf(wallet);

    let hex = null;
    let used = "";

    // Try wallet eth_call first
    try {
      hex = await ethCallViaWallet(TOKEN_ADDR, data);
      used = "wallet";
    } catch (_) {}

    // Fallback RPC (read-only)
    if (!hex) {
      try {
        hex = await ethCallViaRpcHttp(RPC_HTTP, TOKEN_ADDR, data);
        used = "rpc";
      } catch (_) {
        setStatus("Could not read on-chain balance. Check wallet/network and try again. (RPC may be blocked)");
        setMintState({ connected: true, eligible: false, nftAddrOk });
        return;
      }
    }

    const balWei = hexToBigInt(hex);
    const reqWei = REQUIRED_CAPI * (10n ** BigInt(DECIMALS));
    const eligible = balWei >= reqWei;

    if (els.balance) els.balance.textContent = `${formatUnits(balWei, DECIMALS)} CAPI`;
    if (els.shortBy) {
      const shortWei = reqWei > balWei ? reqWei - balWei : 0n;
      els.shortBy.textContent = eligible ? "0 CAPI" : `${formatUnits(shortWei, DECIMALS)} CAPI`;
    }

    setStatus(eligible ? `Eligible ✅ (read via ${used})` : `Not eligible yet ❌ (read via ${used})`);
    setMintState({ connected: true, eligible, nftAddrOk });
  }

  async function init() {
    // Start countdown with live config
    const { CLOSE_ISO } = getLiveConfig();
    updateCountdown(CLOSE_ISO);
    setInterval(() => {
      const { CLOSE_ISO: iso } = getLiveConfig();
      updateCountdown(iso);
    }, 1000);

    // Initial UI sync
    const { REQUIRED_CAPI, NFT_ADDR } = getLiveConfig();
    setRequiredText(REQUIRED_CAPI);
    setNftAddr(NFT_ADDR);

    if (!hasEthereum()) {
      setStatus("No wallet detected. Install MetaMask to check eligibility.");
      if (els.connectBtn) els.connectBtn.disabled = true;
      return;
    }

    let accounts = [];
    try {
      accounts = await getAccounts();
    } catch (_) {}

    if (accounts && accounts[0]) {
      if (els.wallet) els.wallet.textContent = accounts[0];
      if (els.walletRow) els.walletRow.style.display = "";
      setStatus("Wallet connected. Reading on-chain balance…");
      await refreshStatus(accounts[0]);
    } else {
      setStatus("Connect wallet to check eligibility.");
      setMintState({ connected: false, eligible: false, nftAddrOk: false });
    }

    if (els.connectBtn) {
      els.connectBtn.addEventListener("click", async () => {
        try {
          const accs = await requestAccounts();
          const wallet = accs && accs[0];
          if (wallet) {
            if (els.wallet) els.wallet.textContent = wallet;
            if (els.walletRow) els.walletRow.style.display = "";
            setStatus("Wallet connected. Reading on-chain balance…");
            await refreshStatus(wallet);
          }
        } catch (_) {
          setStatus("Wallet connection cancelled.");
        }
      });
    }

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener("click", async () => {
        try {
          const accs = await getAccounts();
          const wallet = accs && accs[0];
          setStatus("Refreshing on-chain balance…");
          await refreshStatus(wallet);
        } catch (_) {
          setStatus("Could not refresh. Try reconnecting your wallet.");
        }
      });
    }

    if (els.switchBtn) {
      els.switchBtn.addEventListener("click", async () => {
        try {
          await switchToEthereumMainnet();
          const accs = await getAccounts();
          const wallet = accs && accs[0];
          setStatus("Switched network. Refreshing…");
          await refreshStatus(wallet);
        } catch (_) {
          setStatus("Network switch cancelled.");
        }
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();