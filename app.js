import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhr2rMG7ar42gZrc8jb4OllLcWeDK1O-k",
  authDomain: "cantabil-cafeteria.firebaseapp.com",
  projectId: "cantabil-cafeteria",
  storageBucket: "cantabil-cafeteria.firebasestorage.app",
  messagingSenderId: "1032468784511",
  appId: "1:1032468784511:web:081507457904482b3ce64a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_PASSWORD = "Cantabil@Admin2026";
const MENU_URL = 'https://raw.githubusercontent.com/V-beta/cantabil-cafeteria-menu/refs/heads/main/menu.json';

let currentUser = null;
let currentMenu = null;

// 🔥 BUTTONS CONNECT KARO (Logout button bhi isme hai)
document.addEventListener('DOMContentLoaded', () => {
  // Login Page Buttons
  const loginBtn = document.getElementById('loginBtn');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  
  // Dashboard Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Admin Buttons
  const adminLoginLink = document.getElementById('adminLoginLink');
  if(adminLoginLink) adminLoginLink.addEventListener('click', showAdminLogin);

  const closeModalBtn = document.getElementById('closeModalBtn');
  if(closeModalBtn) closeModalBtn.addEventListener('click', closeAdminLogin);

  const adminLoginBtn = document.getElementById('adminLoginBtn');
  if(adminLoginBtn) adminLoginBtn.addEventListener('click', handleAdminLogin);

  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  if(adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleAdminLogout);

  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  if(downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadCSV);

  // Auto Login Check
  const saved = localStorage.getItem('cafeteriaUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showDashboard();
  }
});

// ===== LOGIN =====
async function handleLogin() {
  const code = document.getElementById('loginCode').value.trim().toUpperCase();
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!code || !password) {
    showError(errorDiv, 'Please enter code and password');
    return;
  }

  btn.textContent = 'Logging in...';
  btn.disabled = true;
  errorDiv.classList.remove('show');

  try {
    const empRef = doc(db, 'employees', code);
    const empSnap = await getDoc(empRef);

    if (!empSnap.exists()) throw new Error('Employee code not found');
    
    const empData = empSnap.data();
    if (empData.password !== password) throw new Error('Incorrect password');

    currentUser = { code: code, department: empData.department };
    localStorage.setItem('cafeteriaUser', JSON.stringify(currentUser));
    
    showDashboard();
  } catch (err) {
    showError(errorDiv, err.message);
  } finally {
    btn.textContent = 'LOGIN';
    btn.disabled = false;
  }
}

// ===== DASHBOARD =====
async function showDashboard() {
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('dashboardPage').classList.add('active');
  document.getElementById('adminPage').classList.remove('active');
  
  document.getElementById('dashUserName').textContent = `Hello, ${currentUser.code} 👋`;
  document.getElementById('dashUserDept').textContent = `Department: ${currentUser.department}`;
  
  await loadMenu();
  await checkTokenStatus();
  await loadHistory();
}

function handleLogout() {
  localStorage.removeItem('cafeteriaUser');
  currentUser = null;
  
  // Hide Dashboard, Show Login
  document.getElementById('dashboardPage').classList.remove('active');
  document.getElementById('loginPage').classList.add('active');
  
  // Clear inputs
  document.getElementById('loginCode').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.remove('show');
}

// ===== LOAD MENU =====
async function loadMenu() {
  const menuDiv = document.getElementById('menuContent');
  const dateDiv = document.getElementById('menuDate');
  
  try {
    const res = await fetch(MENU_URL + '?t=' + Date.now());
    const data = await res.json();
    currentMenu = data.menu;

    const today = getTodayISO();
    const todayMenu = currentMenu.find(m => m.date === today);

    if (!todayMenu) {
      menuDiv.innerHTML = '<p style="text-align:center;color:#888;">No menu available for today.</p>';
      dateDiv.textContent = today;
      return;
    }

    dateDiv.textContent = `${todayMenu.day}, ${today}`;
    
    // Check if it's week off
    if (todayMenu.lunch && todayMenu.lunch.length === 1 && todayMenu.lunch[0].name === 'Week Off') {
       menuDiv.innerHTML = '<div style="text-align:center; padding: 20px; color: #C9A961; font-size: 24px; font-weight: bold;">🌴 Week Off</div>';
       return;
    }

    let html = '<div class="dish-grid">';
    (todayMenu.lunch || []).forEach(d => {
      html += `<div class="dish-item">
        <img src="${d.image || 'https://via.placeholder.com/150?text=No+Image'}" class="dish-img" onerror="this.src='https://via.placeholder.com/150?text=Food'">
        <div class="dish-name">${d.name}</div>
      </div>`;
    });
    html += '</div>';
    menuDiv.innerHTML = html;
  } catch (err) {
    menuDiv.innerHTML = '<p style="color:red;">Failed to load menu.</p>';
  }
}

// ===== TOKEN =====
async function checkTokenStatus() {
  const tokenDiv = document.getElementById('tokenContent');
  const today = getTodayISO();

  try {
    const q = query(collection(db, 'tokens'), where('employeeCode', '==', currentUser.code), where('date', '==', today));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const tokenData = querySnapshot.docs[0].data();
      showToken(tokenData.token, tokenData.generatedAt);
    } else {
      tokenDiv.innerHTML = `
        <div class="token-empty">
          <p>You haven't generated your token for today yet.</p>
          <button class="generate-btn" id="generateBtn">🍽️ Generate Today's Token</button>
        </div>
      `;
      // Attach event listener to newly created button
      document.getElementById('generateBtn').addEventListener('click', generateToken);
    }
  } catch (err) {
    console.error(err);
  }
}

async function generateToken() {
  const today = getTodayISO();
  const tokenNumber = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenDiv = document.getElementById('tokenContent');
  tokenDiv.innerHTML = '<div class="loading-spinner">Generating token...</div>';

  try {
    await addDoc(collection(db, 'tokens'), {
      employeeCode: currentUser.code,
      department: currentUser.department,
      token: tokenNumber,
      date: today,
      generatedAt: new Date().toISOString()
    });
    showToken(tokenNumber, new Date().toISOString());
  } catch (err) {
    alert('Error: ' + err.message);
    checkTokenStatus();
  }
}

function showToken(token, time) {
  const tokenDiv = document.getElementById('tokenContent');
  const timeStr = new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  tokenDiv.innerHTML = `
    <div class="token-result">
      <div>YOUR TOKEN FOR TODAY</div>
      <div class="token-number">${token}</div>
      <div class="token-note">Generated at ${timeStr} · Show this to HR</div>
    </div>
  `;
}

// ===== HISTORY =====
async function loadHistory() {
  const historyDiv = document.getElementById('historyContent');
  try {
    const q = query(collection(db, 'tokens'), where('employeeCode', '==', currentUser.code));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      historyDiv.innerHTML = '<p style="text-align:center;color:#888;">No tokens generated yet.</p>';
      return;
    }

    let tokens = [];
    snap.forEach(doc => tokens.push(doc.data()));
    tokens.sort((a, b) => b.date.localeCompare(a.date));

    let html = '<table><thead><tr><th>Date</th><th>Token</th><th>Time</th></tr></thead><tbody>';
    tokens.forEach(t => {
      const time = new Date(t.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      html += `<tr><td>${t.date}</td><td><strong>${t.token}</strong></td><td>${time}</td></tr>`;
    });
    html += '</tbody></table>';
    historyDiv.innerHTML = html;
  } catch (err) {
    historyDiv.innerHTML = '<p style="color:red;">Failed to load history.</p>';
  }
}

// ===== ADMIN =====
function showAdminLogin(e) {
  e.preventDefault();
  document.getElementById('adminLoginModal').classList.add('show');
}

function closeAdminLogin() {
  document.getElementById('adminLoginModal').classList.remove('show');
  document.getElementById('adminError').classList.remove('show');
}

function handleAdminLogin() {
  const pass = document.getElementById('adminPasswordInput').value;
  const err = document.getElementById('adminError');

  if (pass === ADMIN_PASSWORD) {
    closeAdminLogin();
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('dashboardPage').classList.remove('active');
    document.getElementById('adminPage').classList.add('active');
    loadAdminTable();
  } else {
    showError(err, 'Incorrect admin password');
  }
}

function handleAdminLogout() {
  document.getElementById('adminPage').classList.remove('active');
  document.getElementById('loginPage').classList.add('active');
}

async function loadAdminTable() {
  const tableDiv = document.getElementById('adminTable');
  const today = getTodayISO();

  try {
    const q = query(collection(db, 'tokens'), where('date', '==', today));
    const snap = await getDocs(q);

    if (snap.empty) {
      tableDiv.innerHTML = '<p style="text-align:center;color:#888;">No tokens generated today.</p>';
      return;
    }

    let tokens = [];
    snap.forEach(doc => tokens.push(doc.data()));
    tokens.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

    let html = '<table><thead><tr><th>Emp Code</th><th>Department</th><th>Token</th><th>Time</th></tr></thead><tbody>';
    tokens.forEach(t => {
      const time = new Date(t.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      html += `<tr><td>${t.employeeCode}</td><td>${t.department}</td><td><strong>${t.token}</strong></td><td>${time}</td></tr>`;
    });
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
  } catch (err) {
    tableDiv.innerHTML = '<p style="color:red;">Failed to load data.</p>';
  }
}

// ===== DOWNLOAD CSV =====
async function downloadCSV() {
  const today = getTodayISO();
  const q = query(collection(db, 'tokens'), where('date', '==', today));
  const snap = await getDocs(q);

  let csv = 'Date,Employee Code,Department,Token,Time\n';
  snap.forEach(doc => {
    const t = doc.data();
    const time = new Date(t.generatedAt).toLocaleTimeString('en-IN');
    csv += `${t.date},${t.employeeCode},${t.department},${t.token},${time}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tokens_${today}.csv`;
  a.click();
}

// ===== HELPERS =====
function getTodayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
}
