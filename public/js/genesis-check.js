/*
  Genesis Council eligibility + metadata modal
  - No external libs (pure JSON-RPC + window.ethereum)
  - Reads runtime config from window.CAPI_CONFIG (set by /public/js/capi-config.js)

  Expected DOM ids (see src/pages/genesis.astro):
  gcConnectBtn, gcRefreshBtn, gcSwitchBtn
  gcWalletRow, gcWallet, gcNetText, gcNetHint
  gcCountdownText, gcCloseUtc
  gcRequired, gcBalance, gcShortBy, gcStatusText
  gcNftAddr, gcMintBtn, gcMintHint
  gcMetaBtn, gcMetaModal, gcMetaClose, gcMetaImage, gcMetaName, gcMetaDesc, gcMetaExternal,
  gcMetaAttrs, gcMetaRawBtn, gcMetaCopyBtn, gcMetaHint
*/

(function () {
  'use strict';

  // -------------------- helpers --------------------
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function isAddr(x) {
    return typeof x === 'string' && /^0x[a-fA-F0-9]{40}$/.test(x);
  }

  function shortAddr(a) {
    if (!isAddr(a)) return '—';
    return a.slice(0, 6) + '…' + a.slice(-4);
  }

  function pad32(hexNo0x) {
    return hexNo0x.padStart(64, '0');
  }

  function toHexBigInt(bi) {
    let h = bi.toString(16);
    if (h.length % 2) h = '0' + h;
    return '0x' + h;
  }

  function fmtInt(n) {
    try {
      return Number(n).toLocaleString();
    } catch {
      return String(n);
    }
  }

  function fmtCapiFromWei(wei, decimals = 18) {
    // returns string with commas, no rounding explosion
    try {
      const s = wei.toString();
      if (decimals === 0) return fmtInt(wei);
      const pad = decimals + 1;
      const full = s.length < pad ? ('0'.repeat(pad - s.length) + s) : s;
      const i = full.slice(0, -decimals);
      const f = full.slice(-decimals).replace(/0+$/, '');
      const iNum = BigInt(i || '0');
      const iStr = iNum.toLocaleString();
      if (!f) return iStr;
      // keep up to 6 decimals visible
      const f6 = f.slice(0, 6);
      return iStr + '.' + f6;
    } catch {
      return '—';
    }
  }

  async function rpc(url, method, params) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error('RPC HTTP ' + res.status);
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || 'RPC error');
    return j.result;
  }

  function getCfg() {
    const cfg = (typeof window !== 'undefined' && window.CAPI_CONFIG) ? window.CAPI_CONFIG : {};
    const genesis = (cfg && cfg.genesisNft) ? cfg.genesisNft : {};
    return {
      tokenAddr: cfg.CONTRACT_ADDRESS || cfg.contractAddress || cfg.CONTRACT || '',
      rpcHttp: cfg.RPC_HTTP || cfg.RPC_URL || cfg.rpcUrl || '',
      chainIdExpected: '0x1',
      minCapiBalance: genesis.minCapiBalance || 150000000,
      tokenDecimals: cfg.TOKEN_DECIMALS_EXPECTED || 18,
      mintClosesUtcIso: genesis.mintClosesUtcIso || '',
      nftContractAddress: genesis.nftContractAddress || '',
      metadataJsonPath: genesis.metadataJsonPath || '/genesis/metadata/1.json',
      imagePath: genesis.imagePath || '/genesis/images/genesis.png',
      externalUrl: (cfg.SITE_URL ? (cfg.SITE_URL.replace(/\/$/, '') + '/genesis/') : '/genesis/'),
    };
  }

  // -------------------- state --------------------
  const state = {
    addr: null,
    chainId: null,
    lastBalanceWei: null,
    lastCheckedAt: 0,
    metaCache: null,
  };

  // -------------------- dom refs --------------------
  const els = {
    connectBtn: $('gcConnectBtn'),
    refreshBtn: $('gcRefreshBtn'),
    switchBtn: $('gcSwitchBtn'),

    walletRow: $('gcWalletRow'),
    wallet: $('gcWallet'),
    netText: $('gcNetText'),
    netHint: $('gcNetHint'),

    required: $('gcRequired'),
    balance: $('gcBalance'),
    shortBy: $('gcShortBy'),
    statusText: $('gcStatusText'),

    nftAddr: $('gcNftAddr'),
    mintBtn: $('gcMintBtn'),
    mintHint: $('gcMintHint'),

    metaBtn: $('gcMetaBtn'),
    modal: $('gcMetaModal'),
    metaClose: $('gcMetaClose'),
    metaImage: $('gcMetaImage'),
    metaName: $('gcMetaName'),
    metaDesc: $('gcMetaDesc'),
    metaExternal: $('gcMetaExternal'),
    metaAttrs: $('gcMetaAttrs'),
    metaRawBtn: $('gcMetaRawBtn'),
    metaCopyBtn: $('gcMetaCopyBtn'),
    metaHint: $('gcMetaHint'),
  };

  if (!els.connectBtn || !els.refreshBtn) return; // not on the genesis page

  // -------------------- ui helpers --------------------
  function setHint(msg, kind) {
    if (!els.netHint) return;
    els.netHint.textContent = msg || '';
    els.netHint.style.opacity = msg ? '1' : '0.8';
    els.netHint.dataset.kind = kind || '';
  }

  function setStatus(msg, kind) {
    if (!els.statusText) return;
    els.statusText.textContent = msg || '';
    els.statusText.dataset.kind = kind || '';
  }

  function setEligibilityUI({ eligible, balanceWei, requiredWei }) {
    const cfg = getCfg();
    const dec = cfg.tokenDecimals;
    if (els.required) els.required.textContent = '\u2265 ' + fmtInt(cfg.minCapiBalance) + ' CAPI';

    if (els.balance) {
      els.balance.textContent = balanceWei == null ? '—' : (fmtCapiFromWei(balanceWei, dec) + ' CAPI');
    }

    if (els.shortBy) {
      if (balanceWei == null) {
        els.shortBy.textContent = '—';
      } else {
        const shortWei = balanceWei >= requiredWei ? 0n : (requiredWei - balanceWei);
        els.shortBy.textContent = shortWei === 0n ? '0 CAPI' : (fmtCapiFromWei(shortWei, dec) + ' CAPI');
      }
    }

    if (eligible) {
      setStatus('Eligible ✅ (read via wallet)', 'ok');
      if (els.mintHint) els.mintHint.textContent = 'Eligible ✅ Mint opens when the official NFT contract is deployed.';
    } else {
      setStatus('Not eligible yet — reach the required CAPI balance.', 'warn');
      if (els.mintHint) els.mintHint.textContent = 'Not eligible yet — reach the required CAPI balance.';
    }

    // Mint button stays disabled until contract deployed
    if (els.mintBtn) {
      els.mintBtn.disabled = true;
      els.mintBtn.textContent = 'Mint (coming soon)';
    }
  }

  function setWalletUI(addr, chainId) {
    if (els.walletRow) els.walletRow.style.display = 'block';
    if (els.wallet) els.wallet.textContent = addr ? addr : '—';

    const netLabel = chainId === '0x1' ? 'Ethereum Mainnet' : (chainId ? ('Chain ' + chainId) : '—');
    if (els.netText) els.netText.textContent = netLabel;

    // Switch button only when on wrong chain
    if (els.switchBtn) {
      els.switchBtn.style.display = (addr && chainId && chainId !== '0x1') ? 'inline-flex' : 'none';
    }
  }

  function setContractUI() {
    const cfg = getCfg();
    if (els.nftAddr) els.nftAddr.textContent = isAddr(cfg.nftContractAddress) ? cfg.nftContractAddress : 'TBA';
  }

  // -------------------- web3 --------------------
  async function connectWallet() {
    if (!window.ethereum) {
      setHint('No wallet detected. Install MetaMask or use a Web3 browser.', 'error');
      return null;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const addr = (accounts && accounts[0]) ? accounts[0] : null;
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    state.addr = addr;
    state.chainId = chainId;
    setWalletUI(addr, chainId);
    return addr;
  }

  async function switchToMainnet() {
    if (!window.ethereum) return;
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    state.chainId = chainId;
    setWalletUI(state.addr, chainId);
  }

  async function getBalanceViaWallet(addr) {
    const cfg = getCfg();
    if (!isAddr(cfg.tokenAddr)) throw new Error('Token contract address is missing/invalid');
    if (!window.ethereum) throw new Error('No wallet');

    // balanceOf(address)
    const selector = '70a08231';
    const arg = pad32(addr.toLowerCase().replace(/^0x/, ''));
    const data = '0x' + selector + arg;

    const result = await window.ethereum.request({
      method: 'eth_call',
      params: [{ to: cfg.tokenAddr, data }, 'latest'],
    });

    if (!result || typeof result !== 'string') throw new Error('Bad eth_call');
    return BigInt(result);
  }

  async function getBalanceViaRpc(addr) {
    const cfg = getCfg();
    if (!isAddr(cfg.tokenAddr)) throw new Error('Token contract address is missing/invalid');
    if (!cfg.rpcHttp || !cfg.rpcHttp.startsWith('http')) throw new Error('RPC not configured');

    const selector = '70a08231';
    const arg = pad32(addr.toLowerCase().replace(/^0x/, ''));
    const data = '0x' + selector + arg;

    const result = await rpc(cfg.rpcHttp, 'eth_call', [{ to: cfg.tokenAddr, data }, 'latest']);
    return BigInt(result);
  }

  async function refreshEligibility() {
    const cfg = getCfg();
    setContractUI();

    if (!state.addr) {
      setEligibilityUI({ eligible: false, balanceWei: null, requiredWei: BigInt(cfg.minCapiBalance) * (10n ** BigInt(cfg.tokenDecimals)) });
      setHint('Connect your wallet to read your exact balance.', 'info');
      return;
    }

    // Chain check
    if (state.chainId && state.chainId !== cfg.chainIdExpected) {
      setHint('Wrong network. Switch to Ethereum Mainnet to read balance.', 'warn');
      setEligibilityUI({ eligible: false, balanceWei: null, requiredWei: BigInt(cfg.minCapiBalance) * (10n ** BigInt(cfg.tokenDecimals)) });
      return;
    }

    const requiredWei = BigInt(cfg.minCapiBalance) * (10n ** BigInt(cfg.tokenDecimals));

    try {
      // Prefer wallet eth_call so users see it as "read via wallet".
      let balWei;
      try {
        balWei = await getBalanceViaWallet(state.addr);
      } catch (eWallet) {
        // Fallback to RPC if wallet call fails.
        balWei = await getBalanceViaRpc(state.addr);
      }

      state.lastBalanceWei = balWei;
      state.lastCheckedAt = Date.now();

      const eligible = balWei >= requiredWei;
      setEligibilityUI({ eligible, balanceWei: balWei, requiredWei });
      setHint('', '');
      if (els.refreshBtn) els.refreshBtn.disabled = false;
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setHint('Config error: ' + msg + '.', 'error');
      setEligibilityUI({ eligible: false, balanceWei: null, requiredWei });
      if (els.refreshBtn) els.refreshBtn.disabled = false;
    }
  }

  // -------------------- metadata modal --------------------
  function openModal() {
    if (!els.modal) return;
    els.modal.setAttribute('aria-hidden', 'false');
    els.modal.classList.add('is-open');
    document.body.classList.add('gc-modal-open');
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.setAttribute('aria-hidden', 'true');
    els.modal.classList.remove('is-open');
    document.body.classList.remove('gc-modal-open');
  }

  function safeSetLink(a, href) {
    if (!a) return;
    a.href = href || '#';
    a.textContent = href || '—';
  }

  function renderAttrs(attrsArr) {
    if (!els.metaAttrs) return;
    els.metaAttrs.innerHTML = '';
    if (!Array.isArray(attrsArr) || attrsArr.length === 0) {
      els.metaAttrs.innerHTML = '<div class="gc-attrRow"><span class="gc-attrKey">No attributes found</span></div>';
      return;
    }
    for (const a of attrsArr) {
      const k = (a && (a.trait_type || a.key)) ? String(a.trait_type || a.key) : '—';
      const v = (a && (a.value != null)) ? String(a.value) : '—';
      const row = document.createElement('div');
      row.className = 'gc-attrRow';
      row.innerHTML = `<span class="gc-attrKey">${escapeHtml(k)}</span><span class="gc-attrVal mono">${escapeHtml(v)}</span>`;
      els.metaAttrs.appendChild(row);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function loadMetadata() {
    const cfg = getCfg();
    if (els.metaHint) {
      els.metaHint.textContent = '';
      els.metaHint.style.opacity = '0.9';
    }

    // Set stable fallback image immediately
    if (els.metaImage && cfg.imagePath) {
      els.metaImage.src = cfg.imagePath;
    }

    // Use cache to avoid flicker
    if (state.metaCache) {
      renderMetadata(state.metaCache);
      return;
    }

    // Fetch JSON
    try {
      const res = await fetch(cfg.metadataJsonPath, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const meta = await res.json();
      state.metaCache = meta;
      renderMetadata(meta);
    } catch (e) {
      if (els.metaHint) {
        els.metaHint.textContent = 'Metadata fetch failed. Check if the JSON path is reachable.';
      }
      // Still render static pieces so modal isn't empty
      renderMetadata(null);
    }
  }

  function renderMetadata(meta) {
    const cfg = getCfg();

    const name = meta && meta.name ? String(meta.name) : 'CAPI Genesis Council';
    const desc = meta && meta.description ? String(meta.description) : 'Genesis Council NFT for Capitoken. Minted before ownership permanently renounces. No financial rights. Community direction only.';
    const external = meta && meta.external_url ? String(meta.external_url) : (cfg.externalUrl || '/genesis/');

    if (els.metaName) els.metaName.textContent = name;
    if (els.metaDesc) els.metaDesc.textContent = desc;
    safeSetLink(els.metaExternal, external);

    // image: prefer metadata image if present; otherwise keep fallback
    const img = meta && meta.image ? String(meta.image) : '';
    if (els.metaImage && img) {
      // Prevent flicker: only set if different
      if (els.metaImage.src !== img) els.metaImage.src = img;
    }

    const attrs = meta && meta.attributes ? meta.attributes : [
      { trait_type: 'Role', value: 'Genesis Council' },
      { trait_type: 'Vote Weight', value: 1 },
      { trait_type: 'Max Supply', value: 7000 },
      { trait_type: 'Max Per Wallet', value: 1 },
      { trait_type: 'Eligibility', value: '\u2265 150,000,000 CAPI' },
      { trait_type: 'Mint Closes', value: cfg.mintClosesUtcIso || '—' },
    ];
    renderAttrs(attrs);

    // Raw JSON buttons
    if (els.metaRawBtn) els.metaRawBtn.href = cfg.metadataJsonPath;

    if (els.metaCopyBtn) {
      els.metaCopyBtn.onclick = async () => {
        try {
          const txt = meta ? JSON.stringify(meta, null, 2) : '';
          if (!txt) throw new Error('No metadata loaded');
          await navigator.clipboard.writeText(txt);
          if (els.metaHint) els.metaHint.textContent = 'Copied.';
          await sleep(1200);
          if (els.metaHint) els.metaHint.textContent = '';
        } catch {
          if (els.metaHint) els.metaHint.textContent = 'Copy failed.';
        }
      };
    }
  }

  // -------------------- init --------------------
  function wireEvents() {
    els.connectBtn.addEventListener('click', async () => {
      try {
        els.connectBtn.disabled = true;
        const addr = await connectWallet();
        if (addr) {
          if (els.refreshBtn) els.refreshBtn.disabled = false;
          await refreshEligibility();
        }
      } catch (e) {
        setHint((e && e.message) ? e.message : 'Wallet connection failed', 'error');
      } finally {
        els.connectBtn.disabled = false;
      }
    });

    els.refreshBtn.addEventListener('click', async () => {
      els.refreshBtn.disabled = true;
      await refreshEligibility();
      els.refreshBtn.disabled = false;
    });

    if (els.switchBtn) {
      els.switchBtn.addEventListener('click', async () => {
        try {
          await switchToMainnet();
          await refreshEligibility();
        } catch {
          setHint('Could not switch network automatically. Please switch to Ethereum Mainnet in your wallet.', 'warn');
        }
      });
    }

    if (els.metaBtn) {
      els.metaBtn.addEventListener('click', async () => {
        openModal();
        await loadMetadata();
      });
    }

    if (els.metaClose) {
      els.metaClose.addEventListener('click', closeModal);
    }

    // Close modal on backdrop click
    if (els.modal) {
      els.modal.addEventListener('click', (e) => {
        if (e.target === els.modal) closeModal();
      });
    }

    // React to wallet changes
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', async (accs) => {
        state.addr = (accs && accs[0]) ? accs[0] : null;
        setWalletUI(state.addr, state.chainId);
        await refreshEligibility();
      });
      window.ethereum.on('chainChanged', async (cid) => {
        state.chainId = cid;
        setWalletUI(state.addr, state.chainId);
        await refreshEligibility();
      });
    }
  }

  function hydrateStatic() {
    const cfg = getCfg();
    // Required line
    if (els.required) els.required.textContent = '\u2265 ' + fmtInt(cfg.minCapiBalance) + ' CAPI';
    // Contract info
    setContractUI();
    // Disable refresh until connect
    if (els.refreshBtn) els.refreshBtn.disabled = !state.addr;

    // If already connected (some wallets auto-inject), do a soft read (no popup)
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(async (accs) => {
        if (accs && accs[0]) {
          state.addr = accs[0];
          state.chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setWalletUI(state.addr, state.chainId);
          if (els.refreshBtn) els.refreshBtn.disabled = false;
          await refreshEligibility();
        }
      }).catch(() => {});
    }
  }

  wireEvents();
  hydrateStatic();
})();
