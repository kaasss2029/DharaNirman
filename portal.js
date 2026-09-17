const ROLE_NAMES = {
  citizen: 'Dr. Ananya Sharma',
  officer: 'R. K. Iyer (DoLR)',
  surveyor: 'Neha Kulkarni'
};

function portalLogout() {
  clearApiSession();
  window.location.href = 'login.html';
}

function portalAction(message) {
  const notice = document.getElementById('portal-notice');
  if (notice) {
    notice.textContent = message;
    notice.hidden = false;
  }
}

function renderCases(cases, containerId, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!cases.length) {
    container.innerHTML = `<p class="muted">${emptyMessage}</p>`;
    return;
  }
  container.innerHTML = cases.map(caseItem => `
    <div class="status case-row">
      <div><strong>${caseItem.title}</strong><small>${caseItem.property_ulpin} · Case #${caseItem.id}</small></div>
      <strong class="${caseItem.status === 'certificate_issued' ? 'ok' : 'pending'}">${caseItem.status.replaceAll('_', ' ')}</strong>
    </div>`).join('');
}

async function loadPortalCases(role) {
  const cases = await apiRequest('/api/cases');
  renderCases(cases, 'live-cases', role === 'citizen' ? 'No requests submitted yet.' : 'No assigned cases.');
  const count = document.getElementById('live-case-count');
  if (count) count.textContent = cases.length;
  return cases;
}

async function createCitizenCase() {
  const requestType = document.getElementById('request-type')?.value || 'demarcation';
  const notes = document.getElementById('request-notes')?.value || '';
  try {
    const caseItem = await apiRequest('/api/cases', {
      method: 'POST',
      body: JSON.stringify({
        title: `${requestType.replace('_', ' ')} request for Unit #1204`,
        request_type: requestType,
        property_ulpin: '2187-4930-1049',
        notes
      })
    });
    portalAction(`Request #${caseItem.id} submitted successfully. Status: submitted.`);
    await loadPortalCases('citizen');
  } catch (error) {
    portalAction(`Could not submit request: ${error.message}`);
  }
}

async function loadOfficerCases() {
  try {
    const cases = await loadPortalCases('officer');
    const surveyors = await apiRequest('/api/users?role=surveyor');
    const assignment = document.getElementById('assignment-case');
    if (assignment) {
      assignment.innerHTML = cases.map(item => `<option value="${item.id}">Case #${item.id} · ${item.title}</option>`).join('');
    }
    const surveyorSelect = document.getElementById('assignment-surveyor');
    if (surveyorSelect) surveyorSelect.innerHTML = surveyors.map(item => `<option value="${item.id}">${item.name} · ${item.identifier}</option>`).join('');
    return surveyors;
  } catch (error) {
    portalAction(`Could not load officer queue: ${error.message}`);
    return [];
  }
}

async function assignSelectedCase() {
  const caseId = document.getElementById('assignment-case')?.value;
  const surveyorId = document.getElementById('assignment-surveyor')?.value;
  try {
    await apiRequest(`/api/cases/${caseId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ surveyor_id: Number(surveyorId) })
    });
    portalAction(`Case #${caseId} assigned to the selected surveyor.`);
    await loadOfficerCases();
  } catch (error) {
    portalAction(`Assignment failed: ${error.message}`);
  }

  async function validateSelectedCase() {
    const caseId = document.getElementById('assignment-case')?.value;
    try {
      const result = await apiRequest(`/api/cases/${caseId}/validate`, { method: 'POST' });
      portalAction(`Validation completed for Case #${caseId}: ${result.overall_valid ? 'all checks passed' : 'corrections required'}.`);
    } catch (error) {
      portalAction(`Validation failed: ${error.message}`);
    }
  }

  async function approveSelectedCase() {
    const caseId = document.getElementById('assignment-case')?.value;
    try {
      const result = await apiRequest(`/api/cases/${caseId}/approve`, { method: 'POST' });
      portalAction(`Case #${caseId} approved. Issued 3D ULPIN: ${result.issued_ulpin}`);
      await loadOfficerCases();
    } catch (error) {
      portalAction(`Approval failed: ${error.message}`);
    }
  }
}

async function loadSurveyorCases() {
  try {
    await loadPortalCases('surveyor');
  } catch (error) {
    portalAction(`Could not load survey assignments: ${error.message}`);
  }
}

async function prepareSurveyCaseSelector() {
  const cases = await apiRequest('/api/cases');
  const selector = document.getElementById('survey-case');
  if (selector) selector.innerHTML = cases.map(item => `<option value="${item.id}">Case #${item.id} · ${item.title}</option>`).join('');
}

async function uploadSurveyFile() {
  const input = document.getElementById('survey-file');
  const caseId = document.getElementById('survey-case')?.value;
  if (!input?.files?.[0] || !caseId) {
    portalAction('Select an assigned case and a survey file first.');
    return;
  }
  const formData = new FormData();
  formData.append('file', input.files[0]);
  try {
    await apiRequest(`/api/cases/${caseId}/files`, { method: 'POST', body: formData });
    await apiRequest(`/api/cases/${caseId}/submit-survey`, { method: 'POST' });
    portalAction(`Survey evidence uploaded and Case #${caseId} submitted for validation.`);
    await loadSurveyorCases();
  } catch (error) {
    portalAction(`Survey submission failed: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const expectedRole = document.body.dataset.role;
  let session = null;
  try {
    session = JSON.parse(sessionStorage.getItem('ulpin-session') || 'null');
  } catch (error) {
    session = null;
  }
  if (!session || session.role !== expectedRole || !apiToken()) {
    window.location.href = 'login.html';
    return;
  }
  const name = document.getElementById('portal-user');
  if (name) name.textContent = ROLE_NAMES[expectedRole];
  try {
    if (expectedRole === 'citizen') await loadPortalCases(expectedRole);
    if (expectedRole === 'officer') await loadOfficerCases();
    if (expectedRole === 'surveyor') {
      await loadSurveyorCases();
      await prepareSurveyCaseSelector();
    }
  } catch (error) {
    portalAction(`Backend connection failed: ${error.message}`);
  }
});
