const connectBtn = document.getElementById("connectBtn");
const refreshBtn = document.getElementById("refreshBtn");
const metaBtn = document.getElementById("metaBtn");
const walletSpan = document.getElementById("wallet");
const balanceSpan = document.getElementById("balance");
const shortSpan = document.getElementById("short");

const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const metaContent = document.getElementById("metaContent");

const REQUIRED = 150_000_000n * 10n ** 18n;
const TOKEN_ADDRESS = window.CAPI_CONFIG?.CONTRACT_ADDRESS;

async function connect() {
  if (!window.ethereum) {
    alert("MetaMask not found");
    return;
  }

  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  walletSpan.textContent = accounts[0];
  await loadBalance(accounts[0]);
}

async function loadBalance(wallet) {
  if (!TOKEN_ADDRESS) return;

  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(
    TOKEN_ADDRESS,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );

  const balance = await contract.balanceOf(wallet);
  const human = Number(balance) / 1e18;

  balanceSpan.textContent = human.toLocaleString() + " CAPI";

  const short = balance >= REQUIRED ? 0n : REQUIRED - balance;
  shortSpan.textContent = short === 0n
    ? "0 CAPI"
    : (Number(short)/1e18).toLocaleString() + " CAPI";
}

async function loadMetadata() {
  const res = await fetch("/genesis/metadata/1.json");
  const data = await res.json();

  metaContent.innerHTML = `
    <p><strong>Name:</strong> ${data.name}</p>
    <p><strong>Description:</strong> ${data.description}</p>
    <p><strong>External URL:</strong> ${data.external_url}</p>
  `;
}

connectBtn?.addEventListener("click", connect);
refreshBtn?.addEventListener("click", () => {
  if (walletSpan.textContent !== "—") loadBalance(walletSpan.textContent);
});

metaBtn?.addEventListener("click", async () => {
  await loadMetadata();
  modal.classList.remove("hidden");
});

closeModal?.addEventListener("click", () => {
  modal.classList.add("hidden");
});