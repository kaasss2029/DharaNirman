const loginProfiles = {
  citizen: {
    copy: 'View registered 3D titles, certificates, tax status, and demarcation requests.'
  },
  officer: {
    name: 'R. K. Iyer (DoLR)',
    identifier: 'officer@nic.gov.in',
    unit_id: null,
    copy: 'Review applications, validate topology, approve ULPINs, and issue official certificates.'
  },
  surveyor: {
    name: 'Neha Kulkarni',
    identifier: 'surveyor@survey.gov.in',
    unit_id: null,
    copy: 'Inspect survey layers, prepare draft volumes, and submit technical evidence to DoLR.'
  }
};

let selectedLoginRole = 'citizen';
let activeAuthTab = 'login'; // 'login' or 'register'

function setAuthMode(mode) {
  activeAuthTab = mode;
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');
  const tabLogin = document.getElementById('tab-mode-login');
  const tabRegister = document.getElementById('tab-mode-register');
  const roleNav = document.getElementById('role-selector-nav');

  if (tabLogin && tabRegister) {
    tabLogin.classList.toggle('active', mode === 'login');
    tabRegister.classList.toggle('active', mode === 'register');
  }

  if (loginSection && registerSection) {
    loginSection.classList.toggle('hidden', mode !== 'login');
    registerSection.classList.toggle('hidden', mode !== 'register');
  }

  if (roleNav) {
    roleNav.style.display = mode === 'login' ? 'grid' : 'none';
  }

  document.getElementById('login-error').hidden = true;
}

function selectLoginRole(role) {
  if (!loginProfiles[role]) return;
  selectedLoginRole = role;
  document.querySelectorAll('.role-tab-btn').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.role === role);
  });
  const profile = loginProfiles[role];
  const copyElem = document.getElementById('login-role-copy');
  if (copyElem) {
    copyElem.innerHTML =
      `<h3>${role === 'officer' ? 'DoLR Officer Portal' : role === 'surveyor' ? 'Surveyor Technical Portal' : 'Citizen Property Portal'}</h3><p>${profile.copy}</p>`;
  }
  const idInput = document.getElementById('login-identifier');
  const pwdInput = document.getElementById('login-password');
  if (role === 'citizen') {
    if (idInput) {
      idInput.value = '';
      idInput.placeholder = 'e.g. your_registered_email@example.com';
    }
    if (pwdInput) pwdInput.value = '';
  } else {
    if (idInput) idInput.value = profile.identifier;
    if (pwdInput) pwdInput.value = 'demo-access';
  }
  document.getElementById('login-error').hidden = true;
  const successElem = document.getElementById('login-success');
  if (successElem) successElem.hidden = true;
}

async function submitLogin() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const error = document.getElementById('login-error');
  const successElem = document.getElementById('login-success');
  if (successElem) successElem.hidden = true;

  if (!identifier || !password) {
    error.textContent = selectedLoginRole === 'citizen'
      ? 'Please enter your registered identifier and password, or Register New Citizen first.'
      : 'Enter an identifier and password.';
    error.hidden = false;
    return;
  }
  await beginLogin(identifier, password);
}

async function demoLogin() {
  if (selectedLoginRole === 'citizen') {
    const error = document.getElementById('login-error');
    error.textContent = 'For Citizen Access, please Register your account first on the "Register New Citizen" tab.';
    error.hidden = false;
    return;
  }
  const profile = loginProfiles[selectedLoginRole];
  await beginLogin(profile.identifier, 'demo-access');
}

function checkPasswordMatch() {
  const pwd = document.getElementById('reg-password')?.value || '';
  const confirmPwd = document.getElementById('reg-confirm-password')?.value || '';
  const statusElem = document.getElementById('password-match-status');
  if (!statusElem) return;

  if (!pwd && !confirmPwd) {
    statusElem.textContent = '';
    return;
  }
  if (pwd.length > 0 && pwd.length < 8) {
    statusElem.style.color = '#d97706';
    statusElem.textContent = '⚠️ Password must be at least 8 characters';
    return;
  }
  if (confirmPwd.length > 0) {
    if (pwd === confirmPwd) {
      statusElem.style.color = '#059669';
      statusElem.textContent = '✓ Passwords match';
    } else {
      statusElem.style.color = '#dc2626';
      statusElem.textContent = '✗ Passwords do not match';
    }
  } else {
    statusElem.textContent = '';
  }
}

async function submitCitizenRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const identifier = document.getElementById('reg-identifier').value.trim();
  const unitId = document.getElementById('reg-unit').value.trim();
  const state = document.getElementById('reg-state').value.trim();
  const city = document.getElementById('reg-city').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;
  const error = document.getElementById('login-error');

  if (!name || !identifier || !state || !city) {
    error.textContent = 'Please provide your name, identifier, state and city.';
    error.hidden = false;
    return;
  }
  if (password.length < 8) {
    error.textContent = 'Password must be at least 8 characters.';
    error.hidden = false;
    return;
  }
  if (password !== confirmPassword) {
    error.textContent = 'Create Password and Confirm Password must match.';
    error.hidden = false;
    return;
  }

  try {
    const user = await apiRegister(name, identifier, 'citizen', unitId || 'U1204', state, city, password, confirmPassword);

    sessionStorage.setItem('ulpin-session', JSON.stringify({
      role: 'citizen',
      name: user.name || name,
      identifier: user.identifier || identifier,
      unit_id: user.unit_id || unitId || 'U1204',
      state: user.state || state,
      city: user.city || city,
      registered_owner: user.name || name,
      signedInAt: new Date().toISOString()
    }));

    window.location.href = 'citizen.html';
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
  }
}

async function beginLogin(identifier, password) {
  const error = document.getElementById('login-error');
  let userObj = null;
  try {
    userObj = await apiLogin(identifier, selectedLoginRole, password);
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
    return;
  }

  const activeName = userObj?.name || loginProfiles[selectedLoginRole]?.name || identifier.split('@')[0];
  const activeUnit = userObj?.unit_id || null;

  sessionStorage.setItem('ulpin-session', JSON.stringify({
    role: selectedLoginRole,
    name: activeName,
    identifier: identifier,
    unit_id: activeUnit,
    state: userObj?.state || null,
    city: userObj?.city || null,
    signedInAt: new Date().toISOString()
  }));

  window.location.href = `${selectedLoginRole}.html`;
}

const STATE_CITY_DATA = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kakinada", "Kadapa", "Anantapur"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Roing"],
  "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur", "Bongaigaon"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar"],
  "Chandigarh": ["Chandigarh Central", "Sector 17", "Sector 35", "Manimajra", "Industrial Area"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Durg", "Jagdalpur", "Ambikapur"],
  "Delhi": ["Central Delhi", "New Delhi", "South Delhi", "North Delhi", "East Delhi", "West Delhi", "Dwarka", "Rohini", "Connaught Place"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Calangute"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar", "Junagadh", "Anand", "Bharuch"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal", "Sonipat", "Rohtak", "Panchkula", "Hisar", "Yamunanagar"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu", "Manali", "Bilaspur", "Hamirpur"],
  "Jammu & Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua", "Sopore"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh", "Giridih", "Ramgarh", "Medininagar", "Chaibasa"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Davanagere", "Ballari", "Kalaburagi", "Shivamogga", "Tumakuru"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Palakkad", "Alappuzha", "Kannur", "Kottayam", "Malappuram"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Chhatrapati Sambhaji Nagar", "Navi Mumbai", "Solapur", "Kolhapur", "Amravati"],
  "Manipur": ["Imphal", "Churachandpur", "Thoubal", "Bishnupur", "Ukhrul"],
  "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongpoh", "Cherrapunji"],
  "Mizoram": ["Aizawl", "Lunglei", "Champhai", "Serchhip", "Kolasib"],
  "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Bhadrak", "Baripada"],
  "Puducherry": ["Puducherry Town", "Oulgaret", "Karaikal", "Mahe", "Yanam"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali (SAS Nagar)", "Pathankot", "Hoshiarpur", "Moga"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara", "Alwar", "Sikar", "Bharatpur"],
  "Sikkim": ["Gangtok", "Namchi", "Geyzing", "Mangan", "Rangpo"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore", "Tirunelveli", "Thoothukudi"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam", "Mahbubnagar", "Nalgonda", "Secunderabad"],
  "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Kailashahar", "Belonia"],
  "Uttar Pradesh": ["Lucknow", "Noida", "Greater Noida", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Ghaziabad", "Meerut", "Aligarh", "Bareilly", "Gorakhpur"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Rishikesh", "Nainital", "Kashipur"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol", "Bardhaman", "Kharagpur", "Malda", "Haldia", "Darjeeling"]
};

function populateStateDropdown() {
  const stateSelect = document.getElementById('reg-state');
  if (!stateSelect) return;
  stateSelect.innerHTML = '<option value="">-- Select State / UT --</option>';
  Object.keys(STATE_CITY_DATA).sort().forEach(state => {
    const opt = document.createElement('option');
    opt.value = state;
    opt.textContent = state;
    stateSelect.appendChild(opt);
  });
}

function onStateChange() {
  const stateSelect = document.getElementById('reg-state');
  const citySelect = document.getElementById('reg-city');
  if (!stateSelect || !citySelect) return;

  const selectedState = stateSelect.value;
  citySelect.innerHTML = '';

  if (!selectedState || !STATE_CITY_DATA[selectedState]) {
    citySelect.innerHTML = '<option value="">-- Select City / Town --</option>';
    return;
  }

  citySelect.innerHTML = '<option value="">-- Select City / District / Town --</option>';
  const cities = STATE_CITY_DATA[selectedState];
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    citySelect.appendChild(opt);
  });
}

// Support Enter key submission & dropdown initialization
document.addEventListener('DOMContentLoaded', () => {
  populateStateDropdown();
  document.getElementById('login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  document.getElementById('login-identifier')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  document.getElementById('reg-confirm-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCitizenRegister();
  });
});
