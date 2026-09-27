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
  try {
    const cases = await apiRequest('/api/cases');
    renderCases(cases, 'live-cases', role === 'citizen' ? 'No requests submitted yet.' : 'No assigned cases.');
    const count = document.getElementById('live-case-count');
    if (count) count.textContent = cases.length;
    return cases;
  } catch (error) {
    portalAction(`Could not load cases: ${error.message}`);
    renderCases([], 'live-cases', 'Unable to load cases.');
    return [];
  }
}

async function loadCitizenProperties() {
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  let properties;
  try {
    properties = await apiListProperties();
  } catch (error) {
    portalAction(`Could not load registered properties: ${error.message}`);
    return [];
  }

  const property = (properties && properties.length > 0) ? properties[0] : null;
  const unitId = property?.unit_id || session.unit_id || 'U1204';
  const propertyUlpin = property?.property_ulpin || session.property_ulpin || `IN-2187-4930-1049-A-${unitId}`;
  const propertyTitle = property?.title || `Apartment Unit #${unitId}`;
  const propertyFloor = property?.floor || (unitId === 'U0401' ? 'Floor 4' : unitId === 'U0602' ? 'Floor 6' : unitId === 'U1204' ? 'Floor 12' : 'Floor 1');

  if (property) {
    session.unit_id = property.unit_id;
    session.property_ulpin = property.property_ulpin;
    session.registered_owner = property.owner_name || session.name;
    sessionStorage.setItem('ulpin-session', JSON.stringify(session));
  }

  const propertyLabel = document.querySelector('[data-citizen-property]');
  if (propertyLabel) {
    propertyLabel.textContent = `${unitId} · ${propertyUlpin}`;
  }
  const unitMetric = document.querySelector('[data-citizen-unit]');
  if (unitMetric) unitMetric.textContent = unitId;
  const propertyTitleElem = document.querySelector('[data-citizen-property-title]');
  if (propertyTitleElem) propertyTitleElem.textContent = `${propertyTitle} · ${propertyFloor}`;

  const roleBadge = document.querySelector('.role-badge');
  if (roleBadge) {
    roleBadge.textContent = `Citizen / Unit #${unitId} Owner`;
  }

  // Dynamic Volumetric metrics
  const unitSpecs = {
    'U0401': { area: '118.0 m²', vol: '354.0 m³', elev: '+10.8m to +14.4m', strata: '1.54% of Base Parcel' },
    'U0602': { area: '120.0 m²', vol: '360.0 m³', elev: '+18.0m to +21.2m', strata: '1.56% of Base Parcel' },
    'U1204': { area: '128.0 m²', vol: '384.2 m³', elev: '+36.5m to +39.8m', strata: '1.82% of Base Parcel' },
    'U1201': { area: '137.5 m²', vol: '412.5 m³', elev: '+36.5m to +39.8m', strata: '1.95% of Base Parcel' },
    'U0101': { area: '125.0 m²', vol: '375.0 m³', elev: '+0.8m to +4.4m', strata: '1.63% of Base Parcel' },
    'SURFACE': { area: '1,600.0 m²', vol: '800.0 m³', elev: '0.0m to +0.5m', strata: '100% Master Title' },
    'BASEMENT1': { area: '45.0 m²', vol: '135.0 m³', elev: '-6.0m to -3.0m', strata: '0.59% of Base Parcel' },
  };
  const spec = unitSpecs[unitId] || (property ? {
    area: `${property.area} m²`,
    vol: `${property.volume} m³`,
    elev: `+${property.z_min}m to +${property.z_max}m`,
    strata: '1.50% of Base Parcel'
  } : { area: '118.0 m²', vol: '354.0 m³', elev: '+10.8m to +14.4m', strata: '1.54% of Base Parcel' });

  const areaElem = document.getElementById('citizen-area');
  if (areaElem) areaElem.textContent = spec.area;
  const volElem = document.getElementById('citizen-vol');
  if (volElem) volElem.textContent = spec.vol;
  const elevElem = document.getElementById('citizen-elev');
  if (elevElem) elevElem.textContent = spec.elev;
  const strataElem = document.getElementById('citizen-strata');
  if (strataElem) strataElem.textContent = spec.strata;

  return properties;
}

async function createCitizenCase() {
  const requestType = document.getElementById('request-type')?.value || 'demarcation';
  const notes = document.getElementById('request-notes')?.value || '';
  try {
    const session = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
    const unitId = session.unit_id || 'unknown unit';
    const propertyUlpin = session.property_ulpin;
    if (!propertyUlpin) {
      portalAction('No registered 3D ULPIN is linked to this account. Register or claim a unit before submitting a request.');
      return;
    }
    const caseItem = await apiRequest('/api/cases', {
      method: 'POST',
      body: JSON.stringify({
        title: `${requestType.replace('_', ' ')} request for Unit #${unitId}`,
        request_type: requestType,
        property_ulpin: propertyUlpin,
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
  if (name) name.textContent = session.name || ROLE_NAMES[expectedRole];
  const citizenName = document.getElementById('citizen-name');
  if (citizenName && expectedRole === 'citizen') citizenName.textContent = session.name || ROLE_NAMES.citizen;
  try {
    if (expectedRole === 'citizen') {
      await loadCitizenProperties();
      await loadPortalCases(expectedRole);
    }
    if (expectedRole === 'officer') await loadOfficerCases();
    if (expectedRole === 'surveyor') {
      await loadSurveyorCases();
      await prepareSurveyCaseSelector();
    }
  } catch (error) {
    portalAction(`Backend connection failed: ${error.message}`);
  }
});
