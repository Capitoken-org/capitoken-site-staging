(function () {
  const $ = (id) => document.getElementById(id);

  // ===== DOM aligned to current genesis.astro =====
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
  const elMintBtn = $("gcMintBtn");
  const elMintStatus = $("gcMintStatus");

  // Modal
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

  // ===== CONFIG =====
  const CFG = window.CAPI_CONFIG || {};
  const capiContractAddress = (CFG.CONTRACT_ADDRESS || "").trim();
  const requiredTokens = Number(CFG?.genesisNft?.minCapiBalance || 150000000);
  const mintClosesUtcIso =
    CFG?.genesisNft?.mintClosesUtcIso || "2026-04-17T23:17:00Z";
  const metadataJsonPath =
    CFG?.genesisNft?.metadataJsonPath || "/genesis/metadata/1.json";
  const imagePath =
    CFG?.genesisNft?.imagePath || "/genesis/images/genesis.png";
  const nftContractAddress = (CFG?.genesisNft?.nftContractAddress || "").trim();
  const maxSupply = CFG?.genesisNft?.maxSupply || 7000;
  const maxPerWallet = CFG?.genesisNft?.maxPerWallet || 1;

  // ===== STATE =====
  let currentWallet = null;
  let currentBalanceWhole = 0;
  let mintInProgress = false;

  // ===== HELPERS =====
  function fmtInt(n) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(n);
  }

  function isAddress(v) {
    return /^0x[a-fA-F0-9]{40}$/.test(v);
  }

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

  function setReadMode(text) {
    if (elReadMode) elReadMode.textContent = text;
  }

  function setNote(text) {
    if (!elNote) return;
    if (!text) {
      elNote.hidden = true;
      elNote.textContent = "";
      return;
    }
    elNote.hidden = false;
    elNote.textContent = text;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setMintBtnVisual(state) {
    if (!elMintBtn) return;

    // base reset
    elMintBtn.style.opacity = "1";
    elMintBtn.style.cursor = "pointer";
    elMintBtn.style.pointerEvents = "auto";
    elMintBtn.style.filter = "none";
    elMintBtn.style.background = "";
    elMintBtn.style.borderColor = "";
    elMintBtn.style.color = "";
    elMintBtn.style.boxShadow = "";
    elMintBtn.style.transform = "";
    elMintBtn.onmouseenter = null;
    elMintBtn.onmouseleave = null;

    if (state === "active") {
      elMintBtn.disabled = false;
      elMintBtn.style.cursor = "pointer";
      elMintBtn.style.pointerEvents = "auto";
      elMintBtn.style.background = "linear-gradient(180deg, #f6b23d 0%, #d98a08 100%)";
      elMintBtn.style.borderColor = "rgba(255, 186, 64, 0.95)";
      elMintBtn.style.color = "#1a1204";
      elMintBtn.style.boxShadow = "0 0 0 1px rgba(255,186,64,0.25), 0 10px 22px rgba(217,138,8,0.28)";
      elMintBtn.onmouseenter = () => {
        elMintBtn.style.filter = "brightness(1.05)";
        elMintBtn.style.transform = "translateY(-1px)";
      };
      elMintBtn.onmouseleave = () => {
        elMintBtn.style.filter = "none";
        elMintBtn.style.transform = "none";
      };
      return;
    }

    if (state === "pending") {
      elMintBtn.disabled = true;
      elMintBtn.style.cursor = "progress";
      elMintBtn.style.pointerEvents = "none";
      elMintBtn.style.background = "linear-gradient(180deg, #f6b23d 0%, #d98a08 100%)";
      elMintBtn.style.borderColor = "rgba(255, 186, 64, 0.95)";
      elMintBtn.style.color = "#1a1204";
      elMintBtn.style.opacity = "0.9";
      elMintBtn.style.boxShadow = "0 0 0 1px rgba(255,186,64,0.25), 0 10px 22px rgba(217,138,8,0.18)";
      return;
    }

    if (state === "done") {
      elMintBtn.disabled = true;
      elMintBtn.style.cursor = "default";
      elMintBtn.style.pointerEvents = "none";
      elMintBtn.style.background = "linear-gradient(180deg, #31c26b 0%, #178645 100%)";
      elMintBtn.style.borderColor = "rgba(84, 220, 132, 0.85)";
      elMintBtn.style.color = "#08180c";
      elMintBtn.style.boxShadow = "0 0 0 1px rgba(84,220,132,0.2), 0 10px 22px rgba(23,134,69,0.18)";
      return;
    }

    // disabled / locked / wrong-network / no-contract / not-connected
    elMintBtn.disabled = true;
    elMintBtn.style.cursor = "not-allowed";
    elMintBtn.style.pointerEvents = "none";
    elMintBtn.style.opacity = "0.68";
    elMintBtn.style.background = "linear-gradient(180deg, rgba(130,130,130,0.35) 0%, rgba(80,80,80,0.35) 100%)";
    elMintBtn.style.borderColor = "rgba(255,255,255,0.12)";
    elMintBtn.style.color = "rgba(255,255,255,0.88)";
    elMintBtn.style.boxShadow = "none";
  }

  function setMintUiState(mode, msg) {
    if (!elMintBtn || !elMintStatus) return;

    if (mode === "no-contract") {
      elMintBtn.textContent = "Mint (coming soon)";
      elMintStatus.textContent = "Mint opens when the official NFT contract is deployed.";
      setMintBtnVisual("disabled");
      return;
    }

    if (mode === "not-connected") {
      elMintBtn.textContent = "Connect wallet";
      elMintStatus.textContent = "Connect wallet to check mint eligibility.";
      setMintBtnVisual("disabled");
      return;
    }

    if (mode === "wrong-network") {
      elMintBtn.textContent = "Wrong network";
      elMintStatus.textContent = "Switch wallet to Ethereum Mainnet.";
      setMintBtnVisual("disabled");
      return;
    }

    if (mode === "not-eligible") {
      elMintBtn.textContent = "Mint locked";
      elMintStatus.textContent = msg || "You do not meet the requirements yet.";
      setMintBtnVisual("disabled");
      return;
    }

    if (mode === "ready") {
      elMintBtn.textContent = "Mint Genesis NFT";
      elMintStatus.textContent = msg || "Eligible ✅ You can mint now (gas only).";
      setMintBtnVisual("active");
      return;
    }

    if (mode === "pending") {
      elMintBtn.textContent = "Mint pending...";
      elMintStatus.textContent = msg || "Transaction submitted. Waiting for confirmation...";
      setMintBtnVisual("pending");
      return;
    }

    if (mode === "done") {
      elMintBtn.textContent = "Minted ✅";
      elMintStatus.textContent = msg || "Mint successful.";
      setMintBtnVisual("done");
      return;
    }

    if (mode === "error") {
      elMintBtn.textContent = "Mint Genesis NFT";
      elMintStatus.textContent = msg || "Mint failed or was rejected.";
      setMintBtnVisual("active");
    }
  }

  function isMintClosed() {
    return Date.now() > targetMs;
  }

  // ===== STATIC RENDER =====
  if (elRequired) elRequired.textContent = `≥ ${fmtInt(requiredTokens)} CAPI`;
  if (elMaxSupply) elMaxSupply.textContent = String(maxSupply);
  if (elMaxPerWallet) elMaxPerWallet.textContent = String(maxPerWallet);
  if (elNftContract) {
    elNftContract.textContent = isAddress(nftContractAddress)
      ? nftContractAddress
      : "TBA";
  }

  // ===== COUNTDOWN =====
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

  // ===== WALLET / NETWORK =====
  async function getAccounts() {
    if (!window.ethereum) return [];
    const accs = await window.ethereum.request({ method: "eth_accounts" });
    return Array.isArray(accs) ? accs : [];
  }

  async function requestAccounts() {
    if (!window.ethereum) throw new Error("No wallet");
    const accs = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    return Array.isArray(accs) ? accs : [];
  }

  async function getChainId() {
    if (!window.ethereum) return null;
    return await window.ethereum.request({ method: "eth_chainId" });
  }

  async function renderWalletAndNetwork() {
    const accs = await getAccounts();
    currentWallet = accs[0] || null;
    elWallet.textContent = currentWallet || "—";

    const chainId = await getChainId();
    if (chainId === "0x1") elNetwork.textContent = "Ethereum Mainnet";
    else if (chainId) elNetwork.textContent = `Wrong network (${chainId})`;
    else elNetwork.textContent = "—";

    return {
      wallet: currentWallet,
      chainId,
    };
  }

  // ===== ERC20 READ =====
  async function ethCall(to, data) {
    return window.ethereum.request({
      method: "eth_call",
      params: [{ to, data }, "latest"],
    });
  }

  async function readTokenDecimals() {
    try {
      const result = await ethCall(capiContractAddress, "0x313ce567");
      return Number(BigInt(result));
    } catch {
      return 18;
    }
  }

  async function readCapiBalanceRaw(wallet) {
    if (!window.ethereum) throw new Error("No wallet");
    if (!isAddress(capiContractAddress)) throw new Error("Bad CAPI contract");

    const data =
      "0x70a08231" +
      wallet.toLowerCase().replace(/^0x/, "").padStart(64, "0");

    const result = await ethCall(capiContractAddress, data);
    return BigInt(result);
  }

  // ===== NFT MINT =====
  async function sendMintTransaction() {
    if (!window.ethereum) throw new Error("No wallet");
    if (!currentWallet) throw new Error("No connected wallet");
    if (!isAddress(nftContractAddress)) throw new Error("NFT contract missing");

    const mintSelector = "0x1249c58b"; // mint()

    return await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: currentWallet,
          to: nftContractAddress,
          data: mintSelector,
          value: "0x0",
        },
      ],
    });
  }

  function refreshMintState(chainId) {
    if (!isAddress(nftContractAddress)) {
      setMintUiState("no-contract");
      return;
    }

    if (!currentWallet) {
      setMintUiState("not-connected");
      return;
    }

    if (chainId !== "0x1") {
      setMintUiState("wrong-network");
      return;
    }

    if (isMintClosed()) {
      setMintUiState("not-eligible", "Mint window is closed.");
      return;
    }

    if (currentBalanceWhole >= requiredTokens) {
      setMintUiState("ready", "Eligible ✅ You can mint now (gas only).");
    } else {
      const shortBy = Math.max(0, requiredTokens - currentBalanceWhole);
      setMintUiState(
        "not-eligible",
        `You need ${fmtInt(shortBy)} more CAPI to mint.`
      );
    }
  }

  async function refreshBalanceAndEligibility() {
    try {
      const { wallet, chainId } = await renderWalletAndNetwork();

      if (!wallet) {
        currentBalanceWhole = 0;
        elBalance.textContent = "—";
        elShortBy.textContent = "—";
        setPill("Not checked", "bad");
        setReadMode("—");
        setMintUiState("not-connected");
        return;
      }

      const decimals = await readTokenDecimals();
      const raw = await readCapiBalanceRaw(wallet);
      const divisor = 10n ** BigInt(decimals);
      const whole = raw / divisor;
      const wholeNum = Number(whole);
      currentBalanceWhole = wholeNum;

      elBalance.textContent = fmtInt(wholeNum);

      const shortBy = Math.max(0, requiredTokens - wholeNum);
      elShortBy.textContent = fmtInt(shortBy);

      if (wholeNum >= requiredTokens) {
        setPill("Eligible ✅", "ok");
        setReadMode("(read via wallet)");
      } else {
        setPill("Not eligible", "bad");
        setReadMode("(read via wallet)");
      }

      setNote("");
      refreshMintState(chainId);
    } catch (err) {
      currentBalanceWhole = 0;
      elBalance.textContent = "—";
      elShortBy.textContent = "—";
      setPill("Not checked", "bad");
      setReadMode("—");
      setNote(
        "Balance could not be read. Check wallet connection / network / contract."
      );
      setMintUiState("error", "Could not check mint eligibility.");
      console.error("Genesis balance read error:", err);
    }
  }

  // ===== MODAL =====
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
      modalAttrs.innerHTML = attrs.length
        ? attrs
            .map(
              (a) => `
          <div class="gc-attr">
            <div class="k">${escapeHtml(String(a?.trait_type ?? ""))}</div>
            <div class="v">${escapeHtml(String(a?.value ?? ""))}</div>
          </div>
        `
            )
            .join("")
        : `<div class="gc-attr"><div class="k">No attributes</div><div class="v">—</div></div>`;

      if (btnOpenJson) {
        btnOpenJson.onclick = () =>
          window.open(metadataJsonPath, "_blank", "noopener,noreferrer");
      }

      if (btnCopyJson) {
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
      }
    } catch (e) {
      modalDesc.textContent = "Could not load metadata.";
      console.error("Genesis metadata error:", e);
    }

    modal.hidden = false;
  }

  function closeModal() {
    if (modal) modal.hidden = true;
  }

  // ===== EVENTS =====
  btnConnect?.addEventListener("click", async () => {
    try {
      await requestAccounts();
      await refreshBalanceAndEligibility();
    } catch (e) {
      console.error("Wallet connect error:", e);
    }
  });

  btnRefresh?.addEventListener("click", refreshBalanceAndEligibility);
  btnViewMeta?.addEventListener("click", openModal);
  btnRawJson?.addEventListener("click", () =>
    window.open(metadataJsonPath, "_blank", "noopener,noreferrer")
  );

  if (elMintBtn) {
    elMintBtn.addEventListener("click", async () => {
      if (mintInProgress || elMintBtn.disabled) return;

      try {
        const { chainId } = await renderWalletAndNetwork();

        if (!currentWallet) {
          setMintUiState("not-connected");
          return;
        }

        if (chainId !== "0x1") {
          setMintUiState("wrong-network");
          return;
        }

        if (!isAddress(nftContractAddress)) {
          setMintUiState("no-contract");
          return;
        }

        if (currentBalanceWhole < requiredTokens) {
          const shortBy = Math.max(0, requiredTokens - currentBalanceWhole);
          setMintUiState(
            "not-eligible",
            `You need ${fmtInt(shortBy)} more CAPI to mint.`
          );
          return;
        }

        mintInProgress = true;
        setMintUiState("pending", "Waiting for wallet confirmation...");

        const txHash = await sendMintTransaction();

        setMintUiState(
          "pending",
          `Transaction submitted: ${txHash.slice(0, 10)}... Waiting for confirmation...`
        );

        setTimeout(async () => {
          mintInProgress = false;
          await refreshBalanceAndEligibility();
          setMintUiState(
            "done",
            "Mint transaction submitted. Check wallet / explorer for final confirmation."
          );
        }, 8000);
      } catch (err) {
        mintInProgress = false;
        console.error("Genesis mint error:", err);

        let msg = "Mint failed or was rejected.";
        const raw = String(err?.message || err || "");

        if (raw.includes("Wallet limit")) {
          msg = "This wallet already minted the Genesis NFT.";
        } else if (raw.includes("Not enough CAPI")) {
          msg = "This wallet no longer meets the 150M CAPI requirement.";
        } else if (raw.includes("Mint closed")) {
          msg = "Mint window is closed.";
        } else if (raw.includes("User rejected") || raw.includes("4001")) {
          msg = "Transaction rejected in wallet.";
        }

        setMintUiState("error", msg);
      }
    });
  }

  modalClose?.addEventListener("click", closeModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", refreshBalanceAndEligibility);
    window.ethereum.on?.("chainChanged", refreshBalanceAndEligibility);
  }

  // ===== INIT =====
  (async function init() {
    if (modal) modal.hidden = true;
    await renderWalletAndNetwork();
    await refreshBalanceAndEligibility();
  })();
})();