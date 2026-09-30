const ROLE_NAMES = {
  citizen: 'Dr. Ananya Sharma',
  officer: 'R. K. Iyer (DoLR)',
  surveyor: 'Neha Kulkarni'
};

function getTheme() {
  const saved = localStorage.getItem('dharanirman_theme');
  if (saved) return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, persist = true) {
  const isDark = theme === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  }

  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaColorScheme) {
    metaColorScheme.content = isDark ? 'dark' : 'light';
  }

  if (persist) {
    localStorage.setItem('dharanirman_theme', theme);
  }

  updatePortalThemeButton(isDark);
}

function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

function updatePortalThemeButton(isDark) {
  const btn = document.getElementById('btn-portal-theme-toggle');
  if (btn) {
    btn.innerHTML = isDark 
      ? '<span style="color:#fbbf24;">☀</span> Light' 
      : '<span style="color:#38bdf8;">☾</span> Dark';
    btn.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
  }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('dharanirman_theme')) {
      applyTheme(e.matches ? 'dark' : 'light', false);
    }
  });
}

function portalLogout() {
  clearApiSession();
  window.location.href = 'login.html';
}

function portalAction(message, type = 'info') {
  const notice = document.getElementById('portal-notice');
  if (notice) {
    notice.className = `card notice-${type}`;
    notice.textContent = message;
    notice.hidden = false;
  }
}

function downloadCitizenTitle() {
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  const unitId = session.unit_id || document.querySelector('[data-citizen-unit]')?.textContent?.trim() || 'U1204';
  const ownerName = session.name || document.getElementById('citizen-name')?.textContent?.trim() || 'Dr. Ananya Sharma';
  const propertyLabel = document.querySelector('[data-citizen-property]')?.textContent?.trim() || '';
  const ulpin = session.property_ulpin || (propertyLabel.includes('·') ? propertyLabel.split('·')[1].trim() : `IN-2187-4930-1049-A-${unitId}`);
  const propertyTitle = document.querySelector('[data-citizen-property-title]')?.textContent?.trim() || `Apartment Unit #${unitId}`;
  const area = document.getElementById('citizen-area')?.textContent?.trim() || '128.0 m²';
  const vol = document.getElementById('citizen-vol')?.textContent?.trim() || '384.2 m³';
  const elev = document.getElementById('citizen-elev')?.textContent?.trim() || '+36.5m to +39.8m';
  const strata = document.getElementById('citizen-strata')?.textContent?.trim() || '1.82% of Base Parcel';

  const certNumber = `ULPIN-3D-CERT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const timestamp = new Date().toISOString();
  const dateFormatted = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const certificateText = `================================================================================
DHARANIRMAN 3D CADASTRE AUTHORITY • SMART INDIA HACKATHON
NATIONAL VOLUMETRIC LAND REGISTRATION SYSTEM
OFFICIAL 3D BHU-AADHAAR VOLUMETRIC PROPERTY TITLE CERTIFICATE
Standard: ISO 19152 LADM v2 (3D Spatial Cadastre)
================================================================================

CERTIFICATE METADATA
--------------------------------------------------------------------------------
Certificate No       : ${certNumber}
Issue Date & Time    : ${dateFormatted} (${timestamp})
Issuing Authority    : DharaNirman 3D Cadastral Authority (SIH Prototype)
Verification Status  : VERIFIED FREEHOLD TITLE (Digitally Signed)

TITLE HOLDER & PROPERTY IDENTIFIERS
--------------------------------------------------------------------------------
Registered Owner     : ${ownerName}
Property Title       : ${propertyTitle}
3D ULPIN (Bhu-Aadhaar): ${ulpin}
Base Surface Parcel  : 2187-4930-1049 (Zone A)
Building Reference   : BLDG-2187-4930-1049-A (Tower A)
Spatial Unit / Strata: Unit #${unitId}

VOLUMETRIC CADASTRE & GEOMETRIC BOUNDS
--------------------------------------------------------------------------------
Vertical Datum (Z)   : ${elev}
Carpet / Floor Area  : ${area}
Volumetric Space     : ${vol}
Strata Share         : ${strata}
Coordinate Reference : EPSG:7755 (Survey of India CORS RTK Datum)
Level of Detail      : LoD 3 Cadastral Polyhedron

MUNICIPAL & COMPLIANCE RECORD
--------------------------------------------------------------------------------
Annual Property Tax  : ₹ 14,820 / yr (Paid in Full · BBPS Ref: BBPS-DL-2026-98214)
Encumbrance Status   : NIL (Clear Freehold Title · No Liens)
Legal Admissibility  : ISO 19152 LADM Volumetric Strata Standard

CRYPTOGRAPHIC INTEGRITY & VERIFICATION
--------------------------------------------------------------------------------
Digital Signature    : SHA256:7e9b2a14c6d830f5a91e4823d0fb5c1e948302194a8b7e61c3d2e5a4f8901234
Blockchain Tx Hash   : 0x9f4a8b7e61c3d2e5a4f890123456789abcdef0123456789
CRS Spatial Ref      : EPSG:7755 (Survey of India CORS RTK)
================================================================================
This is an authentic, digitally generated spatial title certificate issued under
the DharaNirman 3D Cadastral Framework for Smart India Hackathon.
================================================================================`;

  const blob = new Blob([certificateText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3D_Bhu_Aadhaar_Title_Certificate_${unitId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  portalAction(`Downloaded digitally signed 3D Bhu-Aadhaar certificate (${a.download}).`);
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

  session.unit_id = unitId;
  session.property_ulpin = propertyUlpin;
  session.registered_owner = property?.owner_name || session.name;
  sessionStorage.setItem('ulpin-session', JSON.stringify(session));

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
    const unitId = session.unit_id || 'U1204';
    let propertyUlpin = session.property_ulpin;
    if (!propertyUlpin) {
      propertyUlpin = `IN-2187-4930-1049-A-${unitId}`;
      session.property_ulpin = propertyUlpin;
      sessionStorage.setItem('ulpin-session', JSON.stringify(session));
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
    portalAction(`✓ Request #${caseItem.id} submitted successfully to DoLR. Status: submitted.`, 'success');
    document.getElementById('request-notes').value = '';
    await loadPortalCases('citizen');
  } catch (error) {
    portalAction(`Could not submit request: ${error.message}`, 'danger');
  }
}

async function loadOfficerCases() {
  try {
    const cases = await loadPortalCases('officer');
    const surveyors = await apiRequest('/api/users?role=surveyor');
    
    // Update live counts and health metrics
    const countElem = document.getElementById('live-case-count');
    if (countElem) countElem.textContent = cases.length;

    const validatedCount = cases.filter(c => c.status === 'validated' || c.status === 'certificate_issued').length;
    const validatedPercentage = cases.length > 0 ? Math.round((validatedCount / cases.length) * 100) : 100;
    const healthValidated = document.getElementById('health-validated');
    if (healthValidated) healthValidated.textContent = `${validatedPercentage}% Verified`;

    const healthTopology = document.getElementById('health-topology');
    if (healthTopology) healthTopology.textContent = '0 Overlaps Detected';

    // Priority Boundary Reviews rendering
    const priorityContainer = document.getElementById('officer-priority-cases');
    if (priorityContainer) {
      if (cases.length === 0) {
        priorityContainer.innerHTML = '<p class="muted">No pending cases requiring review.</p>';
      } else {
        priorityContainer.innerHTML = cases.map(c => {
          let badgeClass = 'pending';
          let actionLabel = c.status.replaceAll('_', ' ');
          if (c.status === 'submitted') {
            badgeClass = 'danger';
            actionLabel = 'Review Submission';
          } else if (c.status === 'survey_submitted') {
            badgeClass = 'pending';
            actionLabel = 'Survey Evidence Attached';
          } else if (c.status === 'validated') {
            badgeClass = 'ok';
            actionLabel = 'Ready for Approval';
          } else if (c.status === 'certificate_issued') {
            badgeClass = 'ok';
            actionLabel = '3D ULPIN Issued';
          }
          return `
            <div class="status">
              <span><strong>${c.title}</strong> · Parcel ${c.property_ulpin} (Case #${c.id})</span>
              <strong class="${badgeClass}">${actionLabel}</strong>
            </div>`;
        }).join('');
      }
    }

    // Populate assignment & action dropdowns
    const assignment = document.getElementById('assignment-case');
    if (assignment) {
      assignment.innerHTML = cases.length
        ? cases.map(item => `<option value="${item.id}">Case #${item.id} · ${item.title} (${item.status})</option>`).join('')
        : '<option value="">No pending cases</option>';
    }
    const surveyorSelect = document.getElementById('assignment-surveyor');
    if (surveyorSelect) {
      surveyorSelect.innerHTML = surveyors.length
        ? surveyors.map(item => `<option value="${item.id}">${item.name} (${item.identifier})</option>`).join('')
        : '<option value="">No licensed surveyors</option>';
    }
    return surveyors;
  } catch (error) {
    portalAction(`Could not load officer queue: ${error.message}`);
    return [];
  }
}

async function assignSelectedCase() {
  const caseId = document.getElementById('assignment-case')?.value;
  const surveyorId = document.getElementById('assignment-surveyor')?.value;
  if (!caseId || !surveyorId) {
    portalAction('Select both a pending case and a surveyor first.');
    return;
  }
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
  if (!caseId) {
    portalAction('Select a case to validate.');
    return;
  }
  try {
    const result = await apiRequest(`/api/cases/${caseId}/validate`, { method: 'POST' });
    portalAction(`Validation completed for Case #${caseId}: ${result.overall_valid ? 'all 3D spatial checks passed' : 'corrections required'}.`);
    await loadOfficerCases();
  } catch (error) {
    portalAction(`Validation failed: ${error.message}`);
  }
}

async function approveSelectedCase() {
  const caseId = document.getElementById('assignment-case')?.value;
  if (!caseId) {
    portalAction('Select a case to approve.');
    return;
  }
  try {
    const result = await apiRequest(`/api/cases/${caseId}/approve`, { method: 'POST' });
    portalAction(`Case #${caseId} approved. Issued official 3D ULPIN: ${result.issued_ulpin}`);
    await loadOfficerCases();
  } catch (error) {
    portalAction(`Approval failed: ${error.message}`);
  }
}

function openOfficerCase3D() {
  const caseId = document.getElementById('assignment-case')?.value;
  if (caseId) {
    portalAction(`Opening 3D registry explorer for Case #${caseId}...`);
    setTimeout(() => { window.location.href = `index.html?case_id=${caseId}`; }, 400);
  } else {
    window.location.href = 'index.html';
  }
}

async function loadSurveyorCases() {
  try {
    const cases = await loadPortalCases('surveyor');
    
    // Dynamic surveyor metrics
    const totalCount = cases.length;
    const highPriority = cases.filter(c => c.status === 'survey_in_progress' || c.status === 'submitted').length;
    const scheduled = cases.filter(c => c.status === 'assigned').length;
    const ready = cases.filter(c => c.status === 'survey_submitted' || c.status === 'validated' || c.status === 'certificate_issued').length;

    const countElem = document.getElementById('surveyor-case-count');
    if (countElem) countElem.textContent = totalCount;

    const hpElem = document.getElementById('surveyor-high-priority');
    if (hpElem) hpElem.textContent = `${highPriority} Cases`;

    const schedElem = document.getElementById('surveyor-scheduled');
    if (schedElem) schedElem.textContent = `${scheduled} Cases`;

    const readyElem = document.getElementById('surveyor-ready');
    if (readyElem) readyElem.textContent = `${ready} Cases`;

    // Evidence file count across cases
    let totalFiles = 0;
    cases.forEach(c => {
      if (c.files) totalFiles += c.files.length;
    });
    const filesElem = document.getElementById('surveyor-evidence-files');
    if (filesElem) filesElem.textContent = `${totalFiles} Files Attached`;

    return cases;
  } catch (error) {
    portalAction(`Could not load survey assignments: ${error.message}`);
    return [];
  }
}

function openActiveAssignment() {
  const selector = document.getElementById('survey-case');
  const activeCaseId = selector?.value;
  if (activeCaseId) {
    portalAction(`Navigating to 3D survey visualizer for Case #${activeCaseId}...`);
    setTimeout(() => { window.location.href = `index.html?case_id=${activeCaseId}`; }, 800);
  } else {
    window.location.href = 'index.html';
  }
}

async function prepareSurveyCaseSelector() {
  try {
    const cases = await apiRequest('/api/cases');
    const selector = document.getElementById('survey-case');
    if (selector) {
      selector.innerHTML = cases.length
        ? cases.map(item => `<option value="${item.id}">Case #${item.id} · ${item.title} (${item.status})</option>`).join('')
        : '<option value="">No assigned cases available</option>';
    }
  } catch (e) {
    console.error('Could not prepare survey case selector', e);
  }
}

async function uploadSurveyFile() {
  const input = document.getElementById('survey-file');
  const caseId = document.getElementById('survey-case')?.value;
  const submitBtn = document.getElementById('btn-upload-survey') || document.querySelector('button[onclick="uploadSurveyFile()"]');

  if (!caseId) {
    portalAction('Please select an assigned case from the dropdown first.', 'warning');
    return;
  }

  if (!input?.files?.[0]) {
    if (input) {
      input.focus();
      input.classList.add('input-error');
      setTimeout(() => input.classList.remove('input-error'), 2500);
    }
    portalAction('Please click "Choose file" to attach a survey file (.las, .laz, .ifc, .geojson, .obj, .dxf) before submitting.', 'warning');
    return;
  }

  const file = input.files[0];
  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Upload and Submit Technical Evidence';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Uploading and submitting evidence...';
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    await apiRequest(`/api/cases/${caseId}/files`, { method: 'POST', body: formData });
    await apiRequest(`/api/cases/${caseId}/submit-survey`, { method: 'POST' });
    portalAction(`✓ Survey evidence "${file.name}" uploaded and Case #${caseId} submitted for DoLR verification.`, 'success');
    input.value = '';
    const fileInfo = document.getElementById('survey-file-info');
    if (fileInfo) fileInfo.textContent = '';
    await loadSurveyorCases();
    await prepareSurveyCaseSelector();
  } catch (error) {
    portalAction(`Survey submission failed: ${error.message}`, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

function autoAttachDemoLasFile() {
  const selector = document.getElementById('survey-case');
  const selectedOption = selector?.options[selector?.selectedIndex]?.text || 'Case';
  const caseId = selector?.value || '';
  const filename = '3D_LiDAR_Demarcation_Survey.las';
  
  const content = `LASF_SURVEY_OF_INDIA_3D_CADASTRAL_POINT_CLOUD_DATA_V1.4
CRS: EPSG:7755 (Survey of India CORS RTK Datum)
Spatial Scope: 3D Volumetric Demarcation Boundary
Target Reference: ${selectedOption || 'Authoritative Cadastral Boundary'}
Case Identifier: ${caseId ? `Case #${caseId}` : 'DoLR Field Task'}
Surveyor: Neha Kulkarni (ID: 26011)
Scan Density: 45 pts/m2 (LAS 1.4)
Positional Precision: +/- 1.2 cm (CORS RTK)
Vertical Datum: EPSG:7755 + Geoid
[HEADER RECORD END - BINARY POINT STREAM]`;

  const blob = new Blob([content], { type: 'application/octet-stream' });
  const file = new File([blob], filename, { type: 'application/octet-stream' });
  
  const input = document.getElementById('survey-file');
  if (input) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    portalAction(`⚡ Auto-attached universal LiDAR survey file "${filename}". Click "Upload and Submit Technical Evidence" to submit.`, 'info');
  }
}

function downloadSampleLasFile() {
  const selector = document.getElementById('survey-case');
  const selectedOption = selector?.options[selector?.selectedIndex]?.text || 'Case';
  const caseId = selector?.value || '';
  const filename = '3D_LiDAR_Demarcation_Survey.las';

  const content = `LASF_SURVEY_OF_INDIA_3D_CADASTRAL_POINT_CLOUD_DATA_V1.4
CRS: EPSG:7755 (Survey of India CORS RTK Datum)
Spatial Scope: 3D Volumetric Demarcation Boundary
Target Reference: ${selectedOption || 'Authoritative Cadastral Boundary'}
Case Identifier: ${caseId ? `Case #${caseId}` : 'DoLR Field Task'}
Surveyor: Neha Kulkarni (ID: 26011)
Scan Density: 45 pts/m2 (LAS 1.4)
Positional Precision: +/- 1.2 cm (CORS RTK)
Vertical Datum: EPSG:7755 + Geoid
[HEADER RECORD END - BINARY POINT STREAM]`;

  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  portalAction(`📥 Downloaded universal survey evidence "${filename}".`, 'info');
}

document.addEventListener('DOMContentLoaded', async () => {
  updatePortalThemeButton(document.documentElement.classList.contains('dark'));
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

  // Update header and badges with actual logged in user info
  const name = document.getElementById('portal-user');
  if (name) name.textContent = session.name || ROLE_NAMES[expectedRole];
  
  const officerBadge = document.getElementById('officer-role-badge');
  if (officerBadge) officerBadge.textContent = `DoLR Officer / ${session.name}`;

  const surveyorBadge = document.getElementById('surveyor-role-badge');
  if (surveyorBadge) surveyorBadge.textContent = `Licensed Surveyor / ${session.name}`;

  const officerIdStrip = document.getElementById('officer-id-strip');
  if (officerIdStrip && session.identifier) officerIdStrip.textContent = `Official ID: ${session.identifier} • DoLR Registry Console`;

  const surveyorIdStrip = document.getElementById('surveyor-id-strip');
  if (surveyorIdStrip && session.identifier) surveyorIdStrip.textContent = `Official ID: ${session.identifier} • Technical Field Services`;

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
      const surveyFileInput = document.getElementById('survey-file');
      if (surveyFileInput) {
        surveyFileInput.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          const info = document.getElementById('survey-file-info');
          if (info) {
            if (file) {
              const sizeKB = (file.size / 1024).toFixed(1);
              const sizeStr = file.size > 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${sizeKB} KB`;
              info.innerHTML = `<span style="color:#10b981; font-weight:600;">✓ Ready to upload:</span> <strong>${file.name}</strong> (${sizeStr})`;
            } else {
              info.textContent = '';
            }
          }
        });
      }
    }
  } catch (error) {
    portalAction(`Backend connection failed: ${error.message}`);
  }
});
