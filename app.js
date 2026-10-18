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
const GITHUB_MENU_URL = 'https://raw.githubusercontent.com/V-beta/cantabil-cafeteria-menu/refs/heads/main/menu.json';

let currentUser = null;
let fullMenuData = [];
let selectedDate = "";
let todayDate = "";

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

  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDate(1));
  document.getElementById('goTodayBtn').addEventListener('click', () => {
    selectedDate = todayDate;
    updateMenuDisplay();
  });

  const admAddLunchBtn = document.getElementById('admAddLunchBtn');
  if(admAddLunchBtn) admAddLunchBtn.addEventListener('click', () => addAdminDishRow('lunch'));
  
  const admSaveMenuBtn = document.getElementById('admSaveMenuBtn');
  if(admSaveMenuBtn) admSaveMenuBtn.addEventListener('click', saveMenuToFirebase);

  const saved = localStorage.getItem('cafeteriaUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    showDashboard();
  }
});

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
    
    if (!empData.password || empData.password === code + 'CRIL' || empData.password === password) {
      if (!empData.password || empData.password === code + 'CRIL') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('setupForm').style.display = 'block';
        document.getElementById('setupCodeDisplay').textContent = code;
        document.getElementById('setupCodeHidden').value = code;
        return;
      }
    }

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
    await setDoc(doc(db, 'employees', code), { password: newPass }, { merge: true });
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

async function showDashboard() {
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('dashboardPage').classList.add('active');
  document.getElementById('adminPage').classList.remove('active');
  
  document.getElementById('dashUserName').textContent = `Hello, ${currentUser.code} 👋`;
  document.getElementById('dashUserDept').textContent = `Department: ${currentUser.department}`;
  
  todayDate = getTodayISO();
  selectedDate = todayDate;

  await fetchMenuData(); 
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

async function fetchMenuData() {
  try {
    let menuArr = [];
    const res = await fetch(GITHUB_MENU_URL + '?t=' + Date.now());
    const data = await res.json();
    if(data && data.menu) menuArr = data.menu;

    const menuSnap = await getDocs(collection(db, 'menus'));
    menuSnap.forEach(docSnap => {
      const fbMenu = docSnap.data();
      const existingIdx = menuArr.findIndex(m => m.date === fbMenu.date);
      if(existingIdx >= 0) {
        menuArr[existingIdx] = fbMenu; 
      } else {
        menuArr.push(fbMenu);
      }
    });

    menuArr.sort((a, b) => a.date.localeCompare(b.date));
    fullMenuData = menuArr;
    updateMenuDisplay(); 
  } catch (err) {
    document.getElementById('menuContent').innerHTML = '<p style="color:red;">Failed to load menu. Please refresh.</p>';
  }
}

function shiftDate(days) {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  selectedDate = `${y}-${m}-${day}`;
  updateMenuDisplay();
}

function updateMenuDisplay() {
  const menuDiv = document.getElementById('menuContent');
  const dateTitle = document.getElementById('menuDateDisplay');
  const tokenCard = document.getElementById('tokenCard');

  const d = new Date(selectedDate);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  
  dateTitle.textContent = dateStr;

  if (selectedDate !== todayDate) {
    document.getElementById('goTodayBtn').style.display = 'block';
  } else {
    document.getElementById('goTodayBtn').style.display = 'none';
  }

  if (selectedDate === todayDate) {
    tokenCard.style.display = 'block';
  } else {
    tokenCard.style.display = 'none'; 
  }

  const selectedMenu = fullMenuData.find(m => m.date === selectedDate);

  // 🔥 BUG FIX: Agar Week Off hai ya menu nahi hai, toh Token turant hide karo
  if (!selectedMenu) {
    menuDiv.innerHTML = '<p style="text-align:center;color:#888; padding:20px;">No menu available for this date.</p>';
    if (selectedDate === todayDate) {
      tokenCard.style.display = 'none';
    }
    return;
  }

  const isWeekOff = selectedMenu.lunch && selectedMenu.lunch.length === 1 && selectedMenu.lunch[0].name === 'Week Off';
  
  if (isWeekOff) {
     menuDiv.innerHTML = '<div style="text-align:center; padding: 20px; color: #C9A961; font-size: 24px; font-weight: bold;">🌴 Week Off</div>';
     if (selectedDate === todayDate) {
       tokenCard.style.display = 'none'; // Sunday ka token bug fix
     }
     return;
  }

  let html = '<div class="dish-grid">';
  (selectedMenu.lunch || []).forEach(dish => {
    html += `<div class="dish-item">
      <img src="${dish.image || 'https://via.placeholder.com/150?text=No+Image'}" class="dish-img" onerror="this.src='https://via.placeholder.com/150?text=Food'">
      <div class="dish-name">${dish.name}</div>
    </div>`;
  });
  html += '</div>';
  menuDiv.innerHTML = html;

  if (selectedDate === todayDate) {
    checkTodayToken();
  }
}

async function checkTodayToken() {
  const tokenDiv = document.getElementById('tokenContent');
  
  try {
    const q = query(collection(db, 'tokens'), where('employeeCode', '==', currentUser.code), where('date', '==', todayDate));
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
  const tokenNumber = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenDiv = document.getElementById('tokenContent');
  tokenDiv.innerHTML = '<div class="loading-spinner">Generating token...</div>';

  try {
    await addDoc(collection(db, 'tokens'), {
      employeeCode: currentUser.code,
      department: currentUser.department,
      token: tokenNumber,
      date: todayDate,
      generatedAt: new Date().toISOString()
    });
    showToken(tokenNumber, new Date().toISOString());
  } catch (err) {
    alert('Error: ' + err.message);
    checkTodayToken();
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
    
    document.getElementById('admDate').value = todayDate;
    document.getElementById('admLunchList').innerHTML = '';
    addAdminDishRow('lunch'); 

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
  
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    let employees = [];
    empSnap.forEach(doc => employees.push({ code: doc.id, ...doc.data() }));
    
    const tokenQ = query(collection(db, 'tokens'), where('date', '==', todayDate));
    const tokenSnap = await getDocs(tokenQ);
    let tokens = [];
    tokenSnap.forEach(doc => tokens.push(doc.data()));

    employees.sort((a, b) => {
      if (a.department === b.department) return a.code.localeCompare(b.code);
      return a.department.localeCompare(b.department);
    });

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
    
    window._tokens = tokens; 

  } catch (err) {
    console.error(err);
    tableDiv.innerHTML = '<p style="color:red;">Failed to load data.</p>';
  }
}

window.resetPassword = async function(code) {
  if (!confirm(`Kya aap ${code} ka password reset karna chahte hain?`)) return;
  try {
    await setDoc(doc(db, 'employees', code), { password: null }, { merge: true });
    alert(`${code} ka password successfully reset ho gaya!`);
  } catch (err) {
    alert('Error resetting password: ' + err.message);
  }
};

// 🔥 MENU UPDATE FORM LOGIC
function addAdminDishRow(type, name = "", image = "") {
  const container = document.getElementById('admLunchList');
  const row = document.createElement('div');
  row.className = 'dish-row';
  row.innerHTML = `
    <input type="text" class="dish-name-inp" placeholder="Dish Name" value="${name}">
    <input type="text" class="dish-img-inp" placeholder="Image URL (Optional)" value="${image}">
    <button class="btn-remove" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(row);
}

async function saveMenuToFirebase() {
  const date = document.getElementById('admDate').value;
  if(!date) return alert("Please select a date");

  const rows = document.querySelectorAll('#admLunchList .dish-row');
  let lunchArr = [];
  rows.forEach(r => {
    const name = r.querySelector('.dish-name-inp').value.trim();
    const img = r.querySelector('.dish-img-inp').value.trim();
    if(name) lunchArr.push({ name, image: img });
  });

  if(lunchArr.length === 0) return alert("Please add at least one dish");

  const d = new Date(date);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const menuData = {
    date: date,
    day: days[d.getDay()],
    lunch: lunchArr,
    lunchTime: "2:00 PM - 2:30 PM",
    snacks: [{ name: "Samosa", image: "" }],
    snacksTime: "4:30 PM - 5:00 PM",
    notes: ""
  };

  try {
    const btn = document.getElementById('admSaveMenuBtn');
    btn.textContent = "Saving...";
    btn.disabled = true;

    await setDoc(doc(db, 'menus', date), menuData); 
    alert(`Menu for ${date} saved successfully!`);
    
    document.getElementById('admLunchList').innerHTML = '';
    addAdminDishRow('lunch');
    
    btn.textContent = "💾 Save Menu";
    btn.disabled = false;

    fetchMenuData();

  } catch (err) {
    alert('Error: ' + err.message);
    btn.textContent = "💾 Save Menu";
    btn.disabled = false;
  }
}

function downloadCSV() {
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
  a.download = `Cantabil_Tokens_${todayDate}.csv`;
  a.click();
}

function getTodayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
}
