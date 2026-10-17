import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let isTodayWeekOff = false;

// 🔥 BUTTONS CONNECT
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);

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

  const setupPasswordBtn = document.getElementById('setupPasswordBtn');
  if(setupPasswordBtn) setupPasswordBtn.addEventListener('click', saveNewPassword);

  const saved = localStorage.getItem('cafeteriaUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showDashboard();
  }
});

// ===== LOGIN LOGIC =====
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
    
    // 🔥 Agar pehli baar login hai (password null hai) ya default password daala hai
    if (!empData.password || empData.password === code + 'CRIL' || empData.password === password) {
      
      if (!empData.password || empData.password === code + 'CRIL') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('setupForm').style.display = 'block';
        document.getElementById('setupCodeDisplay').textContent = code;
        document.getElementById('setupCodeHidden').value = code;
        return; // Stop here, wait for new password setup
      }
    }

    // Agar normal login hai
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

// ===== NEW PASSWORD SAVE KARO =====
async function saveNewPassword() {
  const code = document.getElementById('setupCodeHidden').value;
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;
  const errorDiv = document.getElementById('setupError');

  if (newPass.length < 6) {
    showError(errorDiv, 'Password must be at least 6 characters long');
    return;
  }
  if (newPass !== confirmPass) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  try {
    await setDoc(doc(db, 'employees', code), {
      password: newPass
    }, { merge: true });

    const empSnap = await getDoc(doc(db, 'employees', code));
    const empData = empSnap.data();
    
    currentUser = { code: code, department: empData.department };
    localStorage.setItem('cafeteriaUser', JSON.stringify(currentUser));
    
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('setupForm').style.display = 'none';
    showDashboard();

  } catch (err) {
    showError(errorDiv, err.message);
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
  document.getElementById('dashboardPage').classList.remove('active');
  document.getElementById('loginPage').classList.add('active');
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
    
    const today = getTodayISO();
    const todayMenu = data.menu.find(m => m.date === today);

    if (!todayMenu) {
      menuDiv.innerHTML = '<p style="text-align:center;color:#888;">No menu available for today.</p>';
      dateDiv.textContent = today;
      isTodayWeekOff = true;
      return;
    }

    dateDiv.textContent = `${todayMenu.day}, ${today}`;
    
    if (todayMenu.lunch && todayMenu.lunch.length === 1 && todayMenu.lunch[0].name === 'Week Off') {
       menuDiv.innerHTML = '<div style="text-align:center; padding: 20px; color: #C9A961; font-size: 24px; font-weight: bold;">🌴 Week Off</div>';
       isTodayWeekOff = true;
       return;
    }

    isTodayWeekOff = false; 
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

  if (isTodayWeekOff) {
    tokenDiv.innerHTML = `
      <div class="token-empty">
        <p style="color: #C9A961; font-weight: bold; font-size: 16px;">It is a Week Off today! No tokens required.</p>
      </div>
    `;
    return;
  }

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

// 🔥 ADMIN TABLE + PASSWORD RESET
async function loadAdminTable() {
  const tableDiv = document.getElementById('adminTable');
  const today = getTodayISO();

  try {
    // 1. Saare employees fetch karo
    const empSnap = await getDocs(collection(db, 'employees'));
    let employees = [];
    empSnap.forEach(doc => employees.push({ code: doc.id, ...doc.data() }));
    
    // 2. Aaj ke tokens fetch karo
    const tokenQ = query(collection(db, 'tokens'), where('date', '==', today));
    const tokenSnap = await getDocs(tokenQ);
    let tokens = [];
    tokenSnap.forEach(doc => tokens.push(doc.data()));

    // Sort employees by Department then Code
    employees.sort((a, b) => {
      if (a.department === b.department) return a.code.localeCompare(b.code);
      return a.department.localeCompare(b.department);
    });

    // 🔥 Yahan maine Today's Token me double quote use kiya hai taaki code na toote
    let html = '<table><thead><tr><th>Dept</th><th>Emp Code</th><th>Today Token</th><th>Action</th></tr></thead><tbody>';
    
    employees.forEach(emp => {
      const tokenInfo = tokens.find(t => t.employeeCode === emp.code);
      const tokenStr = tokenInfo ? `<strong>${tokenInfo.token}</strong>` : '<span style="color:#ccc;">No Token</span>';
      
      html += `<tr>
        <td>${emp.department}</td>
        <td>${emp.code}</td>
        <td>${tokenStr}</td>
        <td><button class="btn-small danger" onclick="resetPassword('${emp.code}')">Reset Pass</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
    
    window._tokens = tokens; // CSV download ke liye save karo

  } catch (err) {
    console.error(err);
    tableDiv.innerHTML = '<p style="color:red;">Failed to load data.</p>';
  }
}

// 🔥 PASSWORD RESET FUNCTION
window.resetPassword = async function(code) {
  if (!confirm(`Kya aap ${code} ka password reset karna chahte hain? Agli baar login karte waqt wo naya password set karega.`)) return;

  try {
    await setDoc(doc(db, 'employees', code), {
      password: null // Reset to null
    }, { merge: true });
    
    alert(`${code} ka password successfully reset ho gaya!`);
  } catch (err) {
    alert('Error resetting password: ' + err.message);
  }
};

// 🔥 DOWNLOAD CSV
function downloadCSV() {
  const today = getTodayISO();
  const tokens = window._tokens || [];

  let csv = 'Date,Department,Employee Code,Token,Time\n';
  tokens.forEach(t => {
    const time = new Date(t.generatedAt).toLocaleTimeString('en-IN');
    csv += `${t.date},${t.department},${t.employeeCode},${t.token},${time}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Cantabil_Tokens_${today}.csv`;
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
