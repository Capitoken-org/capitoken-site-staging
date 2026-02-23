// Genesis Council — eligibility checker (no external libs)
// Uses window.ethereum + eth_call to read CAPI ERC-20 balanceOf(wallet).
(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    connectBtn: $("gcConnectBtn"),
    refreshBtn: $("gcRefreshBtn"),
    mintBtn: $("gcMintBtn"),
    mintHint: $("gcMintHint"),

    walletRow: $("gcWalletRow"),
    wallet: $("gcWallet"),
    netText: $("gcNetText"),

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
  const TOKEN_ADDR = (CFG.CONTRACT_ADDRESS || "").toLowerCase();
  const DECIMALS = Number(CFG.TOKEN_DECIMALS_EXPECTED ?? 18);

  const REQUIRED_CAPI = BigInt(G.minCapiBalance ?? 150000000); // whole tokens
  const CLOSE_ISO = String(G.mintClosesUtcIso || "2026-04-17T23:17:00Z");
  const NFT_ADDR = (G.nftContractAddress || "").trim();

  function hasEthereum() {
    return typeof window !== "undefined" && window.ethereum && window.ethereum.request;
  }

  function setStatus(msg) {
    if (els.statusText) els.statusText.textContent = msg;
  }

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  function commaInt(s) {
    // s is integer string
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatUnits(valueWeiBigInt, decimals) {
    const neg = valueWeiBigInt < 0n;
    let v = neg ? -valueWeiBigInt : valueWeiBigInt;

    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = v % base;

    // show up to 4 decimal places (trim trailing zeros)
    let fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
    fracStr = fracStr.replace(/0+$/, "");

    const wholeStr = commaInt(whole.toString());
    const out = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
    return neg ? `-${out}` : out;
  }

  function encodeBalanceOf(address) {
    // balanceOf(address) selector: 0x70a08231
    const selector = "70a08231";
    const addr = address.toLowerCase().replace(/^0x/, "");
    const padded = addr.padStart(64, "0");
    return "0x" + selector + padded;
  }

  async function ethCall(to, data) {
    const result = await window.ethereum.request({
      method: "eth_call",
      params: [{ to, data }, "latest"],
    });
    return result;
  }

  function hexToBigInt(hex) {
    if (!hex) return 0n;
    return BigInt(hex);
  }

  async function getChainId() {
    const cid = await window.ethereum.request({ method: "eth_chainId" });
    return cid; // hex string
  }

  async function getAccounts() {
    return await window.ethereum.request({ method: "eth_accounts" });
  }

  async function requestAccounts() {
    return await window.ethereum.request({ method: "eth_requestAccounts" });
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
      const out = `${days}d ${pad2(hrs)}h ${pad2(mins)}m ${pad2(s)}s`;

      if (els.countdownText) els.countdownText.textContent = out;
    } catch (_) {}
  }

  function setNftAddr() {
    if (!els.nftAddr) return;
    if (NFT_ADDR && /^0x[a-fA-F0-9]{40}$/.test(NFT_ADDR)) {
      els.nftAddr.textContent = NFT_ADDR;
    } else {
      els.nftAddr.textContent = "TBA";
    }
  }

  function setRequiredText() {
    if (!els.required) return;
    const req = REQUIRED_CAPI.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    els.required.textContent = `≥ ${req} CAPI`;
  }

  function setMintState({ connected, eligible }) {
    // No NFT contract yet => keep disabled, but show reasons.
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

    // eligible
    if (!NFT_ADDR || !/^0x[a-fA-F0-9]{40}$/.test(NFT_ADDR)) {
      els.mintBtn.disabled = true;
      els.mintBtn.textContent = "Mint (coming soon)";
      els.mintHint.textContent = "Eligible ✅  Mint opens when the official NFT contract is deployed.";
      return;
    }

    // If in future: enable mint (after you implement mint tx)
    els.mintBtn.disabled = true;
    els.mintBtn.textContent = "Mint (coming soon)";
    els.mintHint.textContent = "Eligible ✅  Mint UI will activate here after contract deployment.";
  }

  async function refreshStatus(wallet) {
    setRequiredText();
    setNftAddr();

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      if (els.balance) els.balance.textContent = "—";
      if (els.shortBy) els.shortBy.textContent = "—";
      setStatus("Connect wallet to check eligibility.");
      setMintState({ connected: false, eligible: false });
      return;
    }

    // show network
    try {
      const cid = await getChainId();
      // mainnet = 0x1
      els.netText.textContent = cid === "0x1" ? "Ethereum Mainnet" : `Chain ${cid}`;
    } catch (_) {}

    // read balance
    try {
      const data = encodeBalanceOf(wallet);
      const hex = await ethCall(TOKEN_ADDR, data);
      const balWei = hexToBigInt(hex);

      const balText = formatUnits(balWei, DECIMALS);
      if (els.balance) els.balance.textContent = `${balText} CAPI`;

      // compute required in wei (whole tokens)
      const reqWei = REQUIRED_CAPI * (10n ** BigInt(DECIMALS));
      const shortWei = reqWei > balWei ? reqWei - balWei : 0n;
      const eligible = balWei >= reqWei;

      if (els.shortBy) {
        if (eligible) els.shortBy.textContent = "0 CAPI";
        else els.shortBy.textContent = `${formatUnits(shortWei, DECIMALS)} CAPI`;
      }

      if (eligible) setStatus("Eligible ✅ You can mint once the official contract is live.");
      else setStatus("Not eligible yet ❌ Increase your CAPI balance to qualify.");

      setMintState({ connected: true, eligible });
    } catch (e) {
      setStatus("Could not read on-chain balance. Check wallet/network and try again.");
      setMintState({ connected: true, eligible: false });
    }
  }

  async function init() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
    setRequiredText();
    setNftAddr();

    if (!hasEthereum()) {
      setStatus("No wallet detected. Install a wallet (e.g., MetaMask) to check eligibility.");
      if (els.connectBtn) els.connectBtn.disabled = true;
      return;
    }

    // pre-check existing connection
    let accounts = [];
    try {
      accounts = await getAccounts();
    } catch (_) {}

    const connected = accounts && accounts.length > 0;
    if (connected) {
      const wallet = accounts[0];
      if (els.walletRow) els.walletRow.style.display = "";
      if (els.wallet) els.wallet.textContent = wallet;
      if (els.refreshBtn) els.refreshBtn.disabled = false;
      setStatus("Wallet connected. Reading on-chain balance…");
      await refreshStatus(wallet);
    } else {
      setStatus("Connect wallet to check eligibility.");
      setMintState({ connected: false, eligible: false });
    }

    // Events
    if (els.connectBtn) {
      els.connectBtn.addEventListener("click", async () => {
        try {
          const accs = await requestAccounts();
          const wallet = accs && accs[0];
          if (wallet) {
            if (els.walletRow) els.walletRow.style.display = "";
            if (els.wallet) els.wallet.textContent = wallet;
            if (els.refreshBtn) els.refreshBtn.disabled = false;
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

    // react to wallet changes
    try {
      window.ethereum.on("accountsChanged", async (accs) => {
        const wallet = accs && accs[0];
        if (wallet) {
          if (els.walletRow) els.walletRow.style.display = "";
          if (els.wallet) els.wallet.textContent = wallet;
          if (els.refreshBtn) els.refreshBtn.disabled = false;
          setStatus("Account changed. Reading on-chain balance…");
          await refreshStatus(wallet);
        } else {
          if (els.walletRow) els.walletRow.style.display = "none";
          if (els.refreshBtn) els.refreshBtn.disabled = true;
          await refreshStatus(null);
        }
      });

      window.ethereum.on("chainChanged", async () => {
        const accs = await getAccounts();
        const wallet = accs && accs[0];
        setStatus("Network changed. Refreshing…");
        await refreshStatus(wallet);
      });
    } catch (_) {}
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();