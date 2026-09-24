const loginProfiles = {
  citizen: {
    name: 'Dr. Ananya Sharma',
    identifier: 'ananya.sharma@digital.gov.in',
    unit_id: 'U1204',
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
  if (idInput) idInput.value = profile.identifier;
  document.getElementById('login-error').hidden = true;
}

async function submitLogin() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const error = document.getElementById('login-error');
  if (!identifier || !password) {
    error.textContent = 'Enter an identifier and password, or use 1-click prototype access.';
    error.hidden = false;
    return;
  }
  await beginLogin(identifier);
}

async function demoLogin() {
  await beginLogin(document.getElementById('login-identifier').value.trim());
}

async function submitCitizenRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const identifier = document.getElementById('reg-identifier').value.trim();
  const unitId = document.getElementById('reg-unit').value.trim();
  const error = document.getElementById('login-error');

  if (!name || !identifier) {
    error.textContent = 'Please provide your Full Name and Mobile / Email ID.';
    error.hidden = false;
    return;
  }

  try {
    const user = await apiRegister(name, identifier, 'citizen', unitId || 'U1204');

    sessionStorage.setItem('ulpin-session', JSON.stringify({
      role: 'citizen',
      name: user.name || name,
      identifier: user.identifier || identifier,
      unit_id: user.unit_id || unitId || 'U1204',
      signedInAt: new Date().toISOString()
    }));

    window.location.href = 'citizen.html';
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
  }
}

async function beginLogin(identifier) {
  const error = document.getElementById('login-error');
  let userObj = null;
  try {
    userObj = await apiLogin(identifier, selectedLoginRole);
  } catch (requestError) {
    // Fallback profile if offline
    userObj = loginProfiles[selectedLoginRole];
  }

  const activeName = userObj?.name || loginProfiles[selectedLoginRole]?.name || 'Dr. Ananya Sharma';
  const activeUnit = userObj?.unit_id || (selectedLoginRole === 'citizen' ? 'U1204' : null);

  sessionStorage.setItem('ulpin-session', JSON.stringify({
    role: selectedLoginRole,
    name: activeName,
    identifier: identifier,
    unit_id: activeUnit,
    signedInAt: new Date().toISOString()
  }));

  window.location.href = `${selectedLoginRole}.html`;
}
