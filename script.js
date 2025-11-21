// --- GLOBAL VARIABLES & INITIALIZATION ---
let diagram = null;
let growthChart = null; // Variable to hold the chart instance
let memberListSortColumn = 'joinDate'; // Default sort
let memberListSortDirection = 'asc';
let memberListFilterUid = null; // Variabel baru untuk menyimpan filter pencarian daftar anggota

document.addEventListener('DOMContentLoaded', () => {
    // ... (kode 'DOMContentLoaded' lainnya tidak berubah) ...
    
    const path = window.location.pathname;

    // --- PROTEKSI LOGIN (Tidak Diubah) ---
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn && !path.includes('index.html') && !path.endsWith('/')) {
        window.location.href = 'index.html';
        return; 
    }
    // --- AKHIR PROTEKSI ---

    
    if (path.includes('dashboard.html') || path.includes('network.html')) {
        if (isLoggedIn) {
            ensureFullScreen();
        }
    }

    if (path.includes('index.html') || path.endsWith('/')) {
        document.getElementById('loginButton').addEventListener('click', login);
    } else if (path.includes('dashboard.html')) {
        initializeDashboard();
    } else if (path.includes('network.html')) {
        initializeNetworkPage();
    }
});

// --- INITIALIZERS (Diperbarui sedikit untuk reset filter) ---
function initializeDashboard() {
    updateCount();
    renderGrowthChart();
    document.getElementById('chartPeriodSelector').addEventListener('change', renderGrowthChart);
    document.getElementById('addMemberButton').addEventListener('click', addMember);
    document.getElementById('searchButton').addEventListener('click', searchMembers);
    document.getElementById('resetButton').addEventListener('click', resetSearch);
    document.getElementById('uploadButton').addEventListener('click', () => document.getElementById('csvFile').click());
    document.getElementById('csvFile').addEventListener('change', uploadCSV);
    document.getElementById('viewNetworkButton').addEventListener('click', () => { window.location.href = 'network.html'; });
    
    // UBAHAN: Menggunakan arrow function agar bisa passing null untuk reset filter
    document.getElementById('viewMemberListButton').addEventListener('click', () => showMemberList(null));
    
    document.getElementById('backToDashboardButton').addEventListener('click', showMainDashboard);
    setupTableSorting(); 

    document.getElementById('downloadButton').addEventListener('click', downloadCSV);
    document.getElementById('saveEditButton').addEventListener('click', saveEditedMember);
    document.getElementById('cancelEditButton').addEventListener('click', closeEditModal);
    document.getElementById('logoutButton').addEventListener('click', logout);
}

function initializeNetworkPage() {
    renderNetwork(); // Initial full network render
    document.getElementById('backButton').addEventListener('click', () => { window.location.href = 'dashboard.html'; });
    document.getElementById('downloadNetworkButton').addEventListener('click', downloadNetworkImage);
}


// --- NOTIFICATION & MODAL (Tidak Diubah) ---
function showNotification(message, duration = 3000) {
    let notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), duration);
}

function openEditModal(uid) {
    const member = loadMembers().find(m => m.uid === uid);
    if (!member) return;
    document.getElementById('originalUid').value = member.uid;
    document.getElementById('editName').value = member.name;
    document.getElementById('editUid').value = member.uid;
    document.getElementById('editUpline').value = member.upline || '';
    document.getElementById('editJoinDate').value = member.joinDate ? member.joinDate.split('T')[0] : '';
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function openConfirmModal(uid) {
    const modal = document.getElementById('confirmModal');
    const confirmBtn = document.getElementById('confirmDeleteButton');
    const cancelBtn = document.getElementById('cancelDeleteButton');
    modal.style.display = 'flex';
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        deleteMember(uid);
        modal.style.display = 'none';
    });
    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

// --- AUTH, NAVIGATION & FULLSCREEN (Tidak Diubah) ---
function requestFullScreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) element.requestFullscreen();
    else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
    else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    else if (element.msRequestFullscreen) element.msRequestFullscreen();
}

function exitFullScreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
}

function ensureFullScreen() {
    if (!document.fullscreenElement) {
        requestFullScreen();
    }
}

function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (user === 'admin' && pass === 'dvteam123') {
        sessionStorage.setItem('isLoggedIn', 'true');
        requestFullScreen();
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 150);
    } else {
        document.getElementById('error').innerText = 'Login gagal!';
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    exitFullScreen();
    window.location.href = 'index.html';
}

// --- DATA MANAGEMENT (CRUD) (Tidak Diubah) ---
function loadMembers() { return JSON.parse(localStorage.getItem('members') || '[]'); }
function saveMembers(members) { localStorage.setItem('members', JSON.stringify(members));}

function addMember() {
    const name = document.getElementById('name').value.trim();
    const uid = document.getElementById('uid').value.trim();
    const upline = document.getElementById('upline').value.trim();
    const joinDateValue = document.getElementById('joinDateInput').value;
    if (!name || !uid) return showNotification("Nama dan UID wajib diisi!");
    const members = loadMembers();
    if (members.some(m => m.uid === uid)) return showNotification("UID sudah terdaftar!");
    const joinDate = joinDateValue ? new Date(joinDateValue).toISOString() : new Date().toISOString();
    members.push({ name, uid, upline: upline || null, joinDate });
    saveMembers(members);
    showNotification("Anggota berhasil ditambahkan!");
    ['name', 'uid', 'upline', 'joinDateInput'].forEach(id => document.getElementById(id).value = '');
    updateCount();
    searchMembers();
    renderGrowthChart();
}

function saveEditedMember() {
    const originalUid = document.getElementById('originalUid').value;
    const newName = document.getElementById('editName').value.trim();
    const newUid = document.getElementById('editUid').value.trim();
    const newUpline = document.getElementById('editUpline').value.trim();
    const newJoinDate = document.getElementById('editJoinDate').value;
    if (!newName || !newUid) return showNotification("Nama dan UID tidak boleh kosong!");
    let members = loadMembers();
    if (newUid !== originalUid && members.some(m => m.uid === newUid)) {
        return showNotification("UID baru sudah digunakan oleh anggota lain!");
    }
    const memberIndex = members.findIndex(m => m.uid === originalUid);
    if (memberIndex === -1) return showNotification("Anggota tidak ditemukan!");
    members[memberIndex] = {
        name: newName, uid: newUid, upline: newUpline || null,
        joinDate: newJoinDate ? new Date(newJoinDate).toISOString() : members[memberIndex].joinDate
    };
    if (originalUid !== newUid) {
        members.forEach(m => { if (m.upline === originalUid) m.upline = newUid; });
    }
    saveMembers(members);
    closeEditModal();
    showNotification("Data anggota berhasil diperbarui.");
    searchMembers();
    renderGrowthChart();
}

function deleteMember(uid) {
    let members = loadMembers();
    members.forEach(member => { if (member.upline === uid) member.upline = null; });
    const updatedMembers = members.filter(m => m.uid !== uid);
    saveMembers(updatedMembers);
    showNotification("Anggota telah dihapus.");
    updateCount();
    searchMembers();
    renderGrowthChart();
}

function updateCount() {
    const el = document.getElementById('totalMembers');
    if (el) el.textContent = loadMembers().length;
}

// --- CSV FUNCTIONS (Tidak Diubah) ---
function downloadCSV() {
    const members = loadMembers();
    if (members.length === 0) return showNotification("Belum ada data!");
    let csv = "Nama,UID,Upline,TanggalBergabung\n";
    members.forEach(m => {
        const name = `"${m.name.replace(/"/g, '""')}"`;
        const joinDate = m.joinDate ? m.joinDate.split('T')[0] : '';
        csv += `${name},${m.uid},${m.upline || ''},${joinDate}\n`;
    });
    try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'data_anggota_dvteam.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Download dimulai.');
    } catch (e) { showNotification('Download gagal.'); }
}

function uploadCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const text = event.target.result;
            const allRows = text.split(/\r?\n/);
            const parseCsvRow = row => {
                const columns = []; let currentColumn = ''; let inQuotes = false;
                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    if (char === '"') {
                        if (inQuotes && row[i + 1] === '"') { currentColumn += '"'; i++; } else { inQuotes = !inQuotes; }
                    } else if (char === ',' && !inQuotes) { columns.push(currentColumn); currentColumn = ''; } else { currentColumn += char; }
                }
                columns.push(currentColumn); return columns;
            };
            const header = allRows[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
            if (!header.includes('nama') || !header.includes('uid')) return showNotification("Format CSV salah.", 4000);
            const nameIndex = header.indexOf('nama'), uidIndex = header.indexOf('uid'), uplineIndex = header.indexOf('upline'), dateIndex = header.indexOf('tanggalbergabung');
            const newMembers = [];
            allRows.slice(1).filter(row => row.trim() !== '').forEach(row => {
              const columns = parseCsvRow(row);
              const name = columns[nameIndex] ? columns[nameIndex].trim() : '', uid = columns[uidIndex] ? columns[uidIndex].trim() : '';
              const upline = uplineIndex > -1 && columns[uplineIndex] ? columns[uplineIndex].trim() : null;
              let joinDate = new Date().toISOString();
              if (dateIndex > -1 && columns[dateIndex]) {
                  const parsedDate = new Date(columns[dateIndex].trim());
                  if (!isNaN(parsedDate.getTime())) joinDate = parsedDate.toISOString();
              }
              if (name && uid) newMembers.push({ name, uid, upline: upline || null, joinDate });
            });
            if (newMembers.length > 0) {
                saveMembers(newMembers); updateCount(); renderGrowthChart();
                showNotification(`Impor berhasil! ${newMembers.length} anggota dimuat.`);
            } else { showNotification("File CSV tidak berisi data yang valid."); }
        } catch (e) { showNotification("Gagal memproses file."); } 
        finally { document.getElementById('csvFile').value = ''; }
    };
    reader.readAsText(file);
}

// --- SEARCH FUNCTIONS ---
function searchMembers() {
    const searchTerm = document.getElementById('searchTerm').value.toLowerCase();
    const allMembers = loadMembers(); 
    const results = allMembers.filter(member => {
        const matchesSearchTerm = searchTerm === '' || member.name.toLowerCase().includes(searchTerm) || member.uid.toLowerCase().includes(searchTerm);
        return matchesSearchTerm;
    });
    displaySearchResults(results.reverse(), allMembers);
}

function getDownlineCount(allMembersList, parentUid) {
    const directChildren = allMembersList.filter(m => m.upline === parentUid);
    let count = directChildren.length; 
    for (const child of directChildren) {
        count += getDownlineCount(allMembersList, child.uid); 
    }
    return count;
}

// --- FUNGSI BARU: Mengambil seluruh list downline secara flat untuk tabel ---
function getDownlineHierarchyFlat(allMembersList, parentUid) {
    let list = [];
    const directChildren = allMembersList.filter(m => m.upline === parentUid);
    for (const child of directChildren) {
        list.push(child);
        // Rekursif untuk mengambil anak dari anak (cucu, cicit, dst)
        list = list.concat(getDownlineHierarchyFlat(allMembersList, child.uid));
    }
    return list;
}

function displaySearchResults(results, allMembers) {
    const container = document.getElementById('searchResultsContainer');
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #888; margin-top: 20px;">Tidak ada anggota ditemukan.</p>';
        return;
    }
    let html = `<h4 style="margin-top: 20px;">Hasil (${results.length})</h4>`;
    results.forEach(member => {
        const joinDate = member.joinDate ? new Date(member.joinDate).toLocaleDateString('id-ID') : 'N/A';
        const uplineMember = allMembers.find(m => m.uid === member.upline);
        const uplineName = uplineMember ? uplineMember.name : '-';
        const uplineUid = member.upline || '-';
        const downlineCount = getDownlineCount(allMembers, member.uid);
        
        // --- MODIFIKASI: Tombol 'Lihat Daftar Anggota' sekarang memanggil showMemberList dengan UID ---
        html += `
            <div class="result-card">
                <div class="result-info">
                    <span class="info-label">Nama:</span>
                    <span class="info-value">${member.name}</span>
                </div>
                <div class="result-info">
                    <span class="info-label">No. UID:</span>
                    <span class="info-value">${member.uid}</span>
                </div>
                <div class="result-info">
                    <span class="info-label">Nama Refferal:</span>
                    <span class="info-value">${uplineName}</span>
                </div>
                <div class="result-info">
                    <span class="info-label">No. UID Refferal:</span>
                    <span class="info-value">${uplineUid}</span>
                </div>
                <div class="result-info">
                    <span class="info-label">Tgl Bergabung:</span>
                    <span class="info-value">${joinDate}</span>
                </div>
                <div class="result-info">
                    <span class="info-label">Jumlah Total Anggota:</span>
                    <span class="info-value">${downlineCount}</span>
                </div>
                <div class="result-actions">
                    <button class="btn-edit" onclick="openEditModal('${member.uid}')">Edit</button>
                    <button class="btn-delete" onclick="openConfirmModal('${member.uid}')">Hapus</button>
                    <button onclick="sessionStorage.setItem('focusedMemberUid', '${member.uid}'); window.location.href='network.html';">Lihat Jaringan</button>
                    <button onclick="showMemberList('${member.uid}')">Lihat Daftar Anggota</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function resetSearch() {
    document.getElementById('searchTerm').value = '';
    document.getElementById('searchResultsContainer').innerHTML = '';
}

// --- FUNGSI DAFTAR ANGGOTA (Dimodifikasi untuk Filter) ---
function showMainDashboard() {
    document.getElementById('mainDashboardContent').style.display = 'block';
    document.getElementById('memberListContainer').style.display = 'none';
}

// UBAHAN: Menerima parameter uid (opsional) untuk memfilter daftar
function showMemberList(uid = null) {
    memberListFilterUid = uid; // Set variabel global filter
    
    document.getElementById('mainDashboardContent').style.display = 'none';
    document.getElementById('memberListContainer').style.display = 'block';
    renderMemberList(); 
}

function setupTableSorting() {
    document.querySelectorAll('#memberListTable th.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const newSortColumn = header.getAttribute('data-sort');
            if (newSortColumn === memberListSortColumn) {
                memberListSortDirection = (memberListSortDirection === 'asc') ? 'desc' : 'asc';
            } else {
                memberListSortColumn = newSortColumn;
                memberListSortDirection = 'asc';
            }
            renderMemberList();
        });
    });
}

function renderMemberList() {
    const allMembers = loadMembers();
    const tbody = document.getElementById('memberListTableBody');
    tbody.innerHTML = ''; 
    
    // --- UBAHAN: Logika Filter ---
    let membersToRender = [];
    
    if (memberListFilterUid) {
        // Jika ada filter UID (dari hasil pencarian), cari anggota tersebut
        const rootMember = allMembers.find(m => m.uid === memberListFilterUid);
        if (rootMember) {
            // Ambil anggota itu sendiri
            // DAN seluruh jaringannya (downline) ke bawah
            const downlines = getDownlineHierarchyFlat(allMembers, memberListFilterUid);
            membersToRender = [rootMember, ...downlines];
        } else {
            // Jika UID tidak ditemukan (kasus jarang), kosongkan
            membersToRender = [];
        }
    } else {
        // Jika tidak ada filter (tombol menu utama), tampilkan semua
        membersToRender = [...allMembers];
    }
    // -----------------------------

    let sortedMembers = [];
    if (memberListSortColumn === 'no') {
        sortedMembers = membersToRender.sort((a, b) => new Date(a.joinDate) - new Date(b.joinDate));
        if (memberListSortDirection === 'desc') {
            sortedMembers.reverse();
        }
    } else {
        sortedMembers = membersToRender.sort((a, b) => {
            let valA, valB;
            switch (memberListSortColumn) {
                case 'name':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    break;
                case 'uid':
                    valA = a.uid.toLowerCase();
                    valB = b.uid.toLowerCase();
                    break;
                case 'upline':
                    valA = (a.upline || '').toLowerCase(); 
                    valB = (b.upline || '').toLowerCase();
                    break;
                case 'joinDate':
                default:
                    valA = new Date(a.joinDate);
                    valB = new Date(b.joinDate);
                    break;
            }
            if (valA < valB) return (memberListSortDirection === 'asc') ? -1 : 1;
            if (valA > valB) return (memberListSortDirection === 'asc') ? 1 : -1;
            return 0;
        });
    }
    document.querySelectorAll('#memberListTable th.sortable-header').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.getAttribute('data-sort') === memberListSortColumn) {
            th.classList.add(memberListSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
    sortedMembers.forEach((member, index) => {
        const joinDate = member.joinDate ? new Date(member.joinDate).toLocaleDateString('id-ID') : 'N/A';
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${member.name}</td>
                <td>${member.uid}</td>
                <td>${member.upline || '-'}</td>
                <td>${joinDate}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- GROWTH CHART FUNCTION (Tidak Diubah) ---
function renderGrowthChart() {
    const members = loadMembers();
    const ctx = document.getElementById('growthChart').getContext('2d');
    if (growthChart) growthChart.destroy();
    if (members.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.font = '16px Arial';
        ctx.fillText('Belum ada data untuk ditampilkan', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    members.sort((a, b) => new Date(a.joinDate) - new Date(b.joinDate));
    const periods = {};
    const firstDate = new Date(members[0].joinDate);
    const lastDate = new Date();
    let currentDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (currentDate <= lastDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        periods[`${year}-${month}-P1`] = 0;
        periods[`${year}-${month}-P2`] = 0;
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    members.forEach(member => {
        const joinDate = new Date(member.joinDate);
        const key = `${joinDate.getFullYear()}-${joinDate.getMonth() + 1}-${joinDate.getDate() <= 15 ? 'P1' : 'P2'}`;
        if (periods.hasOwnProperty(key)) periods[key]++;
    });
    const labels = [];
    const periodData = [];
    Object.keys(periods).forEach(key => {
        const [year, month, period] = key.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('id-ID', { month: 'short' });
        labels.push(`${monthName} ${year} (${period})`);
        periodData.push(periods[key]);
    });
    const numPeriodsToShow = parseInt(document.getElementById('chartPeriodSelector').value, 10);
    const finalLabels = numPeriodsToShow > 0 ? labels.slice(-numPeriodsToShow) : labels;
    const finalData = numPeriodsToShow > 0 ? periodData.slice(-numPeriodsToShow) : periodData;
    growthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: finalLabels,
            datasets: [{
                label: 'Anggota Baru per Periode',
                data: finalData,
                backgroundColor: 'rgba(255, 215, 0, 0.7)',
                borderColor: 'rgba(255, 215, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#ccc', stepSize: 1 }, grid: { color: '#444' }},
                x: { ticks: { color: '#ccc' }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: { size: 14 },
                    bodyFont: { size: 12 },
                    displayColors: false,
                    callbacks: {
                        label: context => 'Anggota Baru: ' + context.parsed.y
                    }
                }
            }
        }
    });
}

// --- NETWORK VISUALIZATION ---
function renderNetwork() {
    const $ = go.GraphObject.make;
    if (diagram) diagram.div = null;
    
    diagram = $(go.Diagram, "networkDiagram", {
        layout: $(go.TreeLayout, { angle: 0, layerSpacing: 100, nodeSpacing: 20 }),
        "undoManager.isEnabled": true,
        "initialContentAlignment": go.Spot.Center
    });

    const allMembers = loadMembers();
    if (allMembers.length === 0) {
        diagram.model = new go.GraphLinksModel([], []);
        return; 
    }

    const focusedMemberUid = sessionStorage.getItem('focusedMemberUid');
    let membersToRender; 

    if (focusedMemberUid) {
        const rootMember = allMembers.find(m => m.uid === focusedMemberUid);
        
        if (rootMember) {
            const getDownlineHierarchy = (allMembersList, parentUid) => {
                let downlines = [];
                const directChildren = allMembersList.filter(m => m.upline === parentUid);
                for (const child of directChildren) {
                    downlines.push(child);
                    const childDownlines = getDownlineHierarchy(allMembersList, child.uid);
                    downlines = downlines.concat(childDownlines);
                }
                return downlines;
            };
            membersToRender = [rootMember, ...getDownlineHierarchy(allMembers, focusedMemberUid)];
        } else {
            membersToRender = allMembers;
        }
    } else {
        membersToRender = allMembers;
    }
    
    const downlineCounts = {};
    allMembers.forEach(m => { downlineCounts[m.uid] = 0; });
    allMembers.forEach(m => { if (m.upline && downlineCounts.hasOwnProperty(m.upline)) downlineCounts[m.upline]++; });

    // Node template (Tidak Diubah)
    diagram.nodeTemplate =
        $(go.Node, "Horizontal", { selectionObjectName: "PANEL" },
            $(go.Panel, "Auto", { name: "PANEL" },
                $(go.Shape, "RoundedRectangle", { strokeWidth: 2 },
                    new go.Binding("stroke", "key", key => (downlineCounts[key] || 0) >= 5 ? "gold" : "white"),
                    new go.Binding("fill", "key", key => (downlineCounts[key] || 0) >= 5 ? "#1a1a1a" : "#111")
                ),
                $(go.TextBlock, { margin: 10, font: "bold 14px sans-serif", textAlign: "center" }, // Font size bisa disesuaikan jika perlu
                    new go.Binding("stroke", "key", key => (downlineCounts[key] || 0) >= 5 ? "gold" : "white"),
                    new go.Binding("text", "label") // Binding ke 'label' yang akan kita format di bawah
                )
            ),
            $("TreeExpanderButton",
                { margin: new go.Margin(6, 6, 6, 2), width: 20, height: 20, "ButtonBorder.fill": "white" },
                { "_treeExpandedFigure": "MinusLine", "_treeCollapsedFigure": "PlusLine" }
            )
        );

    // Link template (Tidak Diubah)
    diagram.linkTemplate =
        $(go.Link, { routing: go.Link.Orthogonal, fromSpot: go.Spot.Right, toSpot: go.Spot.Left, corner: 10 },
            $(go.Shape, { strokeWidth: 2 },
                new go.Binding("stroke", "from", fromKey => (downlineCounts[fromKey] || 0) >= 5 ? "gold" : "white")
            )
        );
        
    // ==========================================================
    // === BAGIAN INI DIPERBARUI (Pembuatan 'nodes') ===
    // ==========================================================
    const nodes = membersToRender.map(m => {
        // Format tanggal ke DD-MM
        let joinDateFormatted = 'N/A';
        if (m.joinDate) {
            const d = new Date(m.joinDate);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
            joinDateFormatted = `${day}-${month}`;
        }
        
        // Buat label sesuai format yang diminta
        const label = `${m.uid}/${m.name}/${joinDateFormatted}`;
        
        return { 
            key: m.uid, 
            label: label // Gunakan label yang sudah diformat
        };
    });
    // ==========================================================
    // === AKHIR PERUBAHAN ===
    // ==========================================================
    
    const links = membersToRender
        .filter(m => m.upline && membersToRender.some(u => u.uid === m.upline))
        .map(m => ({ from: m.upline, to: m.uid }));
        
    diagram.model = new go.GraphLinksModel(nodes, links);

    if (focusedMemberUid) {
        const node = diagram.findNodeForKey(focusedMemberUid);
        if (node) {
            diagram.centerRect(node.actualBounds);
            diagram.scale = 1.0;
            node.isSelected = true;
        }
        sessionStorage.removeItem('focusedMemberUid');
    }
}


// --- FUNGSI DOWNLOAD GAMBAR JARINGAN (Sudah diperbaiki) ---
function downloadNetworkImage() {
    if (!diagram) {
        showNotification("Diagram belum dimuat.");
        return;
    }

    try {
        const img = diagram.makeImage({
            scale: 1, 
            background: "#121212", 
            maxSize: new go.Size(Infinity, Infinity),
            // PERUBAHAN UNTUK MENAMBAHKAN PADDING
            padding: new go.Margin(50, 50, 50, 50) 
        });

        const link = document.createElement('a');
        link.href = img.src; 
        link.download = 'struktur_jaringan_dvteam.png'; 
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification("Mulai mengunduh gambar jaringan...");

    } catch (e) {
        console.error("Gagal membuat gambar diagram:", e);
        showNotification("Gagal mengunduh gambar.");
    }
}
