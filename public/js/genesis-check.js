const connectBtn = document.getElementById("connectBtn");
const refreshBtn = document.getElementById("refreshBtn");
const metaBtn = document.getElementById("metaBtn");

const walletSpan = document.getElementById("wallet");
const balanceSpan = document.getElementById("balance");
const shortSpan = document.getElementById("short");

const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const metaContent = document.getElementById("metaContent");

/* 🔥 PON TU CONTRATO AQUÍ DIRECTAMENTE */
const TOKEN_ADDRESS = "0xTU_CONTRATO_AQUI";

const REQUIRED = BigInt("150000000000000000000000000");
const CLOSE_DATE = new Date("2026-04-17T23:17:00Z");

let currentWallet = null;

/* ================= AUTO CONNECT ================= */
window.addEventListener("load", async () => {
  if (window.ethereum) {
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      currentWallet = accounts[0];
      walletSpan.textContent = currentWallet;
      loadBalance(currentWallet);
    }
  }
  renderCountdown();
});

/* ================= CONNECT ================= */
async function connect() {
  if (!window.ethereum) {
    alert("MetaMask not found");
    return;
  }

  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  currentWallet = accounts[0];
  walletSpan.textContent = currentWallet;
  await loadBalance(currentWallet);
}

/* ================= BALANCE ================= */
async function loadBalance(wallet) {
  if (!TOKEN_ADDRESS) return;

  const data = "0x70a08231" + wallet.slice(2).padStart(64, "0");

  const result = await ethereum.request({
    method: "eth_call",
    params: [{ to: TOKEN_ADDRESS, data }, "latest"]
  });

  const balance = BigInt(result);
  const human = Number(balance) / 1e18;

  balanceSpan.innerHTML =
    `<strong style="font-size:18px;color:#22c55e;">
      ${human.toLocaleString()} CAPI
     </strong>`;

  const short = balance >= REQUIRED ? 0n : REQUIRED - balance;

  if (short === 0n) {
    shortSpan.innerHTML =
      `<strong style="color:#22c55e;font-size:16px;">
        Eligible ✅
       </strong>`;
  } else {
    shortSpan.innerHTML =
      `<strong style="color:#ef4444;font-size:16px;">
        ${(Number(short)/1e18).toLocaleString()} CAPI missing
       </strong>`;
  }
}

/* ================= COUNTDOWN ================= */
function renderCountdown() {
  const container = document.createElement("div");
  container.style.marginTop = "15px";
  container.style.padding = "12px 18px";
  container.style.borderRadius = "14px";
  container.style.background = "rgba(245,158,11,.15)";
  container.style.border = "1px solid rgba(245,158,11,.4)";
  container.style.fontSize = "18px";
  container.style.fontWeight = "700";

  walletSpan.parentNode.appendChild(container);

  function update() {
    const now = new Date();
    const diff = CLOSE_DATE - now;

    if (diff <= 0) {
      container.innerHTML = "Mint Closed";
      return;
    }

    const d = Math.floor(diff / (1000*60*60*24));
    const h = Math.floor((diff / (1000*60*60)) % 24);
    const m = Math.floor((diff / (1000*60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    container.innerHTML =
      `⏳ Mint closes in:
       <span style="color:#f59e0b;">
         ${d}d ${h}h ${m}m ${s}s
       </span>`;
  }

  update();
  setInterval(update, 1000);
}

/* ================= METADATA ================= */
async function loadMetadata() {
  const res = await fetch("/genesis/metadata/1.json");
  const data = await res.json();

  let attrsHtml = "";

  if (Array.isArray(data.attributes)) {
    data.attributes.forEach(attr => {
      attrsHtml +=
        `<p><strong>${attr.trait_type}:</strong> ${attr.value}</p>`;
    });
  }

  metaContent.innerHTML = `
    <img src="/genesis/images/genesis.png"
         style="max-width:260px;border-radius:12px;margin-bottom:15px;" />

    <p><strong>Name:</strong> ${data.name}</p>
    <p><strong>Description:</strong> ${data.description}</p>
    <p><strong>External URL:</strong> ${data.external_url}</p>
    <hr style="margin:15px 0;opacity:.2;">
    ${attrsHtml}
  `;
}

/* ================= EVENTS ================= */
connectBtn?.addEventListener("click", connect);

refreshBtn?.addEventListener("click", () => {
  if (currentWallet) loadBalance(currentWallet);
});

metaBtn?.addEventListener("click", async () => {
  await loadMetadata();
  modal.classList.remove("hidden");
});

closeModal?.addEventListener("click", () => {
  modal.classList.add("hidden");
});