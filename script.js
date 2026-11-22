const STORAGE_KEY = "fintrack_transactions_v1";

const starterTransactions = [
  {id:1,name:"Uang Bulanan",category:"Pemasukan",date:"2026-11-01",method:"Transfer",type:"income",amount:3000000},
  {id:2,name:"Belanja Makanan",category:"Makanan",date:"2026-11-03",method:"QRIS",type:"expense",amount:500000},
  {id:3,name:"Transportasi",category:"Transportasi",date:"2026-11-05",method:"Tunai",type:"expense",amount:200000}
];

let transactions = loadTransactions();
let flowChart = null;
let categoryChart = null;
let editingId = null;

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : starterTransactions;
  } catch (error) {
    return starterTransactions;
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

const rupiah = value => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value);

function parseAmount(value) {
  return Number(String(value).replace(/\D/g, "")) || 0;
}

const monthFilter = document.getElementById("monthFilter");
const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const today = new Date();
document.getElementById("todayDate").textContent = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "long", year: "numeric"
}).format(today);

function getFilteredTransactions() {
  const selected = monthFilter.value;
  return selected === "all"
    ? transactions
    : transactions.filter(t => new Date(t.date + "T00:00:00").getMonth() === Number(selected));
}

function renderSummary(data) {
  const income = data.filter(t => t.type === "income").reduce((sum,t) => sum + t.amount, 0);
  const expense = data.filter(t => t.type === "expense").reduce((sum,t) => sum + t.amount, 0);
  document.getElementById("balanceValue").textContent = rupiah(income - expense);
  document.getElementById("incomeValue").textContent = rupiah(income);
  document.getElementById("expenseValue").textContent = rupiah(expense);
  document.getElementById("remainingValue").textContent = rupiah(income - expense);
}

function renderTransactions(data) {
  const body = document.getElementById("transactionBody");
  const sorted = [...data].sort((a,b) => b.date.localeCompare(a.date));
  body.innerHTML = sorted.map(t => `
    <tr>
      <td>${escapeHTML(t.name)}</td>
      <td>${escapeHTML(t.category)}</td>
      <td>${new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(t.date+"T00:00:00"))}</td>
      <td>${escapeHTML(t.method)}</td>
      <td><span class="type-pill ${t.type === "income" ? "type-income" : "type-expense"}">${t.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
      <td class="align-right ${t.type === "income" ? "amount-income" : "amount-expense"}">${t.type === "income" ? "+" : "−"} ${rupiah(t.amount)}</td>
      <td><div class="action-buttons">
        <button class="small-btn" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="small-btn delete-btn" data-action="delete" data-id="${t.id}">Hapus</button>
      </div></td>
    </tr>`).join("");
  document.getElementById("transactionCount").textContent = `${data.length} transaksi`;
  document.getElementById("emptyState").hidden = data.length !== 0;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function renderCharts(data) {
  const selected = monthFilter.value;
  const labels = selected === "all" ? monthNames : [monthNames[Number(selected)]];
  const incomeData = labels.map((_,i) => {
    const monthIndex = selected === "all" ? i : Number(selected);
    return data.filter(t => t.type === "income" && new Date(t.date+"T00:00:00").getMonth() === monthIndex).reduce((s,t) => s+t.amount,0);
  });
  const expenseData = labels.map((_,i) => {
    const monthIndex = selected === "all" ? i : Number(selected);
    return data.filter(t => t.type === "expense" && new Date(t.date+"T00:00:00").getMonth() === monthIndex).reduce((s,t) => s+t.amount,0);
  });

  if (flowChart) flowChart.destroy();
  flowChart = new Chart(document.getElementById("flowChart"), {
    type:"bar",
    data:{labels,datasets:[
      {label:"Pemasukan",data:incomeData,backgroundColor:"#527f65",borderRadius:5,barThickness:selected==="all"?13:30},
      {label:"Pengeluaran",data:expenseData,backgroundColor:"#d18c7e",borderRadius:5,barThickness:selected==="all"?13:30}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${rupiah(c.raw)}`}}},
      scales:{x:{grid:{display:false},ticks:{color:"#68776d",font:{size:9}}},y:{beginAtZero:true,grid:{color:"#e8eee9"},ticks:{color:"#68776d",font:{size:9},callback:v=>v>=1000000?(v/1000000)+" jt":v/1000+" rb"}}}}
  });

  const expenses = data.filter(t => t.type === "expense");
  const categories = [...new Set(expenses.map(t => t.category))];
  const totals = categories.map(c => expenses.filter(t => t.category === c).reduce((s,t) => s+t.amount,0));
  const palette = ["#527f65","#82a98c","#d18c7e","#b3a77c","#668f9a","#9a86ad","#c28c5c"];
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type:"doughnut",
    data:{labels:categories,datasets:[{data:totals,backgroundColor:palette,borderWidth:3,borderColor:"#fff",hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"69%",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${rupiah(c.raw)}`}}}}
  });
  document.getElementById("categoryLegend").innerHTML = categories.map((c,i) =>
    `<div class="category-item"><i style="background:${palette[i%palette.length]}"></i><span>${escapeHTML(c)}</span></div>`
  ).join("");
}

function updateDashboard() {
  const data = getFilteredTransactions();
  renderSummary(data);
  renderTransactions(data);
  renderCharts(data);
}

const backdrop = document.getElementById("modalBackdrop");
const form = document.getElementById("transactionForm");

function openModal(transaction = null) {
  form.reset();
  editingId = transaction ? transaction.id : null;
  document.getElementById("modalTitle").textContent = transaction ? "Edit Transaksi" : "Tambah Transaksi";
  document.getElementById("transactionName").value = transaction?.name || "";
  document.getElementById("transactionType").value = transaction?.type || "income";
  document.getElementById("transactionAmount").value = transaction?.amount || "";
  document.getElementById("transactionCategory").value = transaction?.category || "";
  document.getElementById("transactionDate").value = transaction?.date || new Date().toISOString().slice(0,10);
  document.getElementById("transactionMethod").value = transaction?.method || "Tunai";
  backdrop.hidden = false;
  document.getElementById("transactionName").focus();
}

function closeModal() {
  backdrop.hidden = true;
  editingId = null;
}

document.getElementById("addBtn").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !backdrop.hidden) closeModal(); });

form.addEventListener("submit", event => {
  event.preventDefault();
  const record = {
    id: editingId ?? Date.now(),
    name: document.getElementById("transactionName").value.trim(),
    type: document.getElementById("transactionType").value,
    amount: parseAmount(document.getElementById("transactionAmount").value),
    category: document.getElementById("transactionCategory").value.trim(),
    date: document.getElementById("transactionDate").value,
    method: document.getElementById("transactionMethod").value
  };
  if (!record.name || !record.category || !record.date || !Number.isFinite(record.amount) || record.amount <= 0) {
    alert("Periksa kembali data transaksi. Nominal harus lebih dari 0.");
    return;
  }
  if (editingId !== null) {
    transactions = transactions.map(t => t.id === editingId ? record : t);
  } else {
    transactions.push(record);
  }
  saveTransactions();
  closeModal();
  updateDashboard();
});

document.getElementById("transactionBody").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;
  if (button.dataset.action === "edit") {
    openModal(transaction);
  } else if (button.dataset.action === "delete") {
    if (confirm(`Hapus transaksi "${transaction.name}"?`)) {
      transactions = transactions.filter(t => t.id !== id);
      saveTransactions();
      updateDashboard();
    }
  }
});

monthFilter.addEventListener("change", updateDashboard);

document.getElementById("exportBtn").addEventListener("click", () => {
  const data = getFilteredTransactions();
  const rows = [["Nama Transaksi","Kategori","Tanggal","Metode","Tipe","Jumlah"],
    ...data.map(t => [t.name,t.category,t.date,t.method,t.type,t.amount])];
  // Gunakan titik koma agar kolom terbaca terpisah di Excel dengan pengaturan Indonesia.
  const csv = rows
    .map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "laporan-fintrack.csv"; a.click();
  URL.revokeObjectURL(url);
});

saveTransactions();
updateDashboard();
