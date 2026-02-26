(function () {
  const $ = (sel) => document.querySelector(sel);

  // DOM
  const elWallet = $("#gcWallet");
  const elNetwork = $("#gcNetwork");
  const elBalance = $("#gcBalance");
  const elShortBy = $("#gcShortBy");
  const elEligibleBadge = $("#gcEligibleBadge");
  const elEligibleText = $("#gcEligibleText");

  const btnConnect = $("#gcConnect");
  const btnRefresh = $("#gcRefresh");
  const btnViewMeta = $("#gcViewMeta");
  const btnRawJson = $("#gcRawJson");

  const elCountdownBanner = $("#gcCountdownBanner");
  const elCountdownBig = $("#gcCountdownBig");
  const elCountdownUtc = $("#gcCountdownUtc");

  // Modal
  const modal = $("#gcMetaModal");
  const modalClose = $("#gcMetaClose");
  const modalImg = $("#gcMetaImg");
  const modalName = $("#gcMetaName");
  const modalDesc = $("#gcMetaDesc");
  const modalExt = $("#gcMetaExt");
  const modalAttrs = $("#gcMetaAttrs");
  const modalCountdownBig = $("#gcMetaCountdownBig");
  const modalCountdownUtc = $("#gcMetaCountdownUtc");
  const btnOpenRaw = $("#gcOpenRaw");
  const btnCopyJson = $("#gcCopyJson");

  // Config
  const CFG = window.CAPI_CONFIG || {};
  const contractAddress = (CFG.CONTRACT_ADDRESS || "").trim();
  const requiredTokens = Number(CFG?.genesisNft?.minCapiBalance || 150000000);
  const mintClosesUtcIso = CFG?.genesisNft?.mintClosesUtcIso || "2026-04-17T23:17:00Z";
  const metaJsonPath = CFG?.genesisNft?.metadataJsonPath || "/genesis/metadata/1.json";
  const metaImgFallback = CFG?.genesisNft?.imagePath || "/genesis/images/genesis.png";

  // Utils
  const isHexAddress = (a) => /^0x[a-fA-F0-9]{40}$/.test(a);

  function fmtInt(n) {
    try {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
    } catch {
      return String(n);
    }
  }

  function nowMs() {
    return Date.now();
  }

  function parseUtcMs(iso) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : NaN;
  }

  function formatCountdown(msLeft) {
    if (!Number.isFinite(msLeft) || msLeft <= 0) return "0d 00h 00m 00s";
    const s = Math.floor(msLeft / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  }

  // ERC-20 selectors
  const SEL_BALANCEOF = "0x70a08231"; // balanceOf(address)
  const SEL_DECIMALS = "0x313ce567"; // decimals()
  const SEL_SYMBOL = "0x95d89b41"; // symbol()

  async function ethRequest(method, params) {
    if (!window.ethereum) throw new Error("No wallet provider found.");
    return window.ethereum.request({ method, params });
  }

  async function getChainId() {
    return ethRequest("eth_chainId");
  }

  async function getAccounts() {
    const acc = await ethRequest("eth_accounts");
    return Array.isArray(acc) ? acc : [];
  }

  async function requestAccounts() {
    const acc = await ethRequest("eth_requestAccounts");
    return Array.isArray(acc) ? acc : [];
  }

  async function ethCall(to, data) {
    return ethRequest("eth_call", [{ to, data }, "latest"]);
  }

  function encodeAddressTo32(addr) {
    return addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  }

  async function readTokenDecimals() {
    try {
      const res = await ethCall(contractAddress, SEL_DECIMALS);
      const dec = Number(BigInt(res));
      return Number.isFinite(dec) ? dec : 18;
    } catch {
      return 18;
    }
  }

  async function readTokenSymbol() {
    try {
      const res = await ethCall(contractAddress, SEL_SYMBOL);
      if (!res || res === "0x") return "CAPI";
      const hex = res.replace(/^0x/, "");
      if (hex.length < 128) return "CAPI";
      const len = Number(BigInt("0x" + hex.slice(64, 128)));
      const data = hex.slice(128, 128 + len * 2);
      let out = "";
      for (let i = 0; i < data.length; i += 2) {
        const c = parseInt(data.slice(i, i + 2), 16);
        if (c) out += String.fromCharCode(c);
      }
      return out || "CAPI";
    } catch {
      return "CAPI";
    }
  }

  async function readBalanceRaw(wallet) {
    const data = SEL_BALANCEOF + encodeAddressTo32(wallet);
    const res = await ethCall(contractAddress, data);
    return BigInt(res);
  }

  function setEligibility(balanceWholeNumber) {
    const shortBy = Math.max(0, requiredTokens - balanceWholeNumber);
    elShortBy.textContent = `${fmtInt(shortBy)} CAPI`;

    if (balanceWholeNumber >= requiredTokens) {
      elEligibleBadge.classList.add("ok");
      elEligibleBadge.classList.remove("bad");
      elEligibleText.textContent = "Eligible ✅ (read via wallet)";
    } else {
      elEligibleBadge.classList.remove("ok");
      elEligibleBadge.classList.add("bad");
      elEligibleText.textContent = `Not eligible yet — short by ${fmtInt(shortBy)} CAPI`;
    }
  }

  function startCountdownLoop() {
    const target = parseUtcMs(mintClosesUtcIso);
    elCountdownUtc.textContent = `UTC ${mintClosesUtcIso}`;

    function tick() {
      const msLeft = target - nowMs();
      const txt = formatCountdown(msLeft);
      elCountdownBig.textContent = txt;

      if (modal && modal.classList.contains("open")) {
        modalCountdownBig.textContent = txt;
        modalCountdownUtc.textContent = `UTC ${mintClosesUtcIso}`;
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  async function renderNetwork() {
    try {
      const chainId = await getChainId();
      elNetwork.textContent = chainId === "0x1" ? "Ethereum Mainnet" : `Wrong network (${chainId})`;
      elNetwork.dataset.ok = chainId === "0x1" ? "1" : "0";
    } catch {
      elNetwork.textContent = "No wallet";
      elNetwork.dataset.ok = "0";
    }
  }

  async function renderWallet() {
    const acc = await getAccounts();
    const w = acc[0] || "";
    elWallet.textContent = w ? w : "—";
    return w;
  }

  async function refreshAll() {
    if (!isHexAddress(contractAddress)) {
      elBalance.textContent = "—";
      elShortBy.textContent = "—";
      elEligibleText.textContent = "Config error: contract address missing/invalid.";
      elEligibleBadge.classList.remove("ok");
      elEligibleBadge.classList.add("bad");
      return;
    }

    await renderNetwork();
    const wallet = await renderWallet();
    if (!wallet) {
      elBalance.textContent = "—";
      elShortBy.textContent = "—";
      elEligibleText.textContent = "Connect wallet to check eligibility.";
      elEligibleBadge.classList.remove("ok");
      elEligibleBadge.classList.add("bad");
      return;
    }

    try {
      const decimals = await readTokenDecimals();
      const sym = await readTokenSymbol();

      const raw = await readBalanceRaw(wallet);

      // ✅ FIX: divisor as BigInt, no float involved
      const divisor = 10n ** BigInt(decimals);
      const wholeBig = raw / divisor;     // integer whole tokens
      const wholeNum = Number(wholeBig); // safe for ~200M

      elBalance.textContent = `${fmtInt(wholeNum)} ${sym}`;
      setEligibility(wholeNum);
    } catch (e) {
      elBalance.textContent = "—";
      elShortBy.textContent = "—";
      elEligibleText.textContent = "Could not read on-chain balance. Check wallet/network.";
      elEligibleBadge.classList.remove("ok");
      elEligibleBadge.classList.add("bad");
    }
  }

  // ----- Metadata modal -----
  async function openModal() {
    modalName.textContent = "—";
    modalDesc.textContent = "Loading…";
    modalExt.textContent = "—";
    modalAttrs.innerHTML = "";
    modalCountdownUtc.textContent = `UTC ${mintClosesUtcIso}`;
    modalCountdownBig.textContent = elCountdownBig.textContent || "—";

    // Avoid flicker: preload image before setting src
    modalImg.removeAttribute("src");
    modalImg.alt = "Genesis Council image";
    modal.classList.add("open");

    try {
      const res = await fetch(metaJsonPath, { cache: "no-store" });
      if (!res.ok) throw new Error("Metadata fetch failed");
      const meta = await res.json();

      modalName.textContent = meta?.name || "CAPI Genesis Council";
      modalDesc.textContent = meta?.description || "—";
      modalExt.textContent = meta?.external_url || "—";
      modalExt.href = meta?.external_url || "#";

      const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
      modalAttrs.innerHTML = attrs.length
        ? attrs.map((a) => {
            const k = (a?.trait_type ?? "").toString();
            const v = (a?.value ?? "").toString();
            return `<div class="kv"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`;
          }).join("")
        : `<div class="muted">No attributes found.</div>`;

      const imgUrl = meta?.image || metaImgFallback;
      const pre = new Image();
      pre.onload = () => { modalImg.src = imgUrl; };
      pre.onerror = () => { modalImg.src = metaImgFallback; };
      pre.src = imgUrl;

      btnOpenRaw.onclick = () => window.open(metaJsonPath, "_blank", "noopener,noreferrer");
      btnCopyJson.onclick = async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
          btnCopyJson.textContent = "Copied ✅";
          setTimeout(() => (btnCopyJson.textContent = "Copy JSON"), 1200);
        } catch {
          btnCopyJson.textContent = "Copy failed";
          setTimeout(() => (btnCopyJson.textContent = "Copy JSON"), 1200);
        }
      };
    } catch {
      modalDesc.textContent = "Could not load metadata. Please try again.";
      modalImg.src = metaImgFallback;
    }
  }

  function closeModal() {
    modal.classList.remove("open");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Events
  btnConnect?.addEventListener("click", async () => {
    try { await requestAccounts(); await refreshAll(); } catch {}
  });

  btnRefresh?.addEventListener("click", refreshAll);
  btnViewMeta?.addEventListener("click", openModal);

  modalClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  btnRawJson?.addEventListener("click", () => {
    window.open(metaJsonPath, "_blank", "noopener,noreferrer");
  });

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", refreshAll);
    window.ethereum.on?.("chainChanged", refreshAll);
  }

  (async function init() {
    elCountdownBanner.style.display = "block";
    startCountdownLoop();
    await renderNetwork();
    await renderWallet();
    await refreshAll();
  })();
})();