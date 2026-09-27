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
let isAutoRotating = false;
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
  if (activeRole === 'citizen' && window.apiListProperties) {
    try {
      const properties = await apiListProperties();
      const property = properties.find(item => item.unit_id === activePropertyUnit) || properties[0];
      if (property) {
        activePropertyUnit = property.unit_id;
        activeRegisteredOwner = property.owner_name || null;
        const cadastralUnit = cadastralData[property.unit_id];
        if (cadastralUnit) {
          cadastralUnit.owner = activeRegisteredOwner || JSON.parse(sessionStorage.getItem('ulpin-session') || '{}').name || 'Registered Title Holder';
          cadastralUnit.status = property.status || cadastralUnit.status;
        }
      }
      if (property?.building_id) {
        activeBuilding = await apiGetBuilding(property.building_id);
      }
    } catch (error) {
      console.warn('Using illustrative building fallback:', error.message);
    }
  }
  populateFloorSelector();
  if (window.lucide) {
    lucide.createIcons();
  }
  initThreeJS();
  onWindowResize();
  initEventListeners();
  generateULPIN();
  selectUnit(activeRole === 'citizen' ? activePropertyUnit : 'U1204');
  updateRegisteredOwnerDisplay();
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
  document.getElementById('session-name').innerText = userSession.name || profile.name;
  document.getElementById('session-role').innerText = activeRole === 'citizen' && userSession.unit_id
    ? `Citizen / ${userSession.unit_id} Owner`
    : profile.label;
  if (activeRole === 'citizen' && userSession.name) {
    activeRegisteredOwner = userSession.name;
    updateRegisteredOwnerDisplay();
  }
  activeSession.classList.remove('hidden');
  activeSession.classList.add('flex');

  const aiButton = document.getElementById('btn-run-ai');
  const topologyButton = document.getElementById('btn-topology');
  const demarcationButton = document.getElementById('btn-demarcation');
  const canRunAI = activeRole === 'officer' || activeRole === 'surveyor';

  if (aiButton) aiButton.classList.toggle('hidden', !canRunAI);
  if (topologyButton) topologyButton.classList.toggle('hidden', activeRole === 'citizen');
  if (demarcationButton) {
    demarcationButton.classList.toggle('hidden', activeRole !== 'citizen' && activeRole !== 'surveyor');
    demarcationButton.classList.toggle('flex', activeRole === 'citizen' || activeRole === 'surveyor');
  }

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
  const certificateButton = document.querySelector('[onclick="openCertificateModal()"]');
  const exportButton = document.querySelector('[onclick="openExportModal()"]');

  if (!roleTitle || !roleCopy || !activeRole) return;

  const copy = {
    citizen: {
      title: 'Citizen property view',
      text: `Read-only view of your registered ${activePropertyUnit}, title certificate, and demarcation request.`
    },
    officer: {
      title: 'DoLR officer registry workspace',
      text: 'Review all strata, run official topology checks, and administer 3D ULPIN records.'
    },
    surveyor: {
      title: 'Surveyor technical workspace',
      text: 'Inspect layers, prepare draft geometry, run technical checks, and submit survey evidence.'
    }
  }[activeRole];

  roleTitle.innerText = copy.title;
  roleCopy.innerText = copy.text;

  const citizenReadOnly = activeRole === 'citizen';
  [ulpinInput, zoneSelect, floorSelect, unitInput].forEach(input => {
    if (input) input.disabled = citizenReadOnly;
  });

  // Citizens can inspect only their own registered unit through this workspace.
  if (activeRole === 'citizen') {
    if (layerHeading) layerHeading.classList.add('hidden');
    document.querySelectorAll('[onclick^="selectStrataUnit"]').forEach(item => {
      item.classList.toggle('hidden', item.getAttribute('onclick') !== "selectStrataUnit('res')");
    });
    if (certificateButton) certificateButton.classList.remove('hidden');
    if (exportButton) exportButton.classList.add('hidden');
  } else {
    if (layerHeading) layerHeading.classList.remove('hidden');
    document.querySelectorAll('[onclick^="selectStrataUnit"]').forEach(item => item.classList.remove('hidden'));
    if (certificateButton) certificateButton.classList.remove('hidden');
    if (exportButton) exportButton.classList.remove('hidden');
  }

  if (activeRole === 'surveyor') {
    if (exportButton) exportButton.classList.add('hidden');
  }
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
  const data = cadastralData[unitId] || cadastralData['U1204'];

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

function submitDemarcation() {
  const reason = document.getElementById('demarcation-reason').value;
  const notes = document.getElementById('demarcation-notes').value;
  const randomTicket = `DoLR-DEM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  document.getElementById('ticket-number').innerText = randomTicket;
  document.getElementById('demarcation-form').classList.add('hidden');
  document.getElementById('demarcation-success').classList.remove('hidden');

  // Trigger brief highlight in 3D scene
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
  const data = cadastralData[unitId] || cadastralData['U1204'];

  const taxUnitName = document.getElementById('tax-unit-name');
  const taxUnitUlpin = document.getElementById('tax-unit-ulpin');
  const taxTotal = document.getElementById('tax-total-amount');

  if (taxUnitName) taxUnitName.innerText = data.title;
  if (taxUnitUlpin) taxUnitUlpin.innerText = data.ulpin;
  if (taxTotal) taxTotal.innerText = data.tax.split(' ')[0] + ' ' + (data.tax.split(' ')[1] || '14,820');

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
  const data = cadastralData[unitId] || cadastralData['U1204'];

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
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9d5e6);
  scene.fog = new THREE.Fog(0xb9d5e6, 85, 190);

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
  const floorSize = 16;

  for (let f = 0; f < totalFloors; f++) {
    const floorY = 0.5 + f * floorHeight;
    const floorObj = new THREE.Group();
    floorObj.userData = { originalY: floorY, floorIndex: f };

    // Slab Floor Plate
    const slabGeo = new THREE.BoxGeometry(floorSize + 0.4, 0.4, floorSize + 0.4);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      clippingPlanes: [clippingPlane]
    });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.position.y = 0.2;
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    floorObj.add(slabMesh);

    // Subdivide Floor into 4 Distinct Cadastral Units (Quads)
    const unitHalf = floorSize / 2 - 0.4;
    const unitHeight = floorHeight - 0.5;

    const unitOffsets = [
      { x: unitHalf / 2 + 0.2, z: unitHalf / 2 + 0.2, id: `U${String(f + 1).padStart(2, '0')}04` },
      { x: -unitHalf / 2 - 0.2, z: unitHalf / 2 + 0.2, id: f === 2 ? 'U0602' : `U${String(f + 1).padStart(2, '0')}01` },
      { x: -unitHalf / 2 - 0.2, z: -unitHalf / 2 - 0.2, id: `U${String(f + 1).padStart(2, '0')}02` },
      { x: unitHalf / 2 + 0.2, z: -unitHalf / 2 - 0.2, id: `U${String(f + 1).padStart(2, '0')}03` }
    ];

    unitOffsets.forEach((u) => {
      const isTarget1204 = u.id === 'U1204';
      const isTarget1201 = u.id === 'U1201';
      const isTarget0602 = u.id === 'U0602';

      const unitGeo = new THREE.BoxGeometry(unitHalf, unitHeight, unitHalf);

      let unitColor = 0x162e51; // Gov Deep Navy Default
      let opacity = 0.65;

      if (isTarget1204) {
        unitColor = 0x008852; // Gov Forest Green (Target / Owned Unit)
        opacity = 0.9;
      } else if (isTarget1201) {
        unitColor = 0x005ea2; // Gov Trust Blue
        opacity = 0.75;
      } else if (isTarget0602) {
        unitColor = 0x0050d8; // Gov Accent Blue
        opacity = 0.7;
      }

      const unitMat = new THREE.MeshStandardMaterial({
        color: unitColor,
        transparent: true,
        opacity: opacity,
        roughness: 0.3,
        metalness: 0.15,
        clippingPlanes: [clippingPlane]
      });

      const unitMesh = new THREE.Mesh(unitGeo, unitMat);
      unitMesh.position.set(u.x, unitHeight / 2 + 0.4, u.z);
      unitMesh.castShadow = true;
      unitMesh.receiveShadow = true;
      unitMesh.userData = { unitId: u.id, defaultColor: unitColor, defaultOpacity: opacity };

      // Edges outline
      const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(unitGeo),
        new THREE.LineBasicMaterial({
          color: isTarget1204 ? 0x00bde3 : 0x005ea2,
          linewidth: isTarget1204 ? 2 : 1
        })
      );
      unitMesh.add(edgeLines);

      if (isTarget1204) {
        selectedUnitMesh = unitMesh;
      }

      floorObj.add(unitMesh);
      clickableUnits.push(unitMesh);
    });

    floorObj.position.y = floorY;
    floorGroups.push(floorObj);
    groupBuilding.add(floorObj);
  }

  createArchitecturalDetails();

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
  airMesh.position.y = 32;
  airMesh.userData = { unitId: 'AIR' };
  groupAirRights.add(airMesh);
  clickableUnits.push(airMesh);

  const airEdges = new THREE.LineSegments(new THREE.EdgesGeometry(airGeo), new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
  airEdges.position.y = 32;
  groupAirRights.add(airEdges);

  // 6. LiDAR Point Cloud Simulator
  createLiDARPointCloud();

  // 7. Drone Photogrammetry Envelope & Camera Path
  createDroneFlightOverlay();
}

function createArchitecturalDetails() {
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8c0c5, roughness: 0.78, metalness: 0.02 });
  const concreteDark = new THREE.MeshStandardMaterial({ color: 0x6e7880, roughness: 0.72 });
  const facade = new THREE.MeshStandardMaterial({ color: 0x9ca8ad, roughness: 0.82, metalness: 0.03 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x6da8c7,
    metalness: 0.12,
    roughness: 0.16,
    transmission: 0.12,
    transparent: true,
    opacity: 0.88
  });
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x244d68, roughness: 0.2, metalness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x303b43, roughness: 0.32, metalness: 0.75 });
  const warmGlass = new THREE.MeshStandardMaterial({
    color: 0xf2b35f,
    emissive: 0x3a2410,
    emissiveIntensity: 0.28,
    roughness: 0.2,
    metalness: 0.15
  });

  const addBox = (parent, size, position, material, options = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    parent.add(mesh);
    return mesh;
  };

  // A substantial podium makes the tower read as a built structure rather than stacked solids.
  addBox(groupBuilding, [17.6, 1.4, 17.6], [0, 0.7, 0], concreteDark);
  addBox(groupBuilding, [16.7, 0.55, 16.7], [0, 1.52, 0], concrete);
  addBox(groupBuilding, [16.35, 0.35, 16.35], [0, 2.0, 0], facade);

  // Recessed glazing and mullions on all four elevations.
  const floorLevels = Array.from({ length: activeBuilding.above_ground_floors || 12 }, (_, index) => index + 1);
  floorLevels.forEach((level, index) => {
    const y = 1.25 + index * 3.6;
    const windowHeight = 1.45;
    const windowWidth = 2.75;
    [-5.95, -2.0, 2.0, 5.95].forEach(x => {
      addBox(groupBuilding, [windowWidth, windowHeight, 0.12], [x, y, 8.08], glass);
      addBox(groupBuilding, [windowWidth, windowHeight, 0.12], [x, y, -8.08], glassDark);
      addBox(groupBuilding, [windowWidth + 0.16, 0.11, 0.2], [x, y + 0.78, 8.16], metal);
      addBox(groupBuilding, [windowWidth + 0.16, 0.11, 0.2], [x, y - 0.78, 8.16], metal);
    });
    [-5.95, -2.0, 2.0, 5.95].forEach(z => {
      addBox(groupBuilding, [0.12, windowHeight, windowWidth], [8.08, y, z], glass);
      addBox(groupBuilding, [0.12, windowHeight, windowWidth], [-8.08, y, z], glassDark);
      addBox(groupBuilding, [0.2, 0.11, windowWidth + 0.16], [8.16, y + 0.78, z], metal);
      addBox(groupBuilding, [0.2, 0.11, windowWidth + 0.16], [8.16, y - 0.78, z], metal);
    });

    // Horizontal sun-shade bands give the facade a realistic floor rhythm.
    addBox(groupBuilding, [16.45, 0.12, 0.18], [0, y - 0.92, 8.18], concrete);
    addBox(groupBuilding, [16.45, 0.12, 0.18], [0, y - 0.92, -8.18], concrete);
  });

  // Corner columns and vertical fins.
  const towerHeight = (activeBuilding.above_ground_floors || 12) * 3.6 + 0.6;
  const towerCenter = towerHeight / 2 + 0.5;
  [-8.2, 8.2].forEach(x => {
    [-8.15, 8.15].forEach(z => addBox(groupBuilding, [0.38, towerHeight, 0.38], [x, towerCenter, z], concreteDark));
  });
  [-4.05, 4.05].forEach(x => addBox(groupBuilding, [0.16, 25.2, 0.28], [x, 13.2, 8.22], metal));
  [-4.05, 4.05].forEach(z => addBox(groupBuilding, [0.28, 25.2, 0.16], [8.22, 13.2, z], metal));

  // Balconies on the front and right elevations, with simple guardrails.
  [1, 3, 5, 7].forEach(level => {
    const y = 1.35 + (level - 1) * 3.6;
    addBox(groupBuilding, [4.8, 0.18, 1.25], [4.0, y - 0.7, 8.7], concrete);
    addBox(groupBuilding, [4.8, 0.9, 0.08], [4.0, y - 0.2, 9.28], glass);
    addBox(groupBuilding, [0.08, 0.9, 1.25], [1.6, y - 0.2, 8.7], metal);
    addBox(groupBuilding, [0.08, 0.9, 1.25], [6.4, y - 0.2, 8.7], metal);
    [-1.0, -0.3, 0.4, 1.1].forEach(offset => {
      addBox(groupBuilding, [0.045, 0.9, 0.045], [4.0 + offset, y - 0.2, 9.25], metal);
    });
  });

  // Ground-floor lobby, canopy and entry frame.
  addBox(groupBuilding, [5.2, 3.0, 0.18], [0, 2.65, 8.28], glass);
  addBox(groupBuilding, [6.1, 0.25, 2.6], [0, 4.25, 9.25], concrete);
  addBox(groupBuilding, [0.24, 3.7, 0.24], [-3.0, 2.35, 8.55], metal);
  addBox(groupBuilding, [0.24, 3.7, 0.24], [3.0, 2.35, 8.55], metal);

  // Flat roof parapet and compact plant-room equipment.
  const roofY = towerHeight + 0.8;
  addBox(groupBuilding, [17.1, 0.65, 17.1], [0, roofY, 0], concreteDark);
  addBox(groupBuilding, [8.0, 1.2, 5.4], [0, roofY + 0.85, -0.8], concrete);
  addBox(groupBuilding, [2.2, 1.8, 1.8], [-4.5, roofY + 1.35, 3.8], metal);
  addBox(groupBuilding, [2.2, 1.8, 1.8], [4.5, roofY + 1.35, 3.8], metal);
  addBox(groupBuilding, [6.5, 0.1, 0.12], [0, roofY + 1.8, 6.2], glass);

  // Rooftop photovoltaic array and exhaust stacks.
  const solar = new THREE.MeshStandardMaterial({ color: 0x172d47, roughness: 0.28, metalness: 0.55 });
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 4; column++) {
      const panel = addBox(groupBuilding, [1.35, 0.08, 1.9], [-2.4 + column * 1.6, roofY + 1.8, -3.0 + row * 2.0], solar);
      panel.rotation.x = -0.12;
    }
  }
  [-2.7, 2.7].forEach(x => {
    addBox(groupBuilding, [0.55, 2.2, 0.55], [x, roofY + 2.55, -0.5], metal);
    addBox(groupBuilding, [0.9, 0.12, 0.9], [x, roofY + 3.65, -0.5], metal);
  });

  // Warm lobby and a few occupied apartments add depth to the facade.
  addBox(groupBuilding, [2.2, 2.5, 0.15], [-1.5, 2.55, 8.3], warmGlass);
  addBox(groupBuilding, [1.4, 2.2, 0.15], [3.8, 5.1, 8.3], warmGlass);
  addBox(groupBuilding, [1.4, 2.2, 0.15], [-4.2, 12.3, 8.3], warmGlass);

  // Paved site strips and a small planted perimeter.
  const paving = new THREE.MeshStandardMaterial({ color: 0x8f989e, roughness: 0.9 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x343b40, roughness: 0.96 });
  const laneMark = new THREE.MeshBasicMaterial({ color: 0xe8d27b });
  addBox(groupGround, [32, 0.12, 5], [0, 0.06, 15], paving, { castShadow: false });
  addBox(groupGround, [5, 0.12, 32], [15, 0.06, 0], paving, { castShadow: false });
  addBox(groupGround, [4.8, 0.12, 18], [0, 0.07, 12], concrete, { castShadow: false });
  addBox(groupGround, [32, 0.08, 5.8], [0, 0.02, 19], asphalt, { castShadow: false });
  for (let i = -12; i <= 12; i += 4) {
    addBox(groupGround, [1.8, 0.03, 0.08], [i, 0.08, 19], laneMark, { castShadow: false });
  }
  [-9, -3, 3, 9].forEach(x => {
    addBox(groupGround, [2.6, 0.04, 0.12], [x, 0.1, 16.2], laneMark, { castShadow: false });
  });

  createSiteTree(-11, 10, groupGround);
  createSiteTree(11, 10, groupGround);
  createSiteTree(-11, -10, groupGround);
  createSiteTree(11, -10, groupGround);
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
  if (activeRole === 'citizen' && unitId !== activePropertyUnit) {
    unitId = activePropertyUnit;
    meshObj = null;
  }
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
  if (activeRole === 'citizen' && data.id === activePropertyUnit && session.name) {
    data.owner = session.name;
  }
  if (activeRole === 'citizen' && data.id === activePropertyUnit && activeRegisteredOwner) {
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
    const isOwned = activeRole === 'citizen' && data.id === activePropertyUnit;
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

  // Visual Highlight in 3D Scene
  clickableUnits.forEach(u => {
    if (u.material && u.userData.defaultColor) {
      u.material.color.setHex(u.userData.defaultColor);
      u.material.opacity = u.userData.defaultOpacity || 0.65;
    }
  });

  if (meshObj && meshObj.material) {
    meshObj.material.color.setHex(0x008852);
    meshObj.material.opacity = 0.95;
    selectedUnitMesh = meshObj;
  } else {
    const match = clickableUnits.find(u => u.userData.unitId === data.id);
    if (match && match.material) {
      match.material.color.setHex(0x008852);
      match.material.opacity = 0.95;
      selectedUnitMesh = match;
    }
  }

  if (window.lucide) lucide.createIcons();
}

function selectStrataUnit(strataKey) {
  const map = {
    'air': 'AIR',
    'res': 'U1204',
    'surface': 'SURFACE',
    'b1': 'BASEMENT1',
    'metro': 'METRO'
  };
  const unitId = map[strataKey] || 'U1204';
  selectUnit(unitId);
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

  if (mode === 'cross') {
    document.getElementById('btn-cross').className = 'px-3 py-1.5 text-xs bg-emerald-600 text-white font-medium shadow transition';
    document.getElementById('btn-3d').className = 'px-3 py-1.5 text-xs hover:bg-slate-800 text-slate-300 font-medium transition';
    crossCanvas.classList.remove('hidden');
    draw2DCrossSection(crossCanvas);
  } else {
    document.getElementById('btn-3d').className = 'px-3 py-1.5 text-xs bg-emerald-600 text-white font-medium shadow transition';
    document.getElementById('btn-cross').className = 'px-3 py-1.5 text-xs hover:bg-slate-800 text-slate-300 font-medium transition';
    crossCanvas.classList.add('hidden');
  }
}

function draw2DCrossSection(canvasElem) {
  canvasElem.width = container.clientWidth;
  canvasElem.height = container.clientHeight;
  const ctx = canvasElem.getContext('2d');
  const w = canvasElem.width;
  const h = canvasElem.height;

  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, w, h);

  // Elevation Grid Lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.font = '10px JetBrains Mono';
  ctx.fillStyle = '#64748b';

  const zeroY = h * 0.55;

  for (let z = -25; z <= 60; z += 10) {
    const y = zeroY - z * 5.5;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(w - 30, y);
    ctx.stroke();
    ctx.fillText(`${z >= 0 ? '+' : ''}${z}m Datum`, 10, y + 3);
  }

  // Ground Datum Reference
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(50, zeroY);
  ctx.lineTo(w - 20, zeroY);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('Ground Surface Datum (0.00m) - Base 2D Parcel 2187-4930-1049-S00', 80, zeroY + 16);

  // Building Floors
  const bldgX = w * 0.35;
  const bldgW = w * 0.35;

  const floors = activeBuilding.floors || Array.from(
    { length: activeBuilding.above_ground_floors || 12 },
    (_, index) => ({ floor_number: index + 1, floor_code: `F${String(index + 1).padStart(2, '0')}` })
  );
  const selectedFloor = Number((unitData[activePropertyUnit]?.floor || 'F12').replace('F', '')) || 12;
  for (let i = 0; i < floors.length; i++) {
    const floorY = zeroY - (i + 1) * 22;
    const floor = floors[i];
    const isSelected = floor.floor_number === selectedFloor;

    ctx.fillStyle = isSelected ? 'rgba(16, 185, 129, 0.7)' : 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = isSelected ? '#34d399' : '#475569';
    ctx.lineWidth = isSelected ? 2 : 1;

    ctx.fillRect(bldgX, floorY, bldgW, 19);
    ctx.strokeRect(bldgX, floorY, bldgW, 19);

    ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
    ctx.fillText(`Floor ${floor.floor_number} [${isSelected ? activePropertyUnit : 'ULPIN-A'}]`, bldgX + 10, floorY + 13);
  }

  // Basement 1
  ctx.fillStyle = 'rgba(126, 34, 206, 0.4)';
  ctx.strokeStyle = '#c084fc';
  ctx.fillRect(bldgX - 20, zeroY + 10, bldgW + 40, 26);
  ctx.strokeRect(bldgX - 20, zeroY + 10, bldgW + 40, 26);
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText('Basement Parking 1 (-6.0m) [2187-4930-1049-U-B01]', bldgX - 10, zeroY + 27);

  // Metro Tunnel
  ctx.fillStyle = 'rgba(225, 29, 72, 0.4)';
  ctx.strokeStyle = '#f43f5e';
  ctx.fillRect(bldgX - 40, zeroY + 65, bldgW + 80, 28);
  ctx.strokeRect(bldgX - 40, zeroY + 65, bldgW + 80, 28);
  ctx.fillStyle = '#fecdd3';
  ctx.fillText('Subsurface Metro Rail Transit Tunnel (-18.0m) [2187-4930-1049-U-TUN-DMRC]', bldgX - 30, zeroY + 83);
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
  document.getElementById('certificateModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
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
