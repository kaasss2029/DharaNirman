const loginProfiles = {
  citizen: {
    name: 'Dr. Ananya Sharma',
    identifier: 'ananya.sharma@digital.gov.in',
    copy: 'View registered 3D titles, certificates, tax status, and demarcation requests.'
  },
  officer: {
    name: 'R. K. Iyer (DoLR)',
    identifier: 'officer@nic.gov.in',
    copy: 'Review applications, validate topology, approve ULPINs, and issue official certificates.'
  },
  surveyor: {
    name: 'Neha Kulkarni',
    identifier: 'surveyor@survey.gov.in',
    copy: 'Inspect survey layers, prepare draft volumes, and submit technical evidence to DoLR.'
  }
};

let selectedLoginRole = 'citizen';

function selectLoginRole(role) {
  if (!loginProfiles[role]) return;
  selectedLoginRole = role;
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.role === role);
  });
  const profile = loginProfiles[role];
  document.getElementById('login-role-copy').innerHTML =
    `<h3>${role === 'officer' ? 'DoLR officer portal' : role === 'surveyor' ? 'Surveyor technical portal' : 'Citizen property portal'}</h3><p>${profile.copy}</p>`;
  document.getElementById('login-identifier').value = profile.identifier;
  document.getElementById('login-error').hidden = true;
}

async function submitLogin() {
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const error = document.getElementById('login-error');
  if (!identifier || !password) {
    error.textContent = 'Enter an identifier and password, or use demo access.';
    error.hidden = false;
    return;
  }
  await beginLogin(identifier);
}

async function demoLogin() {
  await beginLogin(document.getElementById('login-identifier').value.trim());
}

async function beginLogin(identifier) {
  const error = document.getElementById('login-error');
  try {
    await apiLogin(identifier, selectedLoginRole);
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
    return;
  }
  sessionStorage.setItem('ulpin-session', JSON.stringify({
    role: selectedLoginRole,
    signedInAt: new Date().toISOString()
  }));
  window.location.href = `${selectedLoginRole}.html`;
}
