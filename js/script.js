let daftarBuku = [];
let pinjaman = JSON.parse(localStorage.getItem("pinjaman")) || [];

const loginSection = document.getElementById("loginSection");
const perpusSection = document.getElementById("perpusSection");
const sapaan = document.getElementById("menyapa");
const bookContainer = document.getElementById("book-container");
const sidebarContainer = document.getElementById("sidebarPinjaman");
const notifContainer = document.getElementById("notifikasi-container");
const formPinjam = document.getElementById("formPinjam");
const loanModalEl = document.getElementById('loanModal');
const loanModal = new bootstrap.Modal(loanModalEl);

async function loadData() {
  try {
    const response = await fetch("data/daftar_buku.json");
    if (!response.ok) throw new Error("Gagal memuat data");
    daftarBuku = await response.json();
    renderBuku();
    updateSidebar();
  } catch (error) {
    bookContainer.innerHTML = `<p class="text-danger">Gagal memuat data buku.</p>`;
  }
}

function saveAndRerender() {
  localStorage.setItem("pinjaman", JSON.stringify(pinjaman));
  renderBuku();
  updateSidebar();
}

function showNotifikasi(message, type = "info") {
  const notif = document.createElement('div');
  notif.className = `alert alert-${type} alert-dismissible fade show`;
  notif.role = 'alert';
  notif.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
  notifContainer.appendChild(notif);
}

function openLoanModal(bookId) {
    const buku = daftarBuku.find(b => b.id == bookId);
    if (!buku || buku.stock <= 0) {
        return showNotifikasi("Stok buku habis.", "danger");
    }
    document.getElementById("formBukuId").value = bookId;
    loanModalEl.querySelector('.modal-title').textContent = `Pinjam: ${buku.title}`;
    formPinjam.reset();
    loanModal.show();
}

function aktifkanPinjaman(kode) {
    const item = pinjaman.find(p => p.kode === kode);
    if (item && item.status === 'pending') {
        item.status = 'aktif';
        item.tanggalPinjam = new Date().getTime();
        saveAndRerender();
        showNotifikasi(`Peminjaman buku "${item.title}" telah diaktifkan.`, "info");
    }
}

function processReturn(id, actionType) {
  const confirmationText = `Yakin ingin ${actionType} peminjaman ini?`;
  if (!confirm(confirmationText)) return;

  const index = pinjaman.findIndex((p) => p.id === id);
  if (index !== -1) {
    const item = pinjaman[index];
    const buku = daftarBuku.find((b) => b.id === item.idBuku);
    if (buku) buku.stock++;
    pinjaman.splice(index, 1);
    saveAndRerender();
    showNotifikasi(`Peminjaman buku "${buku.title}" berhasil di-${actionType}.`, "success");
  }
}

function batalkanPinjaman(id) {
    processReturn(id, 'membatalkan');
}

function kembalikanBuku(id) {
    processReturn(id, 'mengembalikan');
}

function renderBuku() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const filteredBuku = daftarBuku.filter(b => b.title.toLowerCase().includes(keyword));
  
  bookContainer.innerHTML = "";
  if (filteredBuku.length === 0) {
      bookContainer.innerHTML = "<p>Buku tidak ditemukan.</p>";
      return;
  }
  filteredBuku.forEach((buku) => {
    const isAvailable = buku.stock > 0;
    const div = document.createElement("div");
    div.className = "book-card card p-2";
    div.innerHTML = `
      <img src="${buku.img}" class="book-image mb-2" alt="${buku.title}" />
      <h6 class="mt-2" style="font-size: 0.9rem;">${buku.title}</h6>
      <p class="text-muted small" style="font-size: 0.75rem;">${buku.author}</p>
      <p class="fw-bold small ${isAvailable ? 'text-success' : 'text-danger'}">Stok: ${buku.stock}</p>
      <button 
        class="btn btn-sm btn-success" 
        onclick="openLoanModal(${buku.id})"
        ${!isAvailable ? 'disabled' : ''}>
        ${isAvailable ? 'Pinjam' : 'Stok Habis'}
      </button>`;
    bookContainer.appendChild(div);
  });
}

function createLoanRowHTML(item) {
  let timerHTML, actionButtonHTML;
  if (item.status === 'pending') {
    timerHTML = `<span class="badge bg-warning text-dark">Belum Aktif</span>`;
    actionButtonHTML = `
      <button class="btn btn-outline-success btn-sm" onclick="aktifkanPinjaman('${item.kode}')">Aktifkan</button>
      <button class="btn btn-outline-danger btn-sm" onclick="batalkanPinjaman('${item.id}')">Batalkan</button>`;
  } else {
    timerHTML = `<span class="fw-bold" id="timer-${item.id}"></span>`;
    actionButtonHTML = `<button class="btn btn-primary btn-sm" onclick="kembalikanBuku('${item.id}')">Kembalikan</button>`;
  }
  return `
    <tr>
      <td><img src="${item.img}" width="25" class="me-2 rounded"> ${item.title}</td>
      <td>${timerHTML}</td>
      <td>${actionButtonHTML}</td>
    </tr>`;
}

function updateSidebar() {
  sidebarContainer.innerHTML = "";
  if (pinjaman.length === 0) {
    sidebarContainer.innerHTML = `<p class="text-muted">Belum ada buku yang dipinjam.</p>`;
    return;
  }
  const grouped = pinjaman.reduce((acc, item) => {
    if (!acc[item.nim]) acc[item.nim] = { nama: item.nama, data: [] };
    acc[item.nim].data.push(item);
    return acc;
  }, {});
  for (const nim in grouped) {
    const user = grouped[nim];
    const div = document.createElement("div");
    div.className = "card mb-3 p-2";
    div.innerHTML = `
      <div class="p-2"><strong>Nama:</strong> ${user.nama}<br><strong>NIM:</strong> ${nim}</div>
      <table class="table table-bordered table-hover" style="font-size: 12px;">
        <thead class="table-light"><tr><th>Judul Buku</th><th>Sisa Waktu</th><th>Aksi</th></tr></thead>
        <tbody>${user.data.map((item) => createLoanRowHTML(item)).join("")}</tbody>
      </table>`;
    sidebarContainer.appendChild(div);
  }
  updateAllTimers();
}

function updateAllTimers() {
  const now = new Date().getTime();
  pinjaman.forEach(item => {
    if (item.status !== 'aktif') return;
    const el = document.getElementById(`timer-${item.id}`);
    if (!el) return;
    const sisaWaktu = item.tanggalKembali - now;
    if (sisaWaktu > 0) {
      const d = Math.floor(sisaWaktu / (1000 * 60 * 60 * 24));
      const h = Math.floor((sisaWaktu % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((sisaWaktu % (1000 * 60 * 60)) / (1000 * 60));
      el.innerHTML = `${d}h ${h}j ${m}m`;
      el.className = sisaWaktu < (2 * 24 * 60 * 60 * 1000) ? 'text-danger fw-bold' : 'text-dark fw-bold';
    } else {
      el.innerHTML = "Jatuh Tempo!";
      el.className = 'text-danger fw-bold';
      item.status = 'terlambat';
    }
  });
}

document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    const nama = document.getElementById("loginNama").value;
    loginSection.classList.add("d-none");
    perpusSection.classList.remove("d-none");
    sapaan.innerText = `Halo, ${nama}`;
});

document.getElementById("searchInput").addEventListener("input", renderBuku);

document.getElementById("resetButton").addEventListener("click", function() {
    if (confirm("PERINGATAN: Semua data peminjaman akan dihapus permanen. Lanjutkan?")) {
        localStorage.clear();
        location.reload();
    }
});

formPinjam.addEventListener("submit", function(event) {
    event.preventDefault();
    const idBuku = parseInt(document.getElementById("formBukuId").value);
    const nama = document.getElementById("formNama").value.trim();
    const nim = document.getElementById("formNIM").value.trim();

    if (!nama || !nim) {
        return showNotifikasi("Nama dan NIM wajib diisi.", "warning");
    }
    const pinjamanLain = pinjaman.find(p => p.nim === nim && p.nama.toLowerCase() !== nama.toLowerCase());
    if (pinjamanLain) {
        return showNotifikasi(`NIM ${nim} sudah terdaftar dengan nama ${pinjamanLain.nama}.`, "danger");
    }
    if (pinjaman.filter(p => p.nim === nim).length >= 3) {
        return showNotifikasi("Anda sudah mencapai batas maksimal peminjaman (3 buku).", "warning");
    }
    const buku = daftarBuku.find((b) => b.id === idBuku);
    if (buku.stock <= 0) {
        showNotifikasi("Maaf, stok buku ini baru saja habis.", "danger");
        loanModal.hide();
        return;
    }
    const tglKembali = new Date();
    tglKembali.setDate(tglKembali.getDate() + 7);
    const itemPinjaman = {
        id: crypto.randomUUID(),
        idBuku: buku.id,
        title: buku.title,
        img: buku.img,
        nama, nim,
        tanggalPinjam: new Date().getTime(),
        tanggalKembali: tglKembali.getTime(),
        kode: Math.random().toString(36).substr(2, 6).toUpperCase(),
        status: "pending"
    };
    buku.stock--;
    pinjaman.push(itemPinjaman);
    saveAndRerender();
    loanModal.hide();
    showNotifikasi(`Buku "${buku.title}" berhasil ditambahkan.`, "success");
});

loadData();
setInterval(updateAllTimers, 1000);