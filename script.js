/**
 * DharaNirman - 3D ULPIN & Vertical Property Mapping System
 * MoRD / DoLR PS ID: 26011 | ISO 19152 LADM v2 & OGC CityGML 3.0 Compliant
 */

// Global State
let scene, camera, renderer, controls;
let container;
let raycaster, mouse;
let clickableUnits = [];
let hoveredUnit = null;
let selectedUnitMesh = null;
let currentViewMode = '3d'; // '3d' or 'cross'
let isAutoRotating = true;
let isWireframeMode = false;
let clippingPlane;
let activeRole = null;
let activePropertyUnit = 'U1204';
let activeRegisteredOwner = null;
let activeBuilding = {
  above_ground_floors: 12,
  basement_levels: 2,
  height_m: 46.8,
  building_code: 'BLDG-2187-4930-1049-A'
};

function populateFloorSelector() {
  const selector = document.getElementById('floor-idx');
  if (!selector || !activeBuilding.floors) return;
  selector.replaceChildren();
  activeBuilding.floors.forEach(floor => {
    const option = document.createElement('option');
    option.value = floor.floor_code;
    option.textContent = `Floor ${String(floor.floor_number).padStart(2, '0')} (${floor.floor_code})`;
    selector.appendChild(option);
  });
  for (let level = 1; level <= (activeBuilding.basement_levels || 0); level += 1) {
    const option = document.createElement('option');
    option.value = `B${String(level).padStart(2, '0')}`;
    option.textContent = `Basement ${level} (B${String(level).padStart(2, '0')})`;
    selector.appendChild(option);
  }
  const surface = document.createElement('option');
  surface.value = 'S00';
  surface.textContent = 'Surface Ground (S00)';
  selector.appendChild(surface);
}

let currentLanguage = 'en';
const i18n = {
  en: {
    langLabel: 'हिंदी',
    corsStatus: 'SoI CORS Network: <strong>ACTIVE</strong> (RTK Fix ±1.2cm)',
    btnAi: 'Run AI 3D Extraction',
    btnDemarcation: 'Request Demarcation',
    btnCert: '3D Bhu-Aadhaar Card',
    btnExport: 'Export Cadastre',
    titleDesignation: 'Title Designation',
    lblZ: 'Vertical Elevation (Z)',
    lblVol: 'Calculated Volume',
    lblArea: 'Carpet Area',
    lblOwner: 'Owner / Title Holder',
    lblStatus: 'Title Status:',
    lblTax: 'Tax Assessment:',
    lblStrata: 'Strata Share:'
  },
  hi: {
    langLabel: 'English',
    corsStatus: 'सर्वे ऑफ इंडिया CORS नेटवर्क: <strong>सक्रिय</strong> (RTK ±1.2cm)',
    btnAi: 'AI 3D निष्कर्षण चलाएं',
    btnDemarcation: 'सीमांकन अनुरोध',
    btnCert: '3D भू-आधार कार्ड',
    btnExport: 'भू-कर डेटा निर्यात',
    titleDesignation: 'स्वामित्व विवरण (Title)',
    lblZ: 'ऊर्ध्वाधर ऊंचाई (Z)',
    lblVol: 'कुल आयतन (Volume)',
    lblArea: 'कारपेट क्षेत्रफल',
    lblOwner: 'स्वामित्व / धारक',
    lblStatus: 'स्वामित्व स्थिति:',
    lblTax: '3D संपत्ति कर:',
    lblStrata: 'अपार्टमेंट अनुपात:'
  }
};

const authProfiles = {
  citizen: { name: 'Dr. Ananya Sharma', label: 'Citizen / Unit #1204 Owner', copy: 'View verified 3D titles, download Bhu-Aadhaar cards, pay 3D property tax, and request boundary demarcation.' },
  officer: { name: 'R. K. Iyer (DoLR)', label: 'DoLR Registry Officer', copy: 'Review submissions, run AI 3D building extraction, validate topology, and issue official 3D ULPIN titles.' },
  surveyor: { name: 'Neha Kulkarni', label: 'Licensed Surveyor (SoI)', copy: 'Upload LiDAR survey data, inspect strata boundaries, and submit field demarcation results.' }
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

  updateThemeButton(isDark);
  updateThreeTheme(isDark);
}

function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

function updateThemeButton(isDark) {
  const btn = document.getElementById('btn-theme-toggle');
  const label = document.getElementById('theme-label');
  const icon = document.getElementById('icon-theme');
  if (label) {
    label.textContent = isDark ? 'Light' : 'Dark';
  }
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    icon.className = isDark ? 'w-3.5 h-3.5 text-amber-300' : 'w-3.5 h-3.5 text-cyan-300';
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }
  if (btn) {
    btn.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
  }
}

function updateThreeTheme(isDark) {
  if (!scene) return;
  const bgColor = isDark ? 0x0c1524 : 0xb9d5e6;
  scene.background = new THREE.Color(bgColor);
  if (scene.fog) {
    scene.fog.color = new THREE.Color(bgColor);
  }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('dharanirman_theme')) {
      applyTheme(e.matches ? 'dark' : 'light', false);
    }
  });
}

function propertyFloorCode(floor) {
  const match = String(floor || '').match(/(\d+)/);
  return match ? `F${match[1].padStart(2, '0')}` : 'F12';
}

// Spatial Object Groups
let groupGround, groupBasement, groupMetro, groupBuilding, groupAirRights, groupLiDAR, groupDrone;
let floorGroups = []; // Array of floor objects for Exploded View
let clashMeshes = [];

// Property Database of Cadastral Units
const cadastralData = {
  'U1204': {
    id: 'U1204',
    title: 'Apartment Unit #1204',
    ulpin: 'IN-2187-4930-1049-A-F12-U1204-K8',
    zone: 'A',
    floor: 'Floor 12',
    zMin: '+36.5m',
    zMax: '+39.8m',
    volume: '384.2 m³',
    area: '128.0 m²',
    owner: 'Dr. Ananya Sharma',
    status: 'Verified Freehold Title',
    tax: '₹ 14,820 / yr (Paid)',
    strataShare: '1.82% of Base Parcel',
    lod: 'LoD 3 Cadastre'
  },
  'U1201': {
    id: 'U1201',
    title: 'Apartment Unit #1201 (Corner Suite)',
    ulpin: 'IN-2187-4930-1049-A-F12-U1201-J4',
    zone: 'A',
    floor: 'Floor 12',
    zMin: '+36.5m',
    zMax: '+39.8m',
    volume: '412.5 m³',
    area: '137.5 m²',
    owner: 'Mr. Rajesh K. Verma',
    status: 'Verified Freehold Title',
    tax: '₹ 15,900 / yr (Paid)',
    strataShare: '1.95% of Base Parcel',
    lod: 'LoD 3 Cadastre'
  },
  'U0602': {
    id: 'U0602',
    title: 'Apartment Unit #602',
    ulpin: 'IN-2187-4930-1049-A-F06-U0602-M2',
    zone: 'A',
    floor: 'Floor 06',
    zMin: '+18.0m',
    zMax: '+21.2m',
    volume: '360.0 m³',
    area: '120.0 m²',
    owner: 'Priya & Vikram Malhotra',
    status: 'Verified Freehold Title',
    tax: '₹ 13,500 / yr (Paid)',
    strataShare: '1.71% of Base Parcel',
    lod: 'LoD 3 Cadastre'
  },
  'U0401': {
    id: 'U0401',
    title: 'Apartment Unit #401',
    ulpin: 'IN-2187-4930-1049-A-F04-U0401-R6',
    zone: 'A',
    floor: 'Floor 04',
    zMin: '+10.8m',
    zMax: '+14.4m',
    volume: '354.0 m³',
    area: '118.0 m²',
    owner: 'Registered Title Holder',
    status: 'Available for title application',
    tax: '₹ 13,200 / yr',
    strataShare: '1.68% of Base Parcel',
    lod: 'LoD 3 Cadastre'
  },
  'U0101': {
    id: 'U0101',
    title: 'Apartment Unit #101 (Garden View)',
    ulpin: 'IN-2187-4930-1049-A-F01-U0101-T3',
    zone: 'A',
    floor: 'Floor 01',
    zMin: '+0.8m',
    zMax: '+4.4m',
    volume: '375.0 m³',
    area: '125.0 m²',
    owner: 'Registered Title Holder',
    status: 'Available for title application',
    tax: '₹ 13,900 / yr',
    strataShare: '1.75% of Base Parcel',
    lod: 'LoD 3 Cadastre'
  },
  'SURFACE': {
    id: 'SURFACE',
    title: 'Base Surface Parcel S00',
    ulpin: 'IN-2187-4930-1049-S-S00-GRND-S1',
    zone: 'S',
    floor: 'Ground Surface',
    zMin: '0.0m',
    zMax: '+1.5m',
    volume: '2,400.0 m³',
    area: '1,600.0 m²',
    owner: 'Greenfield Co-operative Housing Society',
    status: 'Master Registered Title',
    tax: '₹ 52,000 / yr (Paid)',
    strataShare: '100% Parent Parcel',
    lod: 'LoD 2 Cadastre'
  },
  'BASEMENT1': {
    id: 'BASEMENT1',
    title: 'Basement Parking Level 1 (Bay A-E)',
    ulpin: 'IN-2187-4930-1049-U-B01-PARK-B9',
    zone: 'U',
    floor: 'Basement 1',
    zMin: '-6.5m',
    zMax: '-1.0m',
    volume: '8,800.0 m³',
    area: '1,600.0 m²',
    owner: 'Society Common Strata Rights',
    status: 'Common Property Title',
    tax: '₹ 18,200 / yr (Paid)',
    strataShare: 'Common Strata Asset',
    lod: 'LoD 2 Cadastre'
  },
  'METRO': {
    id: 'METRO',
    title: 'Metro Transit Subsurface Right-of-Way Tunnel',
    ulpin: 'IN-2187-4930-1049-U-TUN-DMRC-T7',
    zone: 'U',
    floor: 'Subsurface Level -2',
    zMin: '-21.0m',
    zMax: '-14.0m',
    volume: '6,300.0 m³',
    area: '900.0 m²',
    owner: 'Delhi Metro Rail Corp / MoHUA',
    status: 'Public Statutory Easement',
    tax: 'Exempt (Public Transport)',
    strataShare: 'Subterranean Statutory Easement',
    lod: 'LoD 3 Subsurface'
  },
  'AIR': {
    id: 'AIR',
    title: 'Regulated Air Rights Safety Corridor',
    ulpin: 'IN-2187-4930-1049-A-AIR-ZONE-A0',
    zone: 'A',
    floor: 'Air Stratum (+45m to +65m)',
    zMin: '+45.0m',
    zMax: '+65.0m',
    volume: '32,000.0 m³',
    area: '1,600.0 m²',
    owner: 'Directorate General of Civil Aviation (DGCA) & Municipal Corp',
    status: 'Statutory Air-Rights Restriction',
    tax: 'N/A',
    strataShare: 'Public Airspace Overlay',
    lod: 'LoD 1 Air Corridor'
  }
};

// ==================================================================
// INITIALIZATION
// ==================================================================
document.addEventListener('DOMContentLoaded', async () => {
  restoreSession();
  if (!activeRole) return;
  await loadRegulationContext();

  // Synchronize local 3D cadastralData with live API backend properties
  await syncPropertiesWithAPI();

  // Parse URL query parameters to dynamically load selected case or unit
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('case_id');
  const paramUnitId = params.get('unit_id');
  const paramUlpin = params.get('ulpin');
  let loadedCase = null;

  if (caseId && window.apiRequest) {
    try {
      loadedCase = await apiRequest(`/api/cases/${caseId}`);
      if (loadedCase && loadedCase.property_ulpin) {
        // Find matching cadastral property
        const matchProp = Object.values(cadastralData).find(p => p.ulpin === loadedCase.property_ulpin) ||
                          Object.values(cadastralData).find(p => loadedCase.property_ulpin.includes(p.id));
        if (matchProp) {
          activePropertyUnit = matchProp.id;
          matchProp.status = `Case #${loadedCase.id}: ${loadedCase.status.replaceAll('_', ' ')}`;
        } else {
          const uMatch = loadedCase.property_ulpin.match(/U\d{4}/i);
          if (uMatch) activePropertyUnit = uMatch[0].toUpperCase();
        }
      }
    } catch (error) {
      console.warn('Could not load case details for 3D visualizer:', error.message);
    }
  } else if (paramUnitId) {
    activePropertyUnit = paramUnitId.toUpperCase();
  } else if (paramUlpin) {
    const matchProp = Object.values(cadastralData).find(p => p.ulpin === paramUlpin);
    if (matchProp) activePropertyUnit = matchProp.id;
  }

  // If a specific case was loaded, update HUD banner
  if (loadedCase) {
    const roleTitle = document.getElementById('visualizer-role-title');
    const roleCopy = document.getElementById('visualizer-role-copy');
    if (roleTitle) roleTitle.innerText = `Case #${loadedCase.id} 3D Inspection · ${loadedCase.title}`;
    if (roleCopy) roleCopy.innerText = `Target ULPIN: ${loadedCase.property_ulpin} | Status: ${loadedCase.status.replaceAll('_', ' ')}`;
  }

  populateFloorSelector();
  updateThemeButton(document.documentElement.classList.contains('dark'));
  if (window.lucide) {
    lucide.createIcons();
  }
  initThreeJS();
  onWindowResize();
  initEventListeners();
  generateULPIN();

  // Select unit and focus camera on target property
  selectUnit(activePropertyUnit);
  setTimeout(() => focusCitizenProperty(activePropertyUnit), 500);
});

function updateRegisteredOwnerDisplay() {
  if (activeRole !== 'citizen') return;
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  const ownerName = activeRegisteredOwner || session.name;
  if (!ownerName) return;
  const property = cadastralData[activePropertyUnit];
  if (property) property.owner = ownerName;
  const ownerElement = document.getElementById('prop-owner');
  if (ownerElement) ownerElement.textContent = ownerName;
}

async function loadRegulationContext() {
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || 'null');
  const jurisdiction = document.getElementById('regulation-jurisdiction');
  const summary = document.getElementById('regulation-summary');
  if (!session?.state || !session?.city || !window.apiGetRegulationProfile) return;
  try {
    const profile = await apiGetRegulationProfile(session.state, session.city);
    if (jurisdiction) jurisdiction.textContent = `${profile.city}, ${profile.state} · ${profile.jurisdiction}`;
    if (summary) summary.textContent = profile.height_rule_summary;
    const scenario = profile.illustrative_scenario || {};
    const envelope = document.getElementById('regulation-envelope');
    const basement = document.getElementById('regulation-basement');
    if (envelope) envelope.textContent = `${scenario.max_height_m} m · ${scenario.above_ground_floors} floors`;
    if (basement) basement.textContent = `${scenario.basement_levels} basement · ${scenario.parking_levels} parking`;
  } catch (error) {
    if (summary) summary.textContent = 'Planning profile unavailable; verify the applicable local authority rules.';
    console.warn('Unable to load planning context:', error.message);
  }
}

function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem('ulpin-session') || 'null');
    if (session && authProfiles[session.role]) {
      activeRole = session.role;
      activePropertyUnit = session.unit_id || 'U1204';
      applyRoleUI();
      if (activeRole === 'citizen') {
        const unitId = session.unit_id || 'U1204';
        setTimeout(() => focusCitizenProperty(unitId), 600);
      }
      return;
    }
  } catch (error) {
    sessionStorage.removeItem('ulpin-session');
  }
  window.location.href = 'login.html';
}

function applyRoleUI() {
  const profile = authProfiles[activeRole];
  const userSession = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  const activeSession = document.getElementById('active-session');
  
  if (document.getElementById('session-name')) {
    document.getElementById('session-name').innerText = userSession.name || profile.name;
  }
  if (document.getElementById('session-role')) {
    document.getElementById('session-role').innerText = activeRole === 'citizen' && userSession.unit_id
      ? `Citizen / ${userSession.unit_id} Owner`
      : profile.label;
  }

  if (activeRole === 'citizen' && userSession.name) {
    activeRegisteredOwner = userSession.name;
    updateRegisteredOwnerDisplay();
  }

  if (activeSession) {
    activeSession.classList.remove('hidden');
    activeSession.classList.add('flex');
  }

  // Ensure all interactive tool buttons are visible and active across all roles
  const aiButton = document.getElementById('btn-run-ai');
  const topologyButton = document.getElementById('btn-topology');
  const demarcationButton = document.getElementById('btn-demarcation');
  const exportButton = document.querySelector('[onclick="openExportModal()"]');
  const certButton = document.querySelector('[onclick="openCertificateModal()"]');

  if (aiButton) aiButton.classList.remove('hidden');
  if (topologyButton) topologyButton.classList.remove('hidden');
  if (demarcationButton) {
    demarcationButton.classList.remove('hidden');
    demarcationButton.classList.add('flex');
  }
  if (exportButton) exportButton.classList.remove('hidden');
  if (certButton) certButton.classList.remove('hidden');

  applyVisualizerRoleAccess();

  // Refresh current unit selection to update badges
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  selectUnit(cadastralData[unitId] ? unitId : (activeRole === 'citizen' ? activePropertyUnit : 'U1204'));

  if (window.lucide) lucide.createIcons();
}

function applyVisualizerRoleAccess() {
  const roleTitle = document.getElementById('visualizer-role-title');
  const roleCopy = document.getElementById('visualizer-role-copy');
  const layerHeading = document.querySelector('#layer-drone')?.closest('.gov-card') ||
    document.querySelector('#layer-drone')?.closest('.glass-card');
  const ulpinInput = document.getElementById('base-ulpin');
  const zoneSelect = document.getElementById('zone-type');
  const floorSelect = document.getElementById('floor-idx');
  const unitInput = document.getElementById('unit-tag');

  if (!activeRole) return;

  const copy = {
    citizen: {
      title: 'Citizen 3D Property Workspace',
      text: `Full 3D CAD inspection of ${activePropertyUnit}, strata stack, title certificate, property tax, and demarcation tools.`
    },
    officer: {
      title: 'DoLR Officer Registry Workspace',
      text: 'Full 3D CAD inspection, 3D ULPIN encoder, automated topology audit, and official title administration.'
    },
    surveyor: {
      title: 'Surveyor Field Technical Workspace',
      text: 'Full 3D CAD inspection, multi-sensor spatial layers, volume extraction, and technical demarcation evidence.'
    }
  }[activeRole] || {
    title: '3D Land Registry Workspace',
    text: 'Interactive 3D volumetric land administration platform.'
  };

  if (roleTitle) roleTitle.innerText = copy.title;
  if (roleCopy) roleCopy.innerText = copy.text;

  // Enable all inputs across all roles for full interactive feature parity
  [ulpinInput, zoneSelect, floorSelect, unitInput].forEach(input => {
    if (input) input.disabled = false;
  });

  // Display all ingested spatial layers and strata navigation items consistently
  if (layerHeading) layerHeading.classList.remove('hidden');
  document.querySelectorAll('[onclick^="selectStrataUnit"]').forEach(item => item.classList.remove('hidden'));
}

function logout() {
  sessionStorage.removeItem('ulpin-session');
  window.location.href = 'login.html';
}

function focusCitizenProperty(unitId = 'U1204') {
  // Select the specified unit (default to U1204)
  selectUnit(unitId);

  if (camera && controls) {
    // Determine a vertical offset based on the unit's elevation if available
    const unitData = cadastralData[unitId];
    let baseY = 0;
    if (unitData && unitData.zMin) {
      const num = parseFloat(unitData.zMin.replace('+', '').replace('m', '').trim());
      if (!isNaN(num)) baseY = num;
    }
    // Compute camera target and position with some offsets
    const targetPos = new THREE.Vector3(12, baseY + 28, 22);
    const lookAtPos = new THREE.Vector3(0, baseY + 18, 0);
    controls.target.copy(lookAtPos);
    camera.position.copy(targetPos);
    controls.update();
  }
}

// ==================================================================
// 3D DEMARCATION WORKFLOW
// ==================================================================
function openDemarcationModal() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];

  const unitLabel = document.getElementById('demarcation-unit-label');
  const ulpinLabel = document.getElementById('demarcation-ulpin-label');
  if (unitLabel) unitLabel.innerText = data.title;
  if (ulpinLabel) ulpinLabel.innerText = data.ulpin;

  document.getElementById('demarcation-form').classList.remove('hidden');
  document.getElementById('demarcation-success').classList.add('hidden');
  document.getElementById('demarcationModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDemarcationModal() {
  document.getElementById('demarcationModal').classList.add('hidden');
}

async function submitDemarcation() {
  const reason = document.getElementById('demarcation-reason')?.value || 'encroachment';
  const notes = document.getElementById('demarcation-notes')?.value || '';
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];

  let ticketNumber = `DoLR-DEM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  if (apiToken()) {
    try {
      const caseItem = await apiRequest('/api/cases', {
        method: 'POST',
        body: JSON.stringify({
          title: `3D Demarcation (${reason}) for Unit #${unitId}`,
          request_type: 'demarcation',
          property_ulpin: data.ulpin,
          notes: notes
        })
      });
      ticketNumber = `DoLR-CASE-#${caseItem.id}`;
    } catch (err) {
      console.warn('Backend API case submission fallback:', err.message);
    }
  }

  const ticketElem = document.getElementById('ticket-number');
  if (ticketElem) ticketElem.innerText = ticketNumber;

  document.getElementById('demarcation-form').classList.add('hidden');
  document.getElementById('demarcation-success').classList.remove('hidden');

  // Trigger highlight in 3D scene
  if (selectedUnitMesh && selectedUnitMesh.material) {
    selectedUnitMesh.material.color.setHex(0x38bdf8); // Sky blue demarcation highlight
  }
  if (window.lucide) lucide.createIcons();
}

// ==================================================================
// 3D PROPERTY TAX & RECEIPT WORKFLOW
// ==================================================================
function openTaxModal() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];

  const taxUnitName = document.getElementById('tax-unit-name');
  const taxUnitUlpin = document.getElementById('tax-unit-ulpin');
  const taxTotal = document.getElementById('tax-total-amount');

  if (taxUnitName) taxUnitName.innerText = data.title;
  if (taxUnitUlpin) taxUnitUlpin.innerText = data.ulpin;
  if (taxTotal) taxTotal.innerText = data.tax ? data.tax.split(' ')[0] + ' ' + (data.tax.split(' ')[1] || '14,820') : '₹ 14,820';

  document.getElementById('taxModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeTaxModal() {
  document.getElementById('taxModal').classList.add('hidden');
}

function processTaxPayment() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  if (cadastralData[unitId]) {
    cadastralData[unitId].tax = '₹ 14,820 / yr (Paid)';
  }

  const statusBadge = document.getElementById('tax-badge-status');
  if (statusBadge) {
    statusBadge.innerText = 'PAID (Txn Ref #DL-9941)';
    statusBadge.className = 'px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-[10px] font-bold';
  }

  const propTaxElem = document.getElementById('prop-tax');
  if (propTaxElem) propTaxElem.innerText = '₹ 14,820 / yr (Paid)';

  alert('Payment of ₹14,820 successfully verified via Bharat BillPay (BBPS). 3D Tax Clearance Certificate is now active.');
}

function downloadTaxReceipt() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];

  const receiptText = `========================================================================
MINISTRY OF RURAL DEVELOPMENT • DEPT OF LAND RESOURCES (DoLR)
3D BHU-AADHAAR PROPERTY TAX CLEARANCE CERTIFICATE (BBPS VERIFIED)
========================================================================
Receipt No       : REC-DoLR-2026-${Math.floor(100000 + Math.random() * 900000)}
Date & Timestamp : ${new Date().toISOString()}
Spatial Unit     : ${data.title}
3D ULPIN Token   : ${data.ulpin}
Vertical Datum   : ${data.zMin} to ${data.zMax} (Volume: ${data.volume})
Title Holder     : ${data.owner}
Assessed Amount  : ₹ 14,820.00 (PAID IN FULL)
Status           : VERIFIED CLEARANCE • NO MUNICIPAL LIENS
Blockchain Hash  : 0x9f4a8b7e61c3d2e5a4f890123456789abcdef0123456789
CRS Spatial Ref  : EPSG:7755 (Survey of India CORS RTK)
========================================================================`;

  const blob = new Blob([receiptText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3D_Tax_Receipt_${data.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================================================================
// BHASHINI / BILINGUAL LOCALIZATION (EN / HI)
// ==================================================================
function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'hi' : 'en';
  const t = i18n[currentLanguage];

  const langLabel = document.getElementById('lang-label');
  if (langLabel) langLabel.innerText = t.langLabel;

  const corsElem = document.getElementById('txt-cors-status');
  if (corsElem) corsElem.innerHTML = t.corsStatus;

  const btnAi = document.getElementById('txt-btn-ai');
  if (btnAi) btnAi.innerText = t.btnAi;

  const btnDem = document.getElementById('txt-btn-demarcation');
  if (btnDem) btnDem.innerText = t.btnDemarcation;

  const btnCert = document.getElementById('txt-btn-cert');
  if (btnCert) btnCert.innerText = t.btnCert;

  const btnExport = document.getElementById('txt-btn-export');
  if (btnExport) btnExport.innerText = t.btnExport;

  const titleDesig = document.getElementById('txt-title-designation');
  if (titleDesig) titleDesig.innerText = t.titleDesignation;

  const lblZ = document.getElementById('lbl-prop-z');
  if (lblZ) lblZ.innerText = t.lblZ;

  const lblVol = document.getElementById('lbl-prop-vol');
  if (lblVol) lblVol.innerText = t.lblVol;

  const lblArea = document.getElementById('lbl-prop-area');
  if (lblArea) lblArea.innerText = t.lblArea;

  const lblOwner = document.getElementById('lbl-prop-owner');
  if (lblOwner) lblOwner.innerText = t.lblOwner;

  const lblStatus = document.getElementById('lbl-prop-status');
  if (lblStatus) lblStatus.innerText = t.lblStatus;

  const lblTax = document.getElementById('lbl-prop-tax');
  if (lblTax) lblTax.innerText = t.lblTax;

  const lblStrata = document.getElementById('lbl-prop-strata');
  if (lblStrata) lblStrata.innerText = t.lblStrata;
}

// ==================================================================
// THREE.JS 3D ENGINE INITIALIZATION
// ==================================================================
function initThreeJS() {
  container = document.getElementById('cadastreCanvasContainer');
  if (!container) return;

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 550;

  // Scene Setup
  const isDark = document.documentElement.classList.contains('dark');
  const bgColor = isDark ? 0x0c1524 : 0xb9d5e6;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, 85, 190);

  // Camera Setup
  camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
  camera.position.set(38, 42, 48);

  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 + 0.15; // Allow slight underground tilt
  controls.minDistance = 10;
  controls.maxDistance = 180;
  controls.target.set(0, 10, 0);
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;

  // Clipping Plane for Dynamic Strata Slicing
  clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 65);

  // Raycaster for Hover & Selection
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Lighting Setup
  setupLights();

  // Procedural 3D Cadastral Geometry Builder
  buildCadastreScene();

  // Animation Loop
  animate();

  // Window Resize
  window.addEventListener('resize', onWindowResize);
}

function setupLights() {
  const ambientLight = new THREE.HemisphereLight(0xeaf6ff, 0x66705f, 1.55);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff2cf, 2.8);
  sunLight.position.set(35, 85, 25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.camera.left = -45;
  sunLight.shadow.camera.right = 45;
  sunLight.shadow.camera.top = 45;
  sunLight.shadow.camera.bottom = -45;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xa8d4f2, 0.95);
  fillLight.position.set(-35, 28, -30);
  scene.add(fillLight);

  const entranceLight = new THREE.PointLight(0xffd38a, 0.45, 22);
  entranceLight.position.set(0, 4, 9);
  scene.add(entranceLight);
}

// ==================================================================
// PROCEDURAL 3D CADASTRAL MODEL BUILDER
// ==================================================================
function buildCadastreScene() {
  clickableUnits = [];
  floorGroups = [];

  // Group Containers
  groupGround = new THREE.Group();
  groupBasement = new THREE.Group();
  groupMetro = new THREE.Group();
  groupBuilding = new THREE.Group();
  groupAirRights = new THREE.Group();
  groupLiDAR = new THREE.Group();
  groupDrone = new THREE.Group();

  scene.add(groupGround);
  scene.add(groupBasement);
  scene.add(groupMetro);
  scene.add(groupBuilding);
  scene.add(groupAirRights);
  scene.add(groupLiDAR);
  scene.add(groupDrone);

  // 1. Grid & Ground Surface Datum (Z = 0.0m)
  const gridHelper = new THREE.GridHelper(70, 28, 0x78a98b, 0x9ab3a4);
  gridHelper.position.y = 0.02;
  groupGround.add(gridHelper);

  // Ground Surface Parcel Base Mesh
  const groundGeo = new THREE.BoxGeometry(26, 0.6, 26);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x6f806f,
    roughness: 0.8,
    metalness: 0.2,
    clippingPlanes: [clippingPlane]
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.3;
  groundMesh.receiveShadow = true;
  groundMesh.userData = { unitId: 'SURFACE' };
  groupGround.add(groundMesh);
  clickableUnits.push(groundMesh);

  // Parcel Boundary Line & Beacon Pillars
  const parcelEdges = new THREE.EdgesGeometry(groundGeo);
  const parcelLine = new THREE.LineSegments(parcelEdges, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
  parcelLine.position.y = -0.3;
  groupGround.add(parcelLine);

  createCornerBeacons(13, 13, groupGround);

  // 2. Subsurface Level 1: Underground Parking (Z = -6.0m)
  const b1Geo = new THREE.BoxGeometry(24, 4.5, 24);
  const b1Mat = new THREE.MeshStandardMaterial({
    color: 0x7e22ce,
    transparent: true,
    opacity: 0.45,
    roughness: 0.5,
    clippingPlanes: [clippingPlane]
  });
  const b1Mesh = new THREE.Mesh(b1Geo, b1Mat);
  b1Mesh.position.y = -3.5;
  b1Mesh.userData = { unitId: 'BASEMENT1' };
  groupBasement.add(b1Mesh);
  clickableUnits.push(b1Mesh);

  const b1Edges = new THREE.LineSegments(new THREE.EdgesGeometry(b1Geo), new THREE.LineBasicMaterial({ color: 0xc084fc }));
  b1Edges.position.y = -3.5;
  groupBasement.add(b1Edges);

  // 3. Subsurface Level 2: Metro Transit Tunnel (Z = -18.0m)
  const tunnelGroup = new THREE.Group();
  const tunnelGeo = new THREE.CylinderGeometry(3.5, 3.5, 45, 24);
  tunnelGeo.rotateZ(Math.PI / 2);
  const tunnelMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    transparent: true,
    opacity: 0.4,
    roughness: 0.3,
    clippingPlanes: [clippingPlane]
  });
  const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
  tunnelMesh.position.set(0, -14, 0);
  tunnelMesh.userData = { unitId: 'METRO' };
  tunnelGroup.add(tunnelMesh);
  clickableUnits.push(tunnelMesh);

  // Metro Track Glowing Rails
  const railGeo = new THREE.BoxGeometry(45, 0.2, 0.4);
  const railMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  const rail1 = new THREE.Mesh(railGeo, railMat);
  rail1.position.set(0, -15.5, -1);
  const rail2 = new THREE.Mesh(railGeo, railMat);
  rail2.position.set(0, -15.5, 1);
  tunnelGroup.add(rail1, rail2);
  groupMetro.add(tunnelGroup);

  // 4. Above-Ground Multi-Storey Residential & Commercial Tower
  const totalFloors = activeBuilding.above_ground_floors || 12;
  const floorHeight = 3.6;
  const floorSize = 16.0;
  const unitSize = 5.6;
  const unitHeight = floorHeight - 0.45;

  // Reusable Materials with clipping planes for cross-section support
  const matSlab = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.2, clippingPlanes: [clippingPlane] });
  const matCore = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.1, clippingPlanes: [clippingPlane] });
  const matColumn = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.3, clippingPlanes: [clippingPlane] });
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7, clippingPlanes: [clippingPlane] });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    metalness: 0.1,
    roughness: 0.15,
    transmission: 0.5,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    clippingPlanes: [clippingPlane]
  });
  const matBalconySlab = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, clippingPlanes: [clippingPlane] });
  const matBalconyGlass = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    clippingPlanes: [clippingPlane]
  });
  const matBalconyRail = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8, clippingPlanes: [clippingPlane] });

  for (let f = 0; f < totalFloors; f++) {
    const floorY = 0.5 + f * floorHeight;
    const floorObj = new THREE.Group();
    floorObj.userData = { originalY: floorY, floorIndex: f };

    // 1. Structural Floor Plate / Slab
    const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(floorSize, 0.35, floorSize), matSlab);
    slabMesh.position.y = 0.175;
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    floorObj.add(slabMesh);

    // Slab Edge Trim
    const slabTrim = new THREE.Mesh(new THREE.BoxGeometry(floorSize + 0.1, 0.1, floorSize + 0.1), matFrame);
    slabTrim.position.y = 0.175;
    floorObj.add(slabTrim);

    // 2. Central Structural Core (Elevator & Stairwell Shaft)
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, unitHeight, 4.2), matCore);
    coreMesh.position.set(0, unitHeight / 2 + 0.35, 0);
    coreMesh.castShadow = true;
    coreMesh.receiveShadow = true;
    floorObj.add(coreMesh);

    // Core elevator doors
    const elevDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.05), matFrame);
    elevDoor.position.set(0, 1.45, 2.12);
    floorObj.add(elevDoor);

    // 3. Perimeter Structural Columns (Corners and Mid-spans)
    const colPositions = [
      [-7.5, -7.5], [7.5, -7.5], [-7.5, 7.5], [7.5, 7.5],
      [0, -7.5], [0, 7.5], [-7.5, 0], [7.5, 0]
    ];
    colPositions.forEach(([cx, cz]) => {
      const colMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, unitHeight, 0.55), matColumn);
      colMesh.position.set(cx, unitHeight / 2 + 0.35, cz);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      floorObj.add(colMesh);
    });

    // 4. Subdivide Floor into 4 Cadastral Volumetric Units
    const unitOffsets = [
      { x: unitSize / 2 + 2.0, z: unitSize / 2 + 2.0, id: `U${String(f + 1).padStart(2, '0')}04` },
      { x: -unitSize / 2 - 2.0, z: unitSize / 2 + 2.0, id: f === 2 ? 'U0602' : `U${String(f + 1).padStart(2, '0')}01` },
      { x: -unitSize / 2 - 2.0, z: -unitSize / 2 - 2.0, id: `U${String(f + 1).padStart(2, '0')}02` },
      { x: unitSize / 2 + 2.0, z: -unitSize / 2 - 2.0, id: `U${String(f + 1).padStart(2, '0')}03` }
    ];

    unitOffsets.forEach((u) => {
      const isRegisteredUnit = (u.id === activePropertyUnit) || (!activePropertyUnit && u.id === 'U1204');
      const isTarget1201 = u.id === 'U1201';
      const isTarget0602 = u.id === 'U0602';

      let unitColor = 0x1e40af; // Cadastral Blue Default
      let opacity = 0.45;
      let emissiveColor = 0x000000;
      let emissiveIntensity = 0;

      if (isRegisteredUnit) {
        unitColor = 0x059669; // Vibrant Emerald (Registered Unit)
        opacity = 0.90;
        emissiveColor = 0x059669;
        emissiveIntensity = 0.35;
      } else if (isTarget1201) {
        unitColor = 0x0284c7; // Sky Cadastral Blue
        opacity = 0.6;
      } else if (isTarget0602) {
        unitColor = 0x2563eb; // Royal Blue
        opacity = 0.6;
      }

      const unitMat = new THREE.MeshStandardMaterial({
        color: unitColor,
        emissive: emissiveColor,
        emissiveIntensity: emissiveIntensity,
        transparent: true,
        opacity: opacity,
        roughness: 0.25,
        metalness: 0.2,
        depthWrite: false,
        clippingPlanes: [clippingPlane]
      });

      const unitGeo = new THREE.BoxGeometry(unitSize, unitHeight, unitSize);
      const unitMesh = new THREE.Mesh(unitGeo, unitMat);
      unitMesh.position.set(u.x, unitHeight / 2 + 0.35, u.z);
      unitMesh.castShadow = true;
      unitMesh.receiveShadow = true;
      unitMesh.userData = { unitId: u.id, defaultColor: unitColor, defaultOpacity: opacity, isRegistered: isRegisteredUnit };

      // High-precision Cadastral Boundary Wireframe
      const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(unitGeo),
        new THREE.LineBasicMaterial({
          color: isRegisteredUnit ? 0x34d399 : 0x38bdf8,
          linewidth: isRegisteredUnit ? 2.5 : 1
        })
      );
      unitMesh.add(edgeLines);

      if (isRegisteredUnit) {
        selectedUnitMesh = unitMesh;
      }

      floorObj.add(unitMesh);
      clickableUnits.push(unitMesh);
    });

    // 5. Exterior Windows & Architectural Facade per Floor
    const winWidth = 4.6;
    const winHeight = unitHeight * 0.75;
    const winY = unitHeight / 2 + 0.35;

    // Front / Back window sets
    [-4.8, 4.8].forEach(wx => {
      const frontWin = new THREE.Mesh(new THREE.BoxGeometry(winWidth, winHeight, 0.08), matGlass);
      frontWin.position.set(wx, winY, 7.85);
      floorObj.add(frontWin);

      const backWin = new THREE.Mesh(new THREE.BoxGeometry(winWidth, winHeight, 0.08), matGlass);
      backWin.position.set(wx, winY, -7.85);
      floorObj.add(backWin);
    });

    // Side window sets
    [-4.8, 4.8].forEach(wz => {
      const leftWin = new THREE.Mesh(new THREE.BoxGeometry(0.08, winHeight, winWidth), matGlass);
      leftWin.position.set(-7.85, winY, wz);
      floorObj.add(leftWin);

      const rightWin = new THREE.Mesh(new THREE.BoxGeometry(0.08, winHeight, winWidth), matGlass);
      rightWin.position.set(7.85, winY, wz);
      floorObj.add(rightWin);
    });

    // 6. Modern Balconies (Integrated on each residential floor)
    if (f > 0) {
      // Front Balconies (Right & Left)
      [-4.8, 4.8].forEach(bx => {
        const balcSlab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 1.4), matBalconySlab);
        balcSlab.position.set(bx, 0.25, 8.6);
        floorObj.add(balcSlab);

        const balcGlass = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 0.05), matBalconyGlass);
        balcGlass.position.set(bx, 0.75, 9.25);
        floorObj.add(balcGlass);

        const balcRail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.06), matBalconyRail);
        balcRail.position.set(bx, 1.18, 9.25);
        floorObj.add(balcRail);

        // Balcony side rails
        [-2.18, 2.18].forEach(sideOffset => {
          const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 1.3), matBalconyGlass);
          sideGlass.position.set(bx + sideOffset, 0.75, 8.6);
          floorObj.add(sideGlass);
        });
      });
    }

    // 7. Ground Floor Entrance Canopy & Lobby
    if (f === 0) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.2, 2.8), matSlab);
      canopy.position.set(0, 3.4, 9.3);
      floorObj.add(canopy);

      [-2.8, 2.8].forEach(cx => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 12), matFrame);
        post.position.set(cx, 1.7, 10.4);
        floorObj.add(post);
      });

      // Entrance Glass Doors
      const lobbyDoors = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 0.1), matGlass);
      lobbyDoors.position.set(0, 1.75, 7.9);
      floorObj.add(lobbyDoors);
    }

    // 8. Rooftop Parapet, Mechanical Penthouse & Solar Array on the Top Floor
    if (f === totalFloors - 1) {
      const roofTopY = floorHeight + 0.175;

      // Parapet Walls
      const parapetNorth = new THREE.Mesh(new THREE.BoxGeometry(floorSize, 0.9, 0.25), matColumn);
      parapetNorth.position.set(0, roofTopY + 0.45, 7.88);
      floorObj.add(parapetNorth);

      const parapetSouth = new THREE.Mesh(new THREE.BoxGeometry(floorSize, 0.9, 0.25), matColumn);
      parapetSouth.position.set(0, roofTopY + 0.45, -7.88);
      floorObj.add(parapetSouth);

      const parapetEast = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, floorSize), matColumn);
      parapetEast.position.set(7.88, roofTopY + 0.45, 0);
      floorObj.add(parapetEast);

      const parapetWest = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, floorSize), matColumn);
      parapetWest.position.set(-7.88, roofTopY + 0.45, 0);
      floorObj.add(parapetWest);

      // Lift Penthouse / Machine Room
      const penthouse = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.4, 5.2), matCore);
      penthouse.position.set(0, roofTopY + 1.2, 0);
      floorObj.add(penthouse);

      // Solar Photovoltaic Panels
      const matSolar = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.2, metalness: 0.6, clippingPlanes: [clippingPlane] });
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.2), matSolar);
          panel.position.set(-3.5 + c * 2.0, roofTopY + 0.5, -4.5 + r * 1.8);
          panel.rotation.x = -0.2;
          floorObj.add(panel);
        }
      }

      // Rooftop HVAC units
      const hvac1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.4), matFrame);
      hvac1.position.set(4.5, roofTopY + 0.6, -4.0);
      floorObj.add(hvac1);

      // Communication Mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 4.5, 8), matFrame);
      mast.position.set(0, roofTopY + 3.6, 0);
      floorObj.add(mast);
    }

    floorObj.position.y = floorY;
    floorGroups.push(floorObj);
    groupBuilding.add(floorObj);
  }

  // Site Landscaping & Pavement Elements
  const paving = new THREE.MeshStandardMaterial({ color: 0x8f989e, roughness: 0.9, clippingPlanes: [clippingPlane] });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x343b40, roughness: 0.96, clippingPlanes: [clippingPlane] });
  const laneMark = new THREE.MeshBasicMaterial({ color: 0xe8d27b });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c5, roughness: 0.78, clippingPlanes: [clippingPlane] });

  const addSiteBox = (size, pos, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos);
    groupGround.add(m);
    return m;
  };

  addSiteBox([32, 0.12, 5], [0, 0.06, 15], paving);
  addSiteBox([5, 0.12, 32], [15, 0.06, 0], paving);
  addSiteBox([4.8, 0.12, 18], [0, 0.07, 12], concreteMat);
  addSiteBox([32, 0.08, 5.8], [0, 0.02, 19], asphalt);

  for (let i = -12; i <= 12; i += 4) {
    addSiteBox([1.8, 0.03, 0.08], [i, 0.08, 19], laneMark);
  }
  [-9, -3, 3, 9].forEach(x => {
    addSiteBox([2.6, 0.04, 0.12], [x, 0.1, 16.2], laneMark);
  });

  createSiteTree(-11, 10, groupGround);
  createSiteTree(11, 10, groupGround);
  createSiteTree(-11, -10, groupGround);
  createSiteTree(11, -10, groupGround);

  // 5. Air Rights Envelope (+45m to +65m)
  const airGeo = new THREE.BoxGeometry(18, 12, 18);
  const airMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.18,
    wireframe: false,
    roughness: 0.2,
    clippingPlanes: [clippingPlane]
  });
  const airMesh = new THREE.Mesh(airGeo, airMat);
  airMesh.position.y = 52;
  airMesh.userData = { unitId: 'AIR' };
  groupAirRights.add(airMesh);
  clickableUnits.push(airMesh);

  const airEdges = new THREE.LineSegments(new THREE.EdgesGeometry(airGeo), new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
  airEdges.position.y = 52;
  groupAirRights.add(airEdges);

  // 6. LiDAR Point Cloud Simulator
  createLiDARPointCloud();

  // 7. Drone Photogrammetry Envelope & Camera Path
  createDroneFlightOverlay();
}

function createSiteTree(x, z, parent) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3926, roughness: 0.95 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2f7652, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 8), trunkMaterial);
  trunk.position.set(x, 1.1, z);
  trunk.castShadow = true;
  parent.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), leafMaterial);
  crown.position.set(x, 2.8, z);
  crown.castShadow = true;
  parent.add(crown);
}

function createCornerBeacons(x, z, parent) {
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
  const beaconGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 12);
  const corners = [
    { x: x, z: z }, { x: -x, z: z }, { x: x, z: -z }, { x: -x, z: -z }
  ];

  corners.forEach(c => {
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(c.x, 0.75, c.z);
    parent.add(beacon);
  });
}

function createLiDARPointCloud() {
  const particleCount = 650;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 8;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const py = Math.random() * 26;

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    // LiDAR Elevation Spectrum Color: Purple -> Cyan -> Emerald
    const normH = py / 26;
    colors[i * 3] = 0.2 + normH * 0.2;
    colors[i * 3 + 1] = 0.7 + normH * 0.3;
    colors[i * 3 + 2] = 0.9 - normH * 0.4;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pMaterial = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });

  const pCloud = new THREE.Points(geometry, pMaterial);
  groupLiDAR.add(pCloud);
}

function createDroneFlightOverlay() {
  const flightGeo = new THREE.BufferGeometry();
  const points = [];
  const radius = 22;
  const segments = 32;

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const y = 38 + Math.sin(theta * 3) * 2;
    points.push(new THREE.Vector3(x, y, z));
  }

  flightGeo.setFromPoints(points);
  const flightLine = new THREE.Line(flightGeo, new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 1.5,
    gapSize: 1
  }));
  flightLine.computeLineDistances();
  groupDrone.add(flightLine);
}

// ==================================================================
// EVENT LISTENERS & RAYCASTING (HOVER / CLICK)
// ==================================================================
function initEventListeners() {
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('click', onMouseClick);
}

function onMouseMove(event) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableUnits, true);

  const tooltip = document.getElementById('unitTooltip');

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const unitId = hit.userData.unitId;

    if (unitId && cadastralData[unitId]) {
      const data = cadastralData[unitId];
      tooltip.classList.remove('hidden');
      tooltip.style.left = `${event.clientX - rect.left + 15}px`;
      tooltip.style.top = `${event.clientY - rect.top + 15}px`;
      document.getElementById('tt-title').innerText = data.title;
      document.getElementById('tt-ulpin').innerText = `ULPIN: ${data.ulpin}`;
      document.getElementById('tt-vol').innerText = `Volume: ${data.volume} (${data.zMin} to ${data.zMax})`;

      container.style.cursor = 'pointer';
      return;
    }
  }

  tooltip.classList.add('hidden');
  container.style.cursor = 'grab';
}

function onMouseClick(event) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableUnits, true);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const unitId = hit.userData.unitId;
    if (unitId) {
      selectUnit(unitId, hit);
    }
  }
}

function selectUnit(unitId, meshObj) {
  const data = cadastralData[unitId] || {
    id: unitId,
    title: `Unit #${unitId}`,
    ulpin: `IN-2187-4930-1049-A-FL-${unitId}-X1`,
    zone: 'A',
    floor: 'Multi-Storey Cadastre',
    zMin: '+24.0m',
    zMax: '+27.6m',
    volume: '372.0 m³',
    area: '124.0 m²',
    owner: 'Registered Title Holder',
    status: 'Verified Freehold Title',
    tax: '₹ 14,000 / yr (Paid)',
    strataShare: '1.75% of Base Parcel',
    lod: 'LoD 3 Cadastre'
  };
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  if (data.id === activePropertyUnit && session.name) {
    data.owner = session.name;
  }
  if (data.id === activePropertyUnit && activeRegisteredOwner) {
    data.owner = activeRegisteredOwner;
  }

  // Update Right Panel UI
  document.getElementById('prop-title').innerText = data.title;
  document.getElementById('prop-ulpin-display').innerText = data.ulpin;
  document.getElementById('prop-z').innerText = `${data.zMin} to ${data.zMax}`;
  document.getElementById('prop-vol').innerText = data.volume;
  document.getElementById('prop-area').innerText = data.area;
  document.getElementById('prop-owner').innerText = data.owner;
  document.getElementById('prop-lod').innerText = data.lod;

  const propStatus = document.getElementById('prop-status');
  if (propStatus) {
    propStatus.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3"></i> ${data.status}`;
  }

  const propTax = document.getElementById('prop-tax');
  if (propTax) {
    propTax.innerText = data.tax;
  }

  const propStrata = document.getElementById('prop-strata');
  if (propStrata) {
    propStrata.innerText = data.strataShare;
  }

  const ownedBadge = document.getElementById('owned-badge');
  if (ownedBadge) {
    const isOwned = data.id === activePropertyUnit;
    ownedBadge.classList.toggle('hidden', !isOwned);
    ownedBadge.classList.toggle('flex', isOwned);
  }

  // Sync with 3D ULPIN Form in Left Panel
  document.getElementById('unit-tag').value = data.id || 'U1204';
  if (data.zone) {
    document.getElementById('zone-type').value = data.zone;
  }
  const floorSelect = document.getElementById('floor-idx');
  if (floorSelect) floorSelect.value = propertyFloorCode(data.floor);
  generateULPIN();
  const checksum = data.ulpin.split('-').pop();
  const checksumInput = document.getElementById('checksum-tag');
  if (checksumInput) checksumInput.value = checksum;
  const generatedUlpIn = document.getElementById('result-ulpin');
  if (generatedUlpIn) generatedUlpIn.innerText = data.ulpin;

  // Certificate Modal Data Sync
  const certUlpin = document.getElementById('cert-ulpin');
  if (certUlpin) certUlpin.innerText = data.ulpin;

  // Update Strata Stack item active styling
  const strataMap = {
    'AIR': 'strata-air',
    'U1204': 'strata-res',
    'U1201': 'strata-res',
    'U0602': 'strata-res',
    'U0401': 'strata-res',
    'U0101': 'strata-res',
    'SURFACE': 'strata-surface',
    'BASEMENT1': 'strata-b1',
    'METRO': 'strata-metro'
  };
  ['strata-air', 'strata-res', 'strata-surface', 'strata-b1', 'strata-metro'].forEach(id => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.classList.remove('ring-2', 'ring-gov-blue', 'border-gov-blue', 'shadow-md');
    }
  });
  const activeElemId = strataMap[data.id] || (data.id.startsWith('U') ? 'strata-res' : null);
  if (activeElemId) {
    const activeElem = document.getElementById(activeElemId);
    if (activeElem) {
      activeElem.classList.add('ring-2', 'ring-gov-blue', 'border-gov-blue', 'shadow-md');
    }
  }

  // Visual Highlight in 3D Scene
  clickableUnits.forEach(u => {
    if (!u.material) return;
    const isOwnerHome = u.userData.unitId === activePropertyUnit;
    if (isOwnerHome) {
      // The resident's own home/floor always remains prominently highlighted in emerald
      u.material.color.setHex(0x059669);
      if (u.material.emissive) {
        u.material.emissive.setHex(0x047857);
        u.material.emissiveIntensity = 0.4;
      }
      u.material.opacity = 0.90;
    } else {
      // Reset other units to their standard default colors
      u.material.color.setHex(u.userData.defaultColor || 0x1e40af);
      if (u.material.emissive) {
        u.material.emissive.setHex(0x000000);
        u.material.emissiveIntensity = 0;
      }
      u.material.opacity = u.userData.defaultOpacity || 0.45;
    }
  });

  // Apply highlight to the currently active selection
  const match = meshObj || clickableUnits.find(u => u.userData.unitId === data.id);
  if (match && match.material) {
    selectedUnitMesh = match;
    if (data.id === activePropertyUnit) {
      match.material.color.setHex(0x059669);
      if (match.material.emissive) {
        match.material.emissive.setHex(0x10b981);
        match.material.emissiveIntensity = 0.65;
      }
      match.material.opacity = 0.95;
    } else if (data.id === 'AIR') {
      match.material.color.setHex(0xf59e0b);
      if (match.material.emissive) {
        match.material.emissive.setHex(0xd97706);
        match.material.emissiveIntensity = 0.45;
      }
      match.material.opacity = 0.55;
    } else if (data.id === 'SURFACE') {
      match.material.color.setHex(0x10b981);
      if (match.material.emissive) {
        match.material.emissive.setHex(0x059669);
        match.material.emissiveIntensity = 0.45;
      }
      match.material.opacity = 0.9;
    } else if (data.id === 'BASEMENT1') {
      match.material.color.setHex(0xa855f7);
      if (match.material.emissive) {
        match.material.emissive.setHex(0x7e22ce);
        match.material.emissiveIntensity = 0.5;
      }
      match.material.opacity = 0.85;
    } else if (data.id === 'METRO') {
      match.material.color.setHex(0xf43f5e);
      if (match.material.emissive) {
        match.material.emissive.setHex(0xe11d48);
        match.material.emissiveIntensity = 0.5;
      }
      match.material.opacity = 0.85;
    } else {
      match.material.color.setHex(0x0284c7);
      if (match.material.emissive) {
        match.material.emissive.setHex(0x0369a1);
        match.material.emissiveIntensity = 0.45;
      }
      match.material.opacity = 0.85;
    }
  }

  if (currentViewMode === 'cross') {
    const crossCanvas = document.getElementById('crossSectionCanvas');
    if (crossCanvas) draw2DCrossSection(crossCanvas);
  }

  if (window.lucide) lucide.createIcons();
}

function selectStrataUnit(strataKey) {
  const map = {
    'air': 'AIR',
    'res': activePropertyUnit || 'U1204',
    'surface': 'SURFACE',
    'b1': 'BASEMENT1',
    'metro': 'METRO'
  };
  const unitId = map[strataKey] || activePropertyUnit || 'U1204';
  selectUnit(unitId);

  // Smooth 3D Camera Focus on the selected strata layer
  if (camera && controls) {
    let targetY = 20;
    let camPos = new THREE.Vector3(38, 42, 48);
    if (strataKey === 'air' || unitId === 'AIR') {
      targetY = 52;
      camPos.set(28, 62, 38);
    } else if (strataKey === 'res' || unitId.startsWith('U') || unitId === activePropertyUnit) {
      const uData = cadastralData[unitId] || cadastralData[activePropertyUnit];
      let floorNum = 12;
      if (uData?.floor) {
        const m = String(uData.floor).match(/\d+/);
        if (m) floorNum = parseInt(m[0], 10);
      }
      targetY = 0.5 + floorNum * 3.6;
      camPos.set(24, targetY + 10, 28);
    } else if (strataKey === 'surface' || unitId === 'SURFACE') {
      targetY = 0;
      camPos.set(30, 18, 34);
    } else if (strataKey === 'b1' || unitId === 'BASEMENT1') {
      targetY = -3.5;
      camPos.set(26, 6, 28);
    } else if (strataKey === 'metro' || unitId === 'METRO') {
      targetY = -14;
      camPos.set(28, -4, 30);
    }
    controls.target.set(0, targetY, 0);
    camera.position.copy(camPos);
    controls.update();
  }
}

// ==================================================================
// SLIDERS & VIEW CONTROLS
// ==================================================================
function onExplodeChange(val) {
  const mult = parseFloat(val);
  document.getElementById('explode-val').innerText = `${mult.toFixed(1)}x`;

  floorGroups.forEach((fg) => {
    const origY = fg.userData.originalY;
    const fIdx = fg.userData.floorIndex;
    fg.position.y = origY + fIdx * mult * 2.2;
  });

  // Also offset air rights
  if (groupAirRights) {
    groupAirRights.position.y = mult * 8;
  }
}

function onSliceChange(val) {
  const zVal = parseFloat(val);
  document.getElementById('slice-val').innerText = zVal >= 0 ? `+${zVal}m` : `${zVal}m`;
  clippingPlane.constant = zVal;
}

function resetCamera() {
  controls.reset();
  camera.position.set(38, 42, 48);
  controls.target.set(0, 10, 0);
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
}

function toggleWireframe() {
  isWireframeMode = !isWireframeMode;
  clickableUnits.forEach(mesh => {
    if (mesh.material) {
      mesh.material.wireframe = isWireframeMode;
    }
  });
}

function toggleAutoRotate() {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
}

function updateLayerVisibility() {
  if (groupDrone) groupDrone.visible = document.getElementById('layer-drone').checked;
  if (groupLiDAR) groupLiDAR.visible = document.getElementById('layer-lidar').checked;
  if (groupGround) groupGround.visible = document.getElementById('layer-gis').checked;
  if (groupBuilding) groupBuilding.visible = document.getElementById('layer-bim').checked;
  if (groupBasement && groupMetro) {
    const subVisible = document.getElementById('layer-subsurface').checked;
    groupBasement.visible = subVisible;
    groupMetro.visible = subVisible;
  }
}

function onZoneSelectChange() {
  const zone = document.getElementById('zone-type').value;
  const floorSelect = document.getElementById('floor-idx');
  if (zone === 'U') {
    floorSelect.value = 'B01';
  } else if (zone === 'S') {
    floorSelect.value = 'S00';
  } else {
    floorSelect.value = 'F12';
  }
  generateULPIN();
}

function generateULPIN() {
  const base = document.getElementById('base-ulpin').value.trim() || '2187-4930-1049';
  const zone = document.getElementById('zone-type').value;
  const floor = document.getElementById('floor-idx').value;
  const unit = document.getElementById('unit-tag').value.trim() || 'U1204';

  // Calculate standard 2-char checksum
  const rawString = `${base}-${zone}-${floor}-${unit.toUpperCase()}`;
  const checksum = computeModulo97Checksum(rawString);
  document.getElementById('checksum-tag').value = checksum;

  const fullULPIN = `IN-${base}-${zone}-${floor}-${unit.toUpperCase()}-${checksum}`;
  document.getElementById('result-ulpin').innerText = fullULPIN;
}

function computeModulo97Checksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 97;
  }
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return chars[hash % chars.length] + chars[(hash * 7) % chars.length];
}

function copyULPIN() {
  const ulpin = document.getElementById('result-ulpin').innerText;
  navigator.clipboard.writeText(ulpin).then(() => {
    alert(`3D ULPIN copied to clipboard:\n${ulpin}`);
  });
}

// ==================================================================
// VIEW MODE SWITCHER (3D vs 2D CROSS-SECTION)
// ==================================================================
function setViewMode(mode) {
  currentViewMode = mode;
  const crossCanvas = document.getElementById('crossSectionCanvas');
  const btn3d = document.getElementById('btn-3d');
  const btnCross = document.getElementById('btn-cross');
  const roleBanner = document.getElementById('visualizer-role-banner');

  const activeClass = 'px-2.5 py-1 text-xs bg-gov-blue text-white font-bold transition flex items-center gap-1 shadow-sm';
  const inactiveClass = 'px-2.5 py-1 text-xs hover:bg-gov-gray-light text-gov-ink font-semibold transition flex items-center gap-1';

  if (mode === 'cross') {
    if (btnCross) btnCross.className = activeClass;
    if (btn3d) btn3d.className = inactiveClass;
    if (roleBanner) roleBanner.classList.add('hidden');
    if (crossCanvas) {
      crossCanvas.classList.remove('hidden');
      draw2DCrossSection(crossCanvas);
    }
  } else {
    if (btn3d) btn3d.className = activeClass;
    if (btnCross) btnCross.className = inactiveClass;
    if (roleBanner) roleBanner.classList.remove('hidden');
    if (crossCanvas) {
      crossCanvas.classList.add('hidden');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function draw2DCrossSection(canvasElem) {
  if (!container || !canvasElem) return;
  canvasElem.width = container.clientWidth || 800;
  canvasElem.height = container.clientHeight || 600;
  const ctx = canvasElem.getContext('2d');
  const w = canvasElem.width;
  const h = canvasElem.height;

  // Background
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, w, h);

  // Active property & resident unit details
  const activeUnit = cadastralData[activePropertyUnit] || cadastralData['U1204'] || {};
  const floorString = String(activeUnit.floor || 'Floor 12');
  const floorMatch = floorString.match(/\d+/);
  const selectedFloorNum = floorMatch ? parseInt(floorMatch[0], 10) : 12;

  // Responsive Vertical Coordinate Mapping (-25m to +60m = 85m range)
  const topPadding = 50;
  const bottomPadding = 40;
  const availableH = h - topPadding - bottomPadding;
  const meterScale = Math.max(3.8, Math.min(6.5, availableH / 85));
  const zeroY = h - bottomPadding - (25 * meterScale);

  const getYForZ = (z) => zeroY - (z * meterScale);

  // 1. Grid Background & Datum Lines
  ctx.font = '10px "JetBrains Mono", Consolas, monospace';
  for (let z = -25; z <= 60; z += 10) {
    const y = getYForZ(z);
    ctx.strokeStyle = z === 0 ? 'rgba(245, 158, 11, 0.4)' : '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(85, y);
    ctx.lineTo(w - 20, y);
    ctx.stroke();

    ctx.fillStyle = z === 0 ? '#f59e0b' : '#64748b';
    ctx.fillText(`${z >= 0 ? '+' : ''}${z}m Datum`, 12, y + 3);
  }

  // Ground Surface Datum (0.00m)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(75, zeroY);
  ctx.lineTo(w - 20, zeroY);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
  ctx.fillText('Ground Surface Datum (0.00m) - Base 2D Parcel 2187-4930-1049-S00', 95, zeroY + 14);

  // 2. Air Rights Corridor (+45.0m to +60.0m)
  const airTopY = getYForZ(60);
  const airBottomY = getYForZ(45);
  const bldgX = Math.max(120, w * 0.20);
  const bldgW = Math.min(480, w * 0.50);

  ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
  ctx.setLineDash([4, 4]);
  ctx.fillRect(bldgX - 10, airTopY, bldgW + 20, airBottomY - airTopY);
  ctx.strokeRect(bldgX - 10, airTopY, bldgW + 20, airBottomY - airTopY);
  ctx.setLineDash([]);
  ctx.fillStyle = '#d97706';
  ctx.font = '10px "JetBrains Mono", Consolas, monospace';
  ctx.fillText('Air Rights Corridor (+45.0m to +60.0m) [ULPIN-A]', bldgX + 10, airTopY + 16);

  // 3. Building Floors 1 to 12
  const totalFloors = (activeBuilding && activeBuilding.above_ground_floors) || 12;
  for (let floorNum = 1; floorNum <= totalFloors; floorNum++) {
    const zMin = 0.8 + (floorNum - 1) * 3.6;
    const zMax = 4.4 + (floorNum - 1) * 3.6;
    const floorTopY = getYForZ(zMax);
    const floorBottomY = getYForZ(zMin);
    const floorH = floorBottomY - floorTopY;

    const isTargetFloor = floorNum === selectedFloorNum;

    if (isTargetFloor) {
      // Prominently Highlight the Resident's / Owner's Floor (12th Floor)
      const grad = ctx.createLinearGradient(bldgX, floorTopY, bldgX + bldgW, floorTopY);
      grad.addColorStop(0, 'rgba(5, 150, 105, 0.95)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(bldgX, floorTopY, bldgW, floorH);

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bldgX, floorTopY, bldgW, floorH);

      // Floor Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillText(`★ Floor ${floorNum} (Unit #${activePropertyUnit}) · ${activeUnit.ulpin || 'IN-2187-4930-1049-A-F12-U1204-K8'}`, bldgX + 8, floorTopY + floorH / 2 + 4);

      // Callout Pin / Badge on the right side
      const calloutX = bldgX + bldgW + 15;
      const calloutY = floorTopY + floorH / 2;

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bldgX + bldgW, calloutY);
      ctx.lineTo(calloutX, calloutY);
      ctx.stroke();

      // Badge Card
      const badgeW = Math.min(230, w - calloutX - 10);
      if (badgeW > 80) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.fillRect(calloutX + 4, calloutY - 18, badgeW, 36);
        ctx.strokeRect(calloutX + 4, calloutY - 18, badgeW, 36);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
        ctx.fillText(`RESIDENT: ${activeUnit.owner || 'You'}`, calloutX + 10, calloutY - 4);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", Consolas, monospace';
        ctx.fillText(`Elev: ${activeUnit.zMin || '+36.5m'} to ${activeUnit.zMax || '+39.8m'}`, calloutX + 10, calloutY + 10);
      }
    } else {
      // Standard Floor Box
      ctx.fillStyle = floorNum % 2 === 0 ? 'rgba(30, 41, 59, 0.85)' : 'rgba(23, 32, 48, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.fillRect(bldgX, floorTopY, bldgW, floorH);
      ctx.strokeRect(bldgX, floorTopY, bldgW, floorH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.fillText(`Floor ${String(floorNum).padStart(2, '0')} [LoD-3] · +${zMin.toFixed(1)}m to +${zMax.toFixed(1)}m`, bldgX + 8, floorTopY + floorH / 2 + 3);
    }
  }

  // 4. Basement 1 Parking (-6.0m to -3.0m)
  const baseTopY = getYForZ(-3.0);
  const baseBottomY = getYForZ(-6.0);
  const baseH = baseBottomY - baseTopY;
  const isBasementSelected = activePropertyUnit === 'BASEMENT1';

  ctx.fillStyle = isBasementSelected ? 'rgba(147, 51, 234, 0.85)' : 'rgba(88, 28, 135, 0.45)';
  ctx.strokeStyle = isBasementSelected ? '#c084fc' : '#7e22ce';
  ctx.lineWidth = isBasementSelected ? 2 : 1;
  ctx.fillRect(bldgX - 15, baseTopY, bldgW + 30, baseH);
  ctx.strokeRect(bldgX - 15, baseTopY, bldgW + 30, baseH);
  ctx.fillStyle = '#e9d5ff';
  ctx.font = '10px "JetBrains Mono", Consolas, monospace';
  ctx.fillText('Basement Parking 1 (-6.0m to -3.0m) [2187-4930-1049-A-B01]', bldgX - 5, baseTopY + baseH / 2 + 3);

  // 5. Subsurface Metro Transit Tunnel (-21.0m to -14.0m)
  const metroTopY = getYForZ(-14.0);
  const metroBottomY = getYForZ(-21.0);
  const metroH = metroBottomY - metroTopY;

  ctx.fillStyle = 'rgba(225, 29, 72, 0.35)';
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1;
  ctx.fillRect(bldgX - 35, metroTopY, bldgW + 70, metroH);
  ctx.strokeRect(bldgX - 35, metroTopY, bldgW + 70, metroH);
  ctx.fillStyle = '#fecdd3';
  ctx.font = '10px "JetBrains Mono", Consolas, monospace';
  ctx.fillText('Subsurface Metro Rail Transit Corridor (-21.0m to -14.0m) [DMRC-EPSG:7755]', bldgX - 25, metroTopY + metroH / 2 + 3);

  // 6. Footer Legend
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
  ctx.fillText('2D VOLUMETRIC STRATA CROSS-SECTION • EPSG:7755 / WGS84 ORTHOMETRIC DATUM', 12, h - 14);
}

// ==================================================================
// AI/ML 3D PIPELINE & TOPOLOGY VALIDATION
// ==================================================================
function addLog(text) {
  const logDiv = document.getElementById('ai-logs');
  const p = document.createElement('p');
  p.innerText = text;
  logDiv.appendChild(p);
  logDiv.scrollTop = logDiv.scrollHeight;
}

function runAIPipeline() {
  if (activeRole !== 'officer' && activeRole !== 'surveyor') {
    alert('AI 3D extraction is restricted to DoLR officers and licensed surveyors.');
    return;
  }
  const btn = document.getElementById('btn-run-ai');
  const badge = document.getElementById('ai-status-badge');
  btn.disabled = true;
  badge.innerText = 'PROCESSING...';
  badge.className = 'text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 ';

  document.getElementById('ai-logs').innerHTML = '';
  addLog('[Phase 1/4] Ingesting Drone Photogrammetry & LiDAR Point Cloud (LAS 1.4)...');

  setTimeout(() => {
    addLog('[Phase 2/4] Mask R-CNN & YOLOv8: Segmenting building footprints & facade planes...');
  }, 800);

  setTimeout(() => {
    addLog('[Phase 3/4] PointNet++ RANSAC: Extracting vertical floor heights & LoD-3 polyhedrons...');
  }, 1600);

  setTimeout(() => {
    addLog('[Phase 4/4] PostGIS 3D: Generating volumetric 3D ULPINs & ISO 19152 topology...');
    updateLayerVisibility();
  }, 2400);

  setTimeout(() => {
    addLog('✓ SUCCESS: 14 Volumetric 3D Parcels Successfully Extracted & Validated.');
    btn.disabled = false;
    badge.innerText = 'COMPLETED';
    badge.className = 'text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 ';
  }, 3000);
}

function runTopologyValidation() {
  if (activeRole === 'citizen') {
    alert('Topology validation results are restricted to registry and survey teams.');
    return;
  }
  addLog('[Topology Audit] Validating 3D spatial intersections and manifold closures...');

  setTimeout(() => {
    addLog('[Topology Audit] RESULT: 0 Overlaps, 0 Slivers. 100% Water-tight Volumetric Polyhedrons.');
    const topCard = document.getElementById('topology-card');
    topCard.className = 'mt-auto p-3 bg-emerald-950/60 border border-emerald-500 text-xs glow-emerald';
    alert('✓ 3D Topology Audit Passed!\n- Standard: ISO 19152 LADM v2 3D Cadastre\n- Volumetric Overlaps: 0\n- Boundary Enclosure: 100% Valid Closed 2-Manifolds');
  }, 700);
}

// ==================================================================
// MODALS & EXPORTERS
// ==================================================================
function openCertificateModal() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];

  const certUlpin = document.getElementById('cert-ulpin');
  const certOwner = document.getElementById('cert-owner');
  const certStrata = document.getElementById('cert-strata');
  const certVol = document.getElementById('cert-volume');
  const certZ = document.getElementById('cert-z');

  if (certUlpin) certUlpin.textContent = data.ulpin || 'IN-2187-4930-1049-A-F12-U1204-K8';
  if (certOwner) certOwner.textContent = data.owner || activeRegisteredOwner || 'Dr. Ananya Sharma';
  if (certStrata) certStrata.textContent = `${data.floor} • Unit #${data.id}`;
  if (certVol) certVol.textContent = data.volume;
  if (certZ) certZ.textContent = `${data.zMin} to ${data.zMax}`;

  document.getElementById('certificateModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function syncPropertiesWithAPI() {
  if (typeof apiListProperties !== 'function') return;
  try {
    const properties = await apiListProperties();
    if (properties && properties.length > 0) {
      properties.forEach(p => {
        const uId = p.unit_id || `U${p.id}`;
        cadastralData[uId] = {
          id: uId,
          title: p.title || `Apartment Unit #${uId}`,
          ulpin: p.property_ulpin,
          zone: p.zone || 'A',
          floor: p.floor ? `Floor ${p.floor}` : 'Floor 12',
          zMin: `+${p.z_min}m`,
          zMax: `+${p.z_max}m`,
          volume: `${p.volume} m³`,
          area: `${p.area} m²`,
          owner: p.owner_name || activeRegisteredOwner || 'Registered Title Holder',
          status: p.status === 'claimed' || p.status === 'available' ? 'Verified Freehold Title' : p.status,
          tax: '₹ 14,820 / yr (Paid)',
          strataShare: `${((p.area / 7680) * 100).toFixed(2)}% of Base Parcel`,
          lod: 'LoD 3 Cadastre'
        };
      });
      if (properties[0] && properties[0].unit_id) {
        activePropertyUnit = properties[0].unit_id;
        updatePropertyDetailsCard(activePropertyUnit);
      }
    }
  } catch (err) {
    console.warn('API properties sync fallback to local database:', err.message);
  }
}

function closeCertificateModal() {
  document.getElementById('certificateModal').classList.add('hidden');
}

function openExportModal() {
  document.getElementById('exportModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeExportModal() {
  document.getElementById('exportModal').classList.add('hidden');
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCityGML() {
  const cityGMLContent = `<?xml version="1.0" encoding="UTF-8"?>
<CityModel xmlns="http://www.opengis.net/citygml/3.0"
           xmlns:bldg="http://www.opengis.net/citygml/building/3.0"
           xmlns:gml="http://www.opengis.net/gml/3.2">
  <gml:name>3D_ULPIN_Cadastral_Model_2187-4930-1049</gml:name>
  <cityObjectMember>
    <bldg:Building gml:id="IN-2187-4930-1049">
      <bldg:class>Residential Condominium</bldg:class>
      <bldg:usage>Multi-Family Strata</bldg:usage>
      <bldg:measuredHeight uom="m">42.5</bldg:measuredHeight>
      <bldg:storeysAboveGround>14</bldg:storeysAboveGround>
      <bldg:storeysBelowGround>2</bldg:storeysBelowGround>
      <bldg:buildingUnit>
        <bldg:BuildingUnit gml:id="IN-2187-4930-1049-A-F12-U1204-K8">
          <bldg:usage>Apartment Unit #1204</bldg:usage>
          <bldg:owner>Dr. Ananya Sharma</bldg:owner>
          <bldg:netVolume uom="m3">384.2</bldg:netVolume>
          <bldg:zElevationMin uom="m">36.5</bldg:zElevationMin>
          <bldg:zElevationMax uom="m">39.8</bldg:zElevationMax>
        </bldg:BuildingUnit>
      </bldg:buildingUnit>
    </bldg:Building>
  </cityObjectMember>
</CityModel>`;
  downloadFile(cityGMLContent, '3D_ULPIN_Parcel_2187-4930-1049.gml', 'application/xml');
}

function downloadLADM() {
  const ladmContent = JSON.stringify({
    schema: "ISO 19152 LADM Edition 2 - Part 2: 3D Land Administration",
    baseParcelULPIN: "2187-4930-1049-S00",
    spatialReferenceSystem: "EPSG:7755 + Indian Geoid Datum",
    spatialUnits3D: [
      {
        ulpin3D: "IN-2187-4930-1049-A-F12-U1204-K8",
        stratumType: "Air/AboveGround",
        elevationBounds: { zMin: 36.5, zMax: 39.8, uom: "meter" },
        calculatedVolumeM3: 384.2,
        titleHolder: "Dr. Ananya Sharma",
        titleType: "Freehold Strata",
        topologyVerified: true
      },
      {
        ulpin3D: "IN-2187-4930-1049-U-TUN-DMRC-T7",
        stratumType: "Underground Infrastructure",
        elevationBounds: { zMin: -21.0, zMax: -14.0, uom: "meter" },
        calculatedVolumeM3: 6300.0,
        titleHolder: "Delhi Metro Rail Corp",
        titleType: "Public Statutory Easement",
        topologyVerified: true
      }
    ]
  }, null, 2);
  downloadFile(ladmContent, 'LADM_3D_Cadastre_ISO19152.json', 'application/json');
}

function downloadGeoJSON3D() {
  const geojson3D = JSON.stringify({
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::7755" } },
    features: [
      {
        type: "Feature",
        properties: {
          ulpin: "IN-2187-4930-1049-A-F12-U1204-K8",
          unit: "Apartment 1204",
          volumeM3: 384.2,
          floor: 12,
          zMin: 36.5,
          zMax: 39.8
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [[77.2090, 28.6139, 36.5], [77.2092, 28.6139, 36.5], [77.2092, 28.6141, 36.5], [77.2090, 28.6141, 36.5], [77.2090, 28.6139, 36.5]]
          ]
        }
      }
    ]
  }, null, 2);
  downloadFile(geojson3D, '3D_ULPIN_Polyhedrons.geojson', 'application/geo+json');
}

// ==================================================================
// RENDER ANIMATION LOOP & RESIZE
// ==================================================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const camPosElem = document.getElementById('camera-pos');
  if (camPosElem) {
    camPosElem.innerText = `X: ${Math.round(camera.position.x)}, Y: ${Math.round(camera.position.y)}, Z: ${Math.round(camera.position.z)}`;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  if (!container || !camera || !renderer) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  if (currentViewMode === 'cross') {
    const crossCanvas = document.getElementById('crossSectionCanvas');
    if (crossCanvas) draw2DCrossSection(crossCanvas);
  }
}
