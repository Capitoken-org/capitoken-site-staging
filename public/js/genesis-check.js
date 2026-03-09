(function () {
  const $ = (id) => document.getElementById(id);

  const btnConnect = $("gcConnectBtn");
  const btnRefresh = $("gcRefreshBtn");
  const btnViewMeta = $("gcViewMetaBtn");
  const btnRawJson = $("gcRawJsonBtn");

  const elWallet = $("gcWallet");
  const elNetwork = $("gcNetwork");
  const elBalance = $("gcBalance");
  const elShortBy = $("gcShortBy");
  const elRequired = $("gcRequired");
  const elEligiblePill = $("gcEligiblePill");
  const elReadMode = $("gcReadMode");
  const elNote = $("gcNote");
  const elCountdownBig = $("gcCountdownBig");
  const elCloseUtc = $("gcCloseUtc");
  const elMaxSupply = $("gcMaxSupply");
  const elMaxPerWallet = $("gcMaxPerWallet");
  const elNftContract = $("gcNftContract");
  const elMintStatus = $("gcMintStatus");

  const modal = $("gcMetaOverlay");
  const modalClose = $("gcMetaClose");
  const modalImg = $("gcMetaImg");
  const modalName = $("gcMetaName");
  const modalDesc = $("gcMetaDesc");
  const modalUrl = $("gcMetaUrl");
  const modalAttrs = $("gcMetaAttrs");
  const modalCountdown = $("gcMetaCountdown");
  const modalCloseUtc = $("gcMetaCloseUtc");
  const btnOpenJson = $("gcMetaOpenJson");
  const btnCopyJson = $("gcMetaCopyJson");
  const modalMsg = $("gcMetaMsg");

  const CFG = window.CAPI_CONFIG || {};
  const contractAddress = (CFG.CONTRACT_ADDRESS || "").trim();
  const requiredTokens = Number(CFG?.genesisNft?.minCapiBalance || 150000000);
  const mintClosesUtcIso = CFG?.genesisNft?.mintClosesUtcIso || "2026-04-17T23:17:00Z";
  const metadataJsonPath = CFG?.genesisNft?.metadataJsonPath || "/genesis/metadata/1.json";
  const imagePath = CFG?.genesisNft?.imagePath || "/genesis/images/genesis.png";
  const nftContractAddress = CFG?.genesisNft?.nftContractAddress || "";
  const maxSupply = CFG?.genesisNft?.maxSupply || 7000;
  const maxPerWallet = CFG?.genesisNft?.maxPerWallet || 1;

  function fmtInt(n) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n); }
  function isAddress(v) { return /^0x[a-fA-F0-9]{40}$/.test(v); }
  function countdownText(msLeft) {
    if (!Number.isFinite(msLeft) || msLeft <= 0) return "0d 00h 00m 00s";
    const total = Math.floor(msLeft / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  function setPill(text, mode) {
    if (!elEligiblePill) return;
    elEligiblePill.textContent = text;
    elEligiblePill.className = "pill";
    if (mode === "ok") elEligiblePill.classList.add("pill-ok");
    else if (mode === "bad") elEligiblePill.classList.add("pill-off");
    else elEligiblePill.classList.add("pill-muted");
  }
  function setReadMode(text) { if (elReadMode) elReadMode.textContent = text; }
  function setNote(text) {
    if (!elNote) return;
    if (!text) { elNote.hidden = true; elNote.textContent = ""; return; }
    elNote.hidden = false;
    elNote.textContent = text;
  }
  function escapeHtml(s) {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  if (elRequired) elRequired.textContent = `≥ ${fmtInt(requiredTokens)} CAPI`;
  if (elMaxSupply) elMaxSupply.textContent = String(maxSupply);
  if (elMaxPerWallet) elMaxPerWallet.textContent = String(maxPerWallet);
  if (elNftContract) elNftContract.textContent = nftContractAddress || "TBA";

  const targetMs = Date.parse(mintClosesUtcIso);
  function tickCountdown() {
    const txt = countdownText(targetMs - Date.now());
    if (elCountdownBig) elCountdownBig.textContent = txt;
    if (elCloseUtc) elCloseUtc.textContent = mintClosesUtcIso;
    if (modalCountdown) modalCountdown.textContent = txt;
    if (modalCloseUtc) modalCloseUtc.textContent = mintClosesUtcIso;
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  async function getAccounts() {
    if (!window.ethereum) return [];
    const accs = await window.ethereum.request({ method: "eth_accounts" });
    return Array.isArray(accs) ? accs : [];
  }
  async function requestAccounts() {
    if (!window.ethereum) throw new Error("No wallet");
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    return Array.isArray(accs) ? accs : [];
  }
  async function getChainId() {
    if (!window.ethereum) return null;
    return await window.ethereum.request({ method: "eth_chainId" });
  }
  async function renderWalletAndNetwork() {
    const accs = await getAccounts();
    elWallet.textContent = accs[0] || "—";
    const chainId = await getChainId();
    if (chainId === "0x1") elNetwork.textContent = "Ethereum Mainnet";
    else if (chainId) elNetwork.textContent = `Wrong network (${chainId})`;
    else elNetwork.textContent = "—";
    return accs[0] || null;
  }
  async function ethCallBalance(wallet) {
    if (!window.ethereum) throw new Error("No wallet");
    if (!isAddress(contractAddress)) throw new Error("Bad contract");
    const data = "0x70a08231" + wallet.toLowerCase().replace(/^0x/, "").padStart(64, "0");
    const result = await window.ethereum.request({ method: "eth_call", params: [{ to: contractAddress, data }, "latest"] });
    return BigInt(result);
  }
  async function readDecimals() {
    if (!window.ethereum) return 18;
    try {
      const result = await window.ethereum.request({ method: "eth_call", params: [{ to: contractAddress, data: "0x313ce567" }, "latest"] });
      return Number(BigInt(result));
    } catch { return 18; }
  }
  async function refreshBalance() {
    try {
      const wallet = await renderWalletAndNetwork();
      if (!wallet) {
        elBalance.textContent = "—";
        elShortBy.textContent = "—";
        setPill("Not checked", "bad");
        setReadMode("—");
        return;
      }
      const decimals = await readDecimals();
      const raw = await ethCallBalance(wallet);
      const divisor = 10n ** BigInt(decimals);
      const wholeNum = Number(raw / divisor);
      elBalance.textContent = fmtInt(wholeNum);
      const shortBy = Math.max(0, requiredTokens - wholeNum);
      elShortBy.textContent = fmtInt(shortBy);
      if (wholeNum >= requiredTokens) {
        setPill("Eligible ✅", "ok");
        setReadMode("(read via wallet)");
        if (elMintStatus) elMintStatus.textContent = "Eligible ✅ Mint opens when the official NFT contract is deployed.";
      } else {
        setPill("Not eligible", "bad");
        setReadMode("(read via wallet)");
        if (elMintStatus) elMintStatus.textContent = `Short by ${fmtInt(shortBy)} CAPI`;
      }
      setNote("");
    } catch (err) {
      elBalance.textContent = "—";
      elShortBy.textContent = "—";
      setPill("Not checked", "bad");
      setReadMode("—");
      setNote("Balance could not be read. Check wallet connection / network / contract.");
      console.error("Genesis balance read error:", err);
    }
  }

  async function openModal() {
    if (!modal) return;
    modal.hidden = true;
    modalName.textContent = "—";
    modalDesc.textContent = "Loading…";
    modalUrl.textContent = "—";
    modalUrl.removeAttribute("href");
    modalAttrs.innerHTML = "";
    if (modalMsg) modalMsg.textContent = "";
    if (modalImg) modalImg.src = imagePath;
    try {
      const res = await fetch(metadataJsonPath, { cache: "no-store" });
      if (!res.ok) throw new Error("Metadata fetch failed");
      const meta = await res.json();
      modalName.textContent = meta?.name || "CAPI Genesis Council";
      modalDesc.textContent = meta?.description || "—";
      const ext = meta?.external_url || "#";
      modalUrl.textContent = ext;
      modalUrl.href = ext;
      const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
      modalAttrs.innerHTML = attrs.length ? attrs.map((a) => `\n<div class="gc-attr"><div class="k">${escapeHtml(String(a?.trait_type ?? ""))}</div><div class="v">${escapeHtml(String(a?.value ?? ""))}</div></div>`).join("") : `<div class="gc-attr"><div class="k">No attributes</div><div class="v">—</div></div>`;
      if (btnOpenJson) btnOpenJson.onclick = () => window.open(metadataJsonPath, "_blank", "noopener,noreferrer");
      if (btnCopyJson) btnCopyJson.onclick = async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(meta, null, 2));
          btnCopyJson.textContent = "Copied ✅";
          setTimeout(() => (btnCopyJson.textContent = "Copy JSON"), 1200);
        } catch {
          btnCopyJson.textContent = "Copy failed";
          setTimeout(() => (btnCopyJson.textContent = "Copy JSON"), 1200);
        }
      };
    } catch (e) {
      modalDesc.textContent = "Could not load metadata.";
      console.error("Genesis metadata error:", e);
    }
    modal.hidden = false;
  }
  function closeModal() { if (modal) modal.hidden = true; }

  btnConnect?.addEventListener("click", async () => { try { await requestAccounts(); await refreshBalance(); } catch (e) { console.error("Wallet connect error:", e); } });
  btnRefresh?.addEventListener("click", refreshBalance);
  btnViewMeta?.addEventListener("click", openModal);
  btnRawJson?.addEventListener("click", () => window.open(metadataJsonPath, "_blank", "noopener,noreferrer"));
  modalClose?.addEventListener("click", closeModal);
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal || e.target.classList.contains('gcModalBackdrop')) closeModal(); });

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", refreshBalance);
    window.ethereum.on?.("chainChanged", refreshBalance);
  }

  (async function init() {
    if (modal) modal.hidden = true;
    await renderWalletAndNetwork();
    await refreshBalance();
  })();
})();
