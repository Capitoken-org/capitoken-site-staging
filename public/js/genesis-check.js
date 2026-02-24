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

  const CFG = window.CAPI_CONFIG || {};
  const G = CFG.genesisNft || {};

  // ✅ Robust token address detection (supports multiple key names)
  const tokenAddrRaw =
    CFG.CONTRACT_ADDRESS ||
    CFG.CAPI_CONTRACT_ADDRESS ||
    CFG.TOKEN_CONTRACT_ADDRESS ||
    CFG.TOKEN_ADDRESS ||
    CFG.CAPI_ADDRESS ||
    "";

  const TOKEN_ADDR = String(tokenAddrRaw).trim().toLowerCase();
  const RPC_HTTP = String(CFG.RPC_HTTP || "").trim();
  const DECIMALS = Number(CFG.TOKEN_DECIMALS_EXPECTED ?? 18);

  const REQUIRED_CAPI = BigInt(G.minCapiBalance ?? 150000000);
  const CLOSE_ISO = String(G.mintClosesUtcIso || "2026-04-17T23:17:00Z");
  const NFT_ADDR = String(G.nftContractAddress || "").trim();

  const ETH_MAINNET_CHAIN_ID = "0x1";

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

  async function ethCallViaRpcHttp(to, data) {
    if (!RPC_HTTP) throw new Error("RPC_HTTP not configured");
    const body = { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] };
    const res = await fetch(RPC_HTTP, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("RPC HTTP " + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "RPC error");
    return json.result;
  }

  function updateCountdown() {
    try {
      const end = new Date(CLOSE_ISO).getTime();
      if (Number.isNaN(end)) {
        if (els.countdownText) els.countdownText.textContent = "—";
        if (els.closeUtc) els.closeUtc.textContent = "—";
        return;
      }
      if (els.closeUtc) els.closeUtc.textContent = CLOSE_ISO;

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

  function setNftAddr() {
    if (!els.nftAddr) return;
    if (NFT_ADDR && /^0x[a-fA-F0-9]{40}$/.test(NFT_ADDR)) els.nftAddr.textContent = NFT_ADDR;
    else els.nftAddr.textContent = "TBA";
  }

  function setRequiredText() {
    if (!els.required) return;
    els.required.textContent = `≥ ${commaInt(REQUIRED_CAPI.toString())} CAPI`;
  }

  function setMintState({ connected, eligible }) {
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
    els.mintBtn.disabled = true;
    els.mintBtn.textContent = "Mint (coming soon)";
    els.mintHint.textContent = "Eligible ✅ Mint will activate after the official NFT contract is deployed.";
  }

  async function refreshStatus(wallet) {
    setRequiredText();
    setNftAddr();

    // ✅ Validate token contract address
    if (!/^0x[a-fA-F0-9]{40}$/.test(TOKEN_ADDR)) {
      setStatus("Config error: token contract address is missing/invalid.");
      // Helpful hint (not too technical)
      if (els.netHint) {
        els.netHint.textContent =
          "Fix capi-config.js: set CONTRACT_ADDRESS to the official CAPI token contract (0x...).";
      }
      setMintState({ connected: true, eligible: false });
      return;
    }

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      if (els.balance) els.balance.textContent = "—";
      if (els.shortBy) els.shortBy.textContent = "—";
      if (els.walletRow) els.walletRow.style.display = "none";
      if (els.refreshBtn) els.refreshBtn.disabled = true;
      if (els.switchBtn) els.switchBtn.style.display = "none";
      setStatus("Connect wallet to check eligibility.");
      setMintState({ connected: false, eligible: false });
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

    try {
      hex = await ethCallViaWallet(TOKEN_ADDR, data);
      used = "wallet";
    } catch (_) {}

    if (!hex) {
      try {
        hex = await ethCallViaRpcHttp(TOKEN_ADDR, data);
        used = "rpc";
      } catch (_) {
        setStatus("Could not read on-chain balance. Check wallet/network and try again. (RPC may be blocked)");
        setMintState({ connected: true, eligible: false });
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
    setMintState({ connected: true, eligible });
  }

  async function init() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
    setRequiredText();
    setNftAddr();

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
      setMintState({ connected: false, eligible: false });
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