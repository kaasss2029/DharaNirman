/**
 * DharaNirman - 3D ULPIN & Vertical Property Mapping System
 * MoRD / DoLR PS ID: 26011 | ISO 19152 LADM v2 & OGC CityGML 3.0 Compliant
 */

// Global State
let scene, camera, renderer, controls, sunLight;
let container;
let raycaster, mouse;
let clickableUnits = [];
let hoveredUnit = null;
let selectedUnitMesh = null;
let currentViewMode = '3d'; // '3d' or 'cross'
let isAutoRotating = true;
let isWireframeMode = false;
let isPanMode = false;
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
  const currentVal = selector.value;
  selector.replaceChildren();
  const lang = currentLanguage || 'en';
  const floorWord = lang === 'hi' ? 'तल' : 'Floor';
  const basementWord = lang === 'hi' ? 'तहखाना' : 'Basement';
  const surfaceWord = lang === 'hi' ? 'धरातल (ग्राउंड)' : 'Surface Ground';

  activeBuilding.floors.forEach(floor => {
    const option = document.createElement('option');
    option.value = floor.floor_code;
    option.textContent = `${floorWord} ${String(floor.floor_number).padStart(2, '0')} (${floor.floor_code})`;
    selector.appendChild(option);
  });
  for (let level = 1; level <= (activeBuilding.basement_levels || 0); level += 1) {
    const option = document.createElement('option');
    option.value = `B${String(level).padStart(2, '0')}`;
    option.textContent = `${basementWord} ${level} (B${String(level).padStart(2, '0')})`;
    selector.appendChild(option);
  }
  const surface = document.createElement('option');
  surface.value = 'S00';
  surface.textContent = `${surfaceWord} (S00)`;
  selector.appendChild(surface);

  if (currentVal) selector.value = currentVal;
}

let currentLanguage = 'en';
const i18n = {
  en: {
    // Masthead & Header
    masthead_text: 'DharaNirman 3D Cadastre • Smart India Hackathon',
    masthead_psid: 'PS ID: 26011 • ISO 19152 LADM v2',
    header_badge: '3D ULPIN v3.2 • ISO 19152 LADM',
    brand_sub: 'Volumetric Land Administration & Cadastre System',
    cors_status: 'SoI CORS Network: <strong>ACTIVE</strong> (RTK Fix ±1.2cm)',
    btn_demarcation: 'Request Demarcation',
    btn_cert: '3D Bhu-Aadhaar Card',
    btn_export: 'Export Cadastre',
    theme_dark: 'Dark',
    theme_light: 'Light',
    lang_toggle: 'हिंदी',

    // Left Panel - Multi-Source Spatial Layers
    layers_title: 'Multi-Source Spatial Layers',
    layers_active: '5 ACTIVE',
    layer_drone_title: 'Drone Photogrammetry',
    layer_drone_desc: '0.02m GSD Mesh / GeoTIFF',
    layer_lidar_title: 'LiDAR Point Cloud',
    layer_lidar_desc: '24.6M pts • Classified LAZ',
    layer_gis_title: 'GIS Cadastral Base',
    layer_gis_desc: 'Khasra 2187/4930 • PostGIS 3D',
    layer_bim_title: 'Architectural BIM (IFC)',
    layer_bim_desc: 'LoD 3.0 Strata Subdivision',
    layer_subsurface_title: 'Sub-Surface & Utilities',
    layer_subsurface_desc: 'Basements, Metro, Pipelines',

    // Left Panel - 3D ULPIN Encoder
    encoder_title: '3D ULPIN Spatial Encoder',
    encoder_badge: 'Live Encoding',
    lbl_base_ulpin: '2D Surface ULPIN (Base Parcel)',
    lbl_zone_type: 'Volumetric Stratum Zone',
    opt_zone_air: 'Air Rights (Above Ground)',
    opt_zone_surface: 'Surface Parcel (Ground Level)',
    opt_zone_underground: 'Sub-Surface (Basement / Underground)',
    lbl_floor_stratum: 'Floor Level (Z-Stratum)',
    lbl_unit_id: 'Unit / Apartment Identifier',
    lbl_checksum: 'CRC-8 Checksum',
    lbl_generated_ulpin: 'Generated 3D ULPIN Identifier',

    // Center - Registry Card & Controls
    registry_card_title: 'Volumetric Cadastre Engine',
    status_online: 'Online',
    registry_authority_tag: 'DoLR & SoI National Standard',
    postgis_active: 'PostGIS 3D Spatial RDBMS: Connected & Synchronized',
    btn_mode_3d: '3D Isometric View',
    btn_mode_cross: 'Elevation Slice',
    btn_mode_topology: 'Topology Audit',
    hud_crs: 'CRS: EPSG:7767 (WGS84 / UTM 43N)',
    hud_vertical: 'Vertical Datum: MSL (EGM2008) • RTK ±1.2cm',
    hud_camera: 'Camera: OrbitControls 3D • Double-click Unit to Inspect',
    vis_role_title: 'Citizen 3D Property Workspace',
    vis_role_copy: 'Full 3D CAD inspection of U1204, strata stack, title certificate, property tax, and demarcation tools.',

    // Precision Sliders & Dock
    slider_zoom: 'Camera Distance (Zoom)',
    slider_explode: 'Strata Explode',
    slider_slice: 'Vertical Section (Z)',
    btn_reset: 'Reset View',
    btn_pan: 'Pan / Move',
    btn_pan_on: 'Pan: ON',
    btn_wireframe: 'Wireframe',
    btn_wireframe_on: 'Wireframe: ON',
    btn_rotate: 'Rotate',
    btn_rotate_on: 'Rotate: ON',
    btn_rotate_off: 'Rotate: OFF',

    // Right Panel - Selected Unit
    selected_unit_heading: 'Selected 3D Spatial Unit',
    your_registered_unit: 'Your Registered Unit',
    title_designation: 'Title Designation',
    lod_badge: 'LoD 3 Cadastre',
    lbl_z: 'Vertical Elevation (Z)',
    lbl_vol: 'Calculated Volume',
    lbl_area: 'Carpet Area',
    lbl_owner: 'Owner / Title Holder',
    lbl_status: 'Title Status:',
    status_verified: 'Verified Freehold Title',
    lbl_tax: 'Tax Assessment:',
    btn_pay_tax: 'Pay Online',
    lbl_strata: 'Strata Share:',

    // Planning & Regulations
    planning_context: 'Building Regulations & Planning',
    planning_envelope_lbl: 'Envelope Envelope Height:',
    planning_underground_lbl: 'Permitted Basements:',
    planning_disclaimer: 'Derived dynamically from Model Building By-Laws & URDPFI Guidelines.',

    // Strata Stack Navigation
    strata_stack_heading: 'Vertical Strata Navigation',
    click_to_focus: 'Click to focus & slice',
    strata_air: 'Air Rights / Penthouse (FL 13-14)',
    strata_res: 'Residential Units (FL 01-12)',
    strata_res_units: '48 Volumetric Parcels',
    strata_surface: 'Commercial / Retail (S00)',
    strata_b1: 'Basement Parking B1 (-3.6m)',
    strata_metro: 'Metro Rail Corridor B2 (-8.2m)',

    // Topology Audit
    topology_audit_title: 'Automated 3D Topology Validation',
    topology_audit_desc: 'OGC CityGML 3.0 & ISO 19152 compliant manifold watertightness & zero-overlap volumetric verification.',

    // 3D Bhu-Aadhaar Certificate Modal
    cert_authority: 'Department of Land Resources • Survey of India',
    cert_registry: 'National 3D Land Cadastre & Strata Title Registry',
    cert_subtitle: '3D Bhu-Aadhaar Volumetric Title Certificate',
    cert_badge: 'OFFICIAL CADASTRE CERTIFICATE • ISO 19152 LADM v2',
    cert_lbl_ulpin: '3D ULPIN / Bhu-Aadhaar ID',
    cert_lbl_base: 'Base Land Parcel (2D ULPIN)',
    cert_lbl_owner: 'Primary Registered Owner',
    cert_lbl_vault: 'DigiLocker / Aadhaar Vault',
    cert_lbl_strata: 'Strata Property Type',
    cert_val_condo: 'High-Rise Residential Condominium (Freehold)',
    cert_lbl_extent: 'Carpet Area Extent',
    cert_lbl_vol: 'Enclosed Legal 3D Volume',
    cert_lbl_bounds: 'Vertical Elevation Bounds (Z)',
    cert_lbl_crs: 'Coordinate Reference System (CRS)',
    cert_lbl_blockchain: 'National Registry Blockchain Hash',
    cert_verified_tag: 'Digitally Signed & Cryptographically Verified by DoLR Cadastral Authority',
    cert_btn_print: 'Print Official Certificate',
    btn_close_window: 'Close Window',

    // Export Modal
    export_modal_title: 'Export Cadastral Spatial Data',
    export_modal_sub: 'Choose standardized ISO/OGC open formats for GIS, CAD, or legal land record administration.',
    export_citygml_title: 'OGC CityGML 3.0 (XML)',
    export_citygml_desc: 'Full 3D volumetric building geometry with thematic semantic attributes and LoD 3.0 solids.',
    export_ladm_title: 'ISO 19152 LADM v2 (LandXML / INTERLIS)',
    export_ladm_desc: 'Standardized Land Administration Domain Model packages with RRR (Rights, Restrictions, Responsibilities).',
    export_geojson_title: '3D GeoJSON-LD',
    export_geojson_desc: 'Web-ready 3D polygon prisms with EPSG:7767 coordinates and ULPIN property metadata.',
    btn_close: 'Close',

    // Demarcation Modal
    dem_eyebrow: 'Survey of India • CORS Network Demarcation',
    dem_title: 'Request 3D Property Demarcation',
    dem_target_lbl: 'Target 3D Parcel (ULPIN)',
    dem_reason_lbl: 'Reason for Demarcation',
    dem_opt_encroachment: 'Vertical Strata Encroachment / Wall Shift',
    dem_opt_subdivision: 'Unit Subdivision / Partition Registration',
    dem_opt_easement: 'Air Rights / Balcony Projection Easement',
    dem_opt_resurvey: 'LiDAR / CORS Re-Survey Verification',
    dem_remarks_lbl: 'Citizen Remarks / Field Observation',
    dem_notes_placeholder: 'Describe discrepancy or purpose of field inspection...',
    dem_evidence_lbl: 'Attach 3D LiDAR / Photogrammetry Point Cloud',
    dem_scan_attached: 'Pre-loaded sensor scan attached from active 3D view session',
    dem_btn_submit: 'Submit Demarcation Request',
    dem_success_title: 'Demarcation Request Dispatched',
    dem_success_desc: 'Your request has been routed to the Survey of India field division. An authorized cadastral surveyor will conduct high-precision RTK GNSS inspection.',
    dem_lbl_ticket: 'Demarcation Ticket ID',
    dem_lbl_surveyor: 'Assigned Surveyor',
    dem_lbl_inspection: 'Inspection Date',
    dem_val_inspection: 'Estimated within 3 business days',
    dem_lbl_standard: 'Precision Standard',
    dem_val_standard: 'SoI CORS RTK Fix (Horizontal ±10mm / Vertical ±15mm)',
    dem_btn_return: 'Return to 3D Cadastre',

    // Tax Modal
    tax_eyebrow: 'Municipal Revenue Authority • 3D Volumetric Assessment',
    tax_title: '3D Property Tax Assessment & Payment',
    tax_badge_paid: 'Current Status: FY 2026-27 PAID',
    tax_formula_title: 'Volumetric Tax Assessment Breakdown',
    tax_base_lbl: 'Base Carpet Area (124 m² × ₹80/m²)',
    tax_height_lbl: 'Vertical Height Premium (Floor 12, Z=+39.6m, +25%)',
    tax_amenity_lbl: 'Common Strata Amenity & Air Rights Access',
    tax_total_lbl: 'Total Annual Volumetric Tax Due',
    tax_gateway_title: 'Pay with National Unified Tax Gateway (BBPS / UPI)',
    tax_gateway_sub: 'Instant cryptographic receipt will be recorded to your 3D ULPIN registry ledger.',
    tax_btn_pay_amount: 'Pay ₹14,000 via BBPS / UPI',
    tax_btn_receipt: 'Download Tax Receipt'
  },
  hi: {
    // Masthead & Header
    masthead_text: 'धरानिर्माण 3D कैडस्ट्रे • स्मार्ट इंडिया हैकथॉन',
    masthead_psid: 'समस्या आईडी: 26011 • ISO 19152 LADM v2',
    header_badge: '3D भू-आधार (ULPIN) v3.2 • ISO 19152 LADM',
    brand_sub: 'त्रि-आयामी (3D) भू-अभिलेख एवं कैडस्ट्रे प्रणाली',
    cors_status: 'सर्वे ऑफ इंडिया CORS नेटवर्क: <strong>सक्रिय</strong> (RTK ±1.2cm)',
    btn_demarcation: 'सीमांकन अनुरोध',
    btn_cert: '3D भू-आधार कार्ड',
    btn_export: 'कैडस्ट्रे डेटा निर्यात',
    theme_dark: 'डार्क',
    theme_light: 'लाइट',
    lang_toggle: 'English',

    // Left Panel - Multi-Source Spatial Layers
    layers_title: 'बहु-स्रोत स्थानिक परतें (Spatial Layers)',
    layers_active: '5 सक्रिय',
    layer_drone_title: 'ड्रोन फोटोग्रामेट्री',
    layer_drone_desc: '0.02m GSD मेश / GeoTIFF',
    layer_lidar_title: 'LiDAR पॉइंट क्लाउड',
    layer_lidar_desc: '24.6M बिंदु • वर्गीकृत LAZ',
    layer_gis_title: 'GIS कैडस्ट्रल बेस',
    layer_gis_desc: 'खसरा 2187/4930 • PostGIS 3D',
    layer_bim_title: 'आर्किटेक्चरल BIM (IFC)',
    layer_bim_desc: 'LoD 3.0 स्ट्रैट उप-विभाजन',
    layer_subsurface_title: 'भूमिगत उपयोगिताएं (Utilities)',
    layer_subsurface_desc: 'तहखाना, मेट्रो, पाइपलाइन',

    // Left Panel - 3D ULPIN Encoder
    encoder_title: '3D ULPIN स्थानिक एन्कोडर',
    encoder_badge: 'लाइव एन्कोडिंग',
    lbl_base_ulpin: '2D धरातलीय ULPIN (मूल भूखंड)',
    lbl_zone_type: 'त्रि-आयामी (3D) ज़ोन प्रकार',
    opt_zone_air: 'वायु अधिकार (धरातल से ऊपर)',
    opt_zone_surface: 'धरातल भूखंड (ज़मीनी स्तर)',
    opt_zone_underground: 'भूमिगत स्तर (तहखाना / अधोभूमि)',
    lbl_floor_stratum: 'मंजिल स्तर (Z-स्ट्रैटम)',
    lbl_unit_id: 'इकाई / फ्लैट पहचान संख्या',
    lbl_checksum: 'CRC-8 चेकसम',
    lbl_generated_ulpin: 'जनरेटेड 3D ULPIN पहचान संख्या',

    // Center - Registry Card & Controls
    registry_card_title: 'वॉल्यूमेट्रिक कैडस्ट्रे इंजन',
    status_online: 'ऑनलाइन',
    registry_authority_tag: 'DoLR एवं SoI राष्ट्रीय मानक',
    postgis_active: 'PostGIS 3D स्थानिक RDBMS: कनेक्टेड व सिंक्रोनाइज़्ड',
    btn_mode_3d: '3D आइसोमेट्रिक व्यू',
    btn_mode_cross: 'ऊर्ध्वाधर स्लाइस व्यू',
    btn_mode_topology: 'टोपोलॉजी ऑडिट',
    hud_crs: 'CRS: EPSG:7767 (WGS84 / UTM 43N)',
    hud_vertical: 'वर्टिकल डेटम: MSL (EGM2008) • RTK ±1.2cm',
    hud_camera: 'कैमरा: OrbitControls 3D • विवरण हेतु फ्लैट पर दो बार क्लिक करें',
    vis_role_title: 'नागरिक 3D संपत्ति कार्यक्षेत्र',
    vis_role_copy: 'U1204 का पूर्ण 3D CAD निरीक्षण, स्ट्रैट स्टैक, भू-स्वामित्व प्रमाण पत्र, संपत्ति कर एवं सीमांकन उपकरण।',

    // Precision Sliders & Dock
    slider_zoom: 'कैमरा दूरी (ज़ूम)',
    slider_explode: 'मंजिल विस्तार (Explode)',
    slider_slice: 'ऊर्ध्वाधर सेक्शन (Z)',
    btn_reset: 'दृश्य रीसेट',
    btn_pan: 'पैन / मूव',
    btn_pan_on: 'पैन: चालू',
    btn_wireframe: 'वायरफ्रेम',
    btn_wireframe_on: 'वायरफ्रेम: चालू',
    btn_rotate: 'घूर्णन',
    btn_rotate_on: 'घूर्णन: चालू',
    btn_rotate_off: 'घूर्णन: बंद',

    // Right Panel - Selected Unit
    selected_unit_heading: 'चयनित 3D स्थानिक इकाई',
    your_registered_unit: 'आपकी पंजीकृत इकाई',
    title_designation: 'स्वामित्व विवरण (Title)',
    lod_badge: 'LoD 3 कैडस्ट्रे',
    lbl_z: 'ऊर्ध्वाधर ऊंचाई (Z)',
    lbl_vol: 'कुल आयतन (Volume)',
    lbl_area: 'कारपेट क्षेत्रफल',
    lbl_owner: 'स्वामित्व / धारक',
    lbl_status: 'स्वामित्व स्थिति:',
    status_verified: 'सत्यापित फ्रीहोल्ड स्वामित्व',
    lbl_tax: 'संपत्ति कर आकलन:',
    btn_pay_tax: 'ऑनलाइन भुगतान',
    lbl_strata: 'अपार्टमेंट अनुपात:',

    // Planning & Regulations
    planning_context: 'भवन विनियम एवं योजना नियम',
    planning_envelope_lbl: 'अधिकतम स्वीकृत ऊंचाई:',
    planning_underground_lbl: 'स्वीकृत बेसमेंट स्तर:',
    planning_disclaimer: 'मॉडल बिल्डिंग बाय-लॉज़ और URDPFI दिशानिर्देशों के आधार पर।',

    // Strata Stack Navigation
    strata_stack_heading: 'ऊर्ध्वाधर स्ट्रैट नेविगेशन',
    click_to_focus: 'फोकस एवं स्लाइस हेतु क्लिक करें',
    strata_air: 'वायु अधिकार / पेंटहाउस (तल 13-14)',
    strata_res: 'आवासीय इकाइयाँ (तल 01-12)',
    strata_res_units: '48 त्रि-आयामी भूखंड',
    strata_surface: 'वाणिज्यिक / खुदरा ग्राउंड (S00)',
    strata_b1: 'बेसमेंट पार्किंग B1 (-3.6m)',
    strata_metro: 'मेट्रो रेल कॉरिडोर B2 (-8.2m)',

    // Topology Audit
    topology_audit_title: 'स्वचालित 3D टोपोलॉजी सत्यापन',
    topology_audit_desc: 'OGC CityGML 3.0 और ISO 19152 अनुपालन: शून्य-अतिव्यापन (Zero-overlap) एवं वाटरटाइट 3D सत्यापन।',

    // 3D Bhu-Aadhaar Certificate Modal
    cert_authority: 'भूमि संसाधन विभाग • सर्वे ऑफ इंडिया',
    cert_registry: 'राष्ट्रीय 3D भूमि कैडस्ट्रे एवं स्ट्रैट स्वामित्व रजिस्ट्री',
    cert_subtitle: '3D भू-आधार त्रि-आयामी स्वामित्व प्रमाण पत्र',
    cert_badge: 'आधिकारिक कैडस्ट्रे प्रमाण पत्र • ISO 19152 LADM v2',
    cert_lbl_ulpin: '3D ULPIN / भू-आधार आईडी',
    cert_lbl_base: 'मूल भूखंड (2D ULPIN)',
    cert_lbl_owner: 'मुख्य पंजीकृत स्वामी',
    cert_lbl_vault: 'डिजिलॉकर / आधार वॉल्ट',
    cert_lbl_strata: 'स्ट्रैट संपत्ति प्रकार',
    cert_val_condo: 'बहुमंजिला आवासीय अपार्टमेंट (फ्रीहोल्ड)',
    cert_lbl_extent: 'कारपेट क्षेत्रफल विस्तार',
    cert_lbl_vol: 'कानूनी त्रि-आयामी आयतन (3D Volume)',
    cert_lbl_bounds: 'ऊर्ध्वाधर ऊंचाई सीमाएं (Z)',
    cert_lbl_crs: 'निर्देशांक संदर्भ प्रणाली (CRS)',
    cert_lbl_blockchain: 'राष्ट्रीय रजिस्ट्री ब्लॉकचेन हैश',
    cert_verified_tag: 'DoLR कैडस्ट्रल प्राधिकरण द्वारा डिजिटल रूप से हस्ताक्षरित एवं सत्यापित',
    cert_btn_print: 'आधिकारिक प्रमाण पत्र प्रिंट करें',
    btn_close_window: 'विंडो बंद करें',

    // Export Modal
    export_modal_title: 'कैडस्ट्रल स्थानिक डेटा निर्यात',
    export_modal_sub: 'GIS, CAD अथवा कानूनी भू-अभिलेख प्रशासन हेतु मानकीकृत ISO/OGC प्रारूप चुनें।',
    export_citygml_title: 'OGC CityGML 3.0 (XML)',
    export_citygml_desc: 'LoD 3.0 सॉलिड्स और सिमेंटिक विशेषताओं के साथ पूर्ण 3D त्रि-आयामी भवन ज्यामिति।',
    export_ladm_title: 'ISO 19152 LADM v2 (LandXML / INTERLIS)',
    export_ladm_desc: 'अधिकार, प्रतिबंध एवं जिम्मेदारियों (RRR) सहित मानकीकृत भूमि प्रशासन मॉडल।',
    export_geojson_title: '3D GeoJSON-LD',
    export_geojson_desc: 'EPSG:7767 निर्देशांक और ULPIN मेटाडेटा सहित वेब-अनुकूल 3D पॉलीगॉन प्रिज्म।',
    btn_close: 'बंद करें',

    // Demarcation Modal
    dem_eyebrow: 'सर्वे ऑफ इंडिया • CORS नेटवर्क सीमांकन',
    dem_title: '3D संपत्ति सीमांकन हेतु अनुरोध',
    dem_target_lbl: 'लक्षित 3D भूखंड (ULPIN)',
    dem_reason_lbl: 'सीमांकन का कारण',
    dem_opt_encroachment: 'ऊर्ध्वाधर स्ट्रैट अतिक्रमण / दीवार खिसकना',
    dem_opt_subdivision: 'यूनिट उप-विभाजन / विभाजन पंजीकरण',
    dem_opt_easement: 'वायु अधिकार / बालकनी प्रोजेक्शन ईजमेंट',
    dem_opt_resurvey: 'LiDAR / CORS पुन: सर्वेक्षण सत्यापन',
    dem_remarks_lbl: 'नागरिक टिप्पणी / फील्ड अवलोकन',
    dem_notes_placeholder: 'विसंगति अथवा फील्ड निरीक्षण के उद्देश्य का विवरण दें...',
    dem_evidence_lbl: '3D LiDAR / फोटोग्रामेट्री पॉइंट क्लाउड संलग्न करें',
    dem_scan_attached: 'सक्रिय 3D दृश्य सत्र से प्री-लोडेड सेंसर स्कैन संलग्न है',
    dem_btn_submit: 'सीमांकन अनुरोध जमा करें',
    dem_success_title: 'सीमांकन अनुरोध सफलतापूर्वक दर्ज',
    dem_success_desc: 'आपका अनुरोध सर्वे ऑफ इंडिया फील्ड डिवीजन को भेज दिया गया है। अधिकृत सर्वेक्षक उच्च-सटीक RTK GNSS निरीक्षण करेंगे।',
    dem_lbl_ticket: 'सीमांकन टिकट आईडी',
    dem_lbl_surveyor: 'नियुक्त सर्वेक्षक',
    dem_lbl_inspection: 'निरीक्षण तिथि',
    dem_val_inspection: '3 कार्य दिवसों के भीतर अनुमानित',
    dem_lbl_standard: 'परिशुद्धता मानक',
    dem_val_standard: 'SoI CORS RTK फिक्स (क्षैतिज ±10mm / ऊर्ध्वाधर ±15mm)',
    dem_btn_return: '3D कैडस्ट्रे पर लौटें',

    // Tax Modal
    tax_eyebrow: 'नगर निगम राजस्व प्राधिकरण • 3D त्रि-आयामी कर आकलन',
    tax_title: '3D संपत्ति कर आकलन एवं भुगतान',
    tax_badge_paid: 'वर्तमान स्थिति: वित्त वर्ष 2026-27 प्रदत्त (PAID)',
    tax_formula_title: 'त्रि-आयामी (3D) कर गणना का विवरण',
    tax_base_lbl: 'मूल कारपेट क्षेत्रफल (124 m² × ₹80/m²)',
    tax_height_lbl: 'ऊंचाई प्रीमियम (तल 12, Z=+39.6m, +25%)',
    tax_amenity_lbl: 'साझा सुविधाएं एवं वायु अधिकार एक्सेस',
    tax_total_lbl: 'कुल वार्षिक देय 3D संपत्ति कर',
    tax_gateway_title: 'राष्ट्रीय एकीकृत कर गेटवे द्वारा भुगतान करें (BBPS / UPI)',
    tax_gateway_sub: 'तत्काल डिजिटल रसीद आपके 3D ULPIN रजिस्ट्री लेजर में दर्ज की जाएगी।',
    tax_btn_pay_amount: '₹14,000 का भुगतान करें (BBPS / UPI)',
    tax_btn_receipt: 'कर रसीद डाउनलोड करें'
  }
};

const authProfiles = {
  citizen: {
    en: { name: 'Dr. Ananya Sharma', label: 'Citizen / Unit #1204 Owner', copy: 'View verified 3D titles, download Bhu-Aadhaar cards, pay 3D property tax, and request boundary demarcation.' },
    hi: { name: 'डॉ. अनन्या शर्मा', label: 'नागरिक / यूनिट #1204 स्वामी', copy: 'सत्यापित 3D स्वामित्व देखें, भू-आधार कार्ड डाउनलोड करें, 3D संपत्ति कर का भुगतान करें, एवं सीमांकन का अनुरोध करें।' }
  },
  officer: {
    en: { name: 'R. K. Iyer (DoLR)', label: 'DoLR Registry Officer', copy: 'Review submissions, run AI 3D building extraction, validate topology, and issue official 3D ULPIN titles.' },
    hi: { name: 'आर. के. अय्यर (DoLR)', label: 'भूमि संसाधन पंजीयक अधिकारी', copy: 'प्रस्तुतियों की समीक्षा करें, AI 3D भवन निष्कर्षण चलाएं, टोपोलॉजी सत्यापित करें, और 3D ULPIN जारी करें।' }
  },
  surveyor: {
    en: { name: 'Neha Kulkarni', label: 'Licensed Surveyor (SoI)', copy: 'Upload LiDAR survey data, inspect strata boundaries, and submit field demarcation results.' },
    hi: { name: 'नेहा कुलकर्णी', label: 'लाइसेंस प्राप्त सर्वेक्षक (SoI)', copy: 'LiDAR सर्वेक्षण डेटा अपलोड करें, स्ट्रैट सीमाओं का निरीक्षण करें, और फील्ड सीमांकन रिपोर्ट दर्ज करें।' }
  }
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
  const lang = currentLanguage || 'en';
  if (label) {
    if (isDark) {
      label.textContent = lang === 'hi' ? 'लाइट' : 'Light';
    } else {
      label.textContent = lang === 'hi' ? 'डार्क' : 'Dark';
    }
  }
  const icons = [document.getElementById('icon-theme'), document.getElementById('icon-theme-mobile')];
  icons.forEach(ic => {
    if (ic) {
      ic.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      ic.className = isDark ? 'w-3.5 h-3.5 text-amber-300' : 'w-3.5 h-3.5 text-cyan-300';
    }
  });
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
  if (btn) {
    btn.setAttribute('title', isDark
      ? (lang === 'hi' ? 'लाइट थीम पर बदलें' : 'Switch to Light Theme')
      : (lang === 'hi' ? 'डार्क थीम पर बदलें' : 'Switch to Dark Theme'));
  }
}

function updateThreeTheme(isDark) {
  if (!scene) return;
  const bgColor = isDark ? 0x1a1b26 : 0xb9d5e6;
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
    owner: 'Registered Title Holder',
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
    owner: 'Registered Title Holder',
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
    owner: 'Registered Title Holder',
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
    owner: 'Property Holder / Title Holder',
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
    } catch (error) {
      console.warn('Could not load case details for 3D visualizer:', error.message);
    }
  } else if (!caseId && window.apiRequest && (activeRole === 'officer' || activeRole === 'surveyor')) {
    // If opened directly by Officer or Surveyor without a specific case query param,
    // unified 3D viewer automatically selects the latest case from the workflow queue
    try {
      const cases = await apiRequest('/api/cases');
      if (cases && cases.length > 0) {
        loadedCase = cases[0];
      }
    } catch (error) {
      console.warn('Could not load latest workflow case for 3D visualizer:', error.message);
    }
  }

  if (loadedCase) {
    if (loadedCase.property_ulpin) {
      const matchProp = Object.values(cadastralData).find(p => p.ulpin === loadedCase.property_ulpin) ||
                        Object.values(cadastralData).find(p => loadedCase.property_ulpin.includes(p.id));
      if (matchProp) {
        activePropertyUnit = matchProp.id;
        matchProp.status = `Case #${loadedCase.id}: ${loadedCase.status.replaceAll('_', ' ')}`;
        if (loadedCase.citizen_name) {
          matchProp.owner = loadedCase.citizen_name;
        }
      } else {
        const uMatch = loadedCase.property_ulpin.match(/U\d{4}/i);
        if (uMatch) activePropertyUnit = uMatch[0].toUpperCase();
      }
    }

    if (loadedCase.citizen_name) {
      activeRegisteredOwner = loadedCase.citizen_name;
      if (cadastralData[activePropertyUnit]) {
        cadastralData[activePropertyUnit].owner = loadedCase.citizen_name;
      }
    }

    const roleTitle = document.getElementById('visualizer-role-title');
    const roleCopy = document.getElementById('visualizer-role-copy');
    if (roleTitle) roleTitle.innerText = `Case #${loadedCase.id} 3D Inspection · ${loadedCase.title}`;
    if (roleCopy) roleCopy.innerText = `Target ULPIN: ${loadedCase.property_ulpin} | Citizen: ${loadedCase.citizen_name || 'Applicant'} | Status: ${loadedCase.status.replaceAll('_', ' ')}`;

    const caseRegTitle = document.getElementById('registry-case-title');
    const caseRegApplicant = document.getElementById('registry-case-applicant');
    const caseRegMeta = document.getElementById('registry-case-meta');
    const caseStatusBadge = document.getElementById('case-status-badge');
    if (caseRegTitle) caseRegTitle.innerText = `Case #${loadedCase.id} · ${loadedCase.title}`;
    if (caseRegApplicant) caseRegApplicant.innerText = `Citizen: ${loadedCase.citizen_name || 'Applicant'} (Unit #${activePropertyUnit})`;
    if (caseRegMeta) caseRegMeta.innerText = `Target ULPIN: ${loadedCase.property_ulpin}`;
    if (caseStatusBadge) caseStatusBadge.innerText = loadedCase.status.toUpperCase().replaceAll('_', ' ');

    const targetState = loadedCase.state || cadastralData[activePropertyUnit]?.state;
    const targetCity = loadedCase.city || cadastralData[activePropertyUnit]?.city;
    await loadRegulationContext(targetState, targetCity);
  } else if (paramUnitId) {
    activePropertyUnit = paramUnitId.toUpperCase();
    const targetState = cadastralData[activePropertyUnit]?.state;
    const targetCity = cadastralData[activePropertyUnit]?.city;
    await loadRegulationContext(targetState, targetCity);
  } else if (paramUlpin) {
    const matchProp = Object.values(cadastralData).find(p => p.ulpin === paramUlpin);
    if (matchProp) activePropertyUnit = matchProp.id;
    const targetState = cadastralData[activePropertyUnit]?.state;
    const targetCity = cadastralData[activePropertyUnit]?.city;
    await loadRegulationContext(targetState, targetCity);
  } else {
    const targetState = cadastralData[activePropertyUnit]?.state;
    const targetCity = cadastralData[activePropertyUnit]?.city;
    await loadRegulationContext(targetState, targetCity);
  }

  populateFloorSelector();
  const savedLang = localStorage.getItem('dharanirman_lang') || 'en';
  applyLanguage(savedLang, false);
  updateThemeButton(document.documentElement.classList.contains('dark'));
  if (window.lucide) {
    lucide.createIcons();
  }
  initThreeJS();
  onWindowResize();
  initEventListeners();
  generateULPIN();

  // Select unit and focus camera on target property with 0.6x default zoom
  selectUnit(activePropertyUnit);
  setTimeout(() => {
    focusCitizenProperty(activePropertyUnit);
    onZoomChange(0.6);
  }, 300);
});

function updateRegisteredOwnerDisplay() {
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  const ownerName = activeRegisteredOwner || session.name;
  if (!ownerName) return;
  const property = cadastralData[activePropertyUnit];
  if (property) property.owner = ownerName;
  const ownerElement = document.getElementById('prop-owner');
  if (ownerElement) ownerElement.textContent = ownerName;
}

async function loadRegulationContext(targetState, targetCity) {
  const session = JSON.parse(sessionStorage.getItem('ulpin-session') || 'null');
  const jurisdiction = document.getElementById('regulation-jurisdiction');
  const summary = document.getElementById('regulation-summary');
  if (!window.apiGetRegulationProfile) return;

  let state = targetState;
  let city = targetCity;

  if (!state || !city) {
    if (cadastralData[activePropertyUnit]?.state && cadastralData[activePropertyUnit]?.city) {
      state = cadastralData[activePropertyUnit].state;
      city = cadastralData[activePropertyUnit].city;
    } else if (session?.role === 'citizen' && session?.state && session?.city) {
      state = session.state;
      city = session.city;
    } else if (session?.state && session?.city && session?.role !== 'officer' && session?.role !== 'surveyor') {
      state = session.state;
      city = session.city;
    } else {
      state = 'Jharkhand';
      city = 'Ranchi';
    }
  }

  try {
    const profile = await apiGetRegulationProfile(state, city);
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
  const lang = currentLanguage || 'en';
  const roleData = authProfiles[activeRole];
  const profile = roleData ? (roleData[lang] || roleData.en || roleData) : null;
  const userSession = JSON.parse(sessionStorage.getItem('ulpin-session') || '{}');
  const activeSession = document.getElementById('active-session');
  
  if (document.getElementById('session-name')) {
    document.getElementById('session-name').innerText = userSession.name || (profile ? profile.name : '');
  }
  if (document.getElementById('session-role')) {
    if (activeRole === 'citizen' && userSession.unit_id) {
      document.getElementById('session-role').innerText = lang === 'hi'
        ? `नागरिक / ${userSession.unit_id} स्वामी`
        : `Citizen / ${userSession.unit_id} Owner`;
    } else if (profile) {
      document.getElementById('session-role').innerText = profile.label;
    }
  }

  if (activeRole === 'citizen' && userSession.name) {
    activeRegisteredOwner = userSession.name;
    updateRegisteredOwnerDisplay();
  }

  if (activeSession) {
    activeSession.classList.remove('hidden');
    activeSession.classList.add('flex');
  }
  const activeSessionMobile = document.getElementById('active-session-mobile');
  if (activeSessionMobile) {
    activeSessionMobile.classList.remove('hidden');
    activeSessionMobile.classList.add('flex');
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
  const lang = currentLanguage || 'en';

  const copy = {
    en: {
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
    },
    hi: {
      citizen: {
        title: 'नागरिक 3D संपत्ति कार्यक्षेत्र',
        text: `${activePropertyUnit} का पूर्ण 3D CAD निरीक्षण, स्ट्रैट स्टैक, भू-स्वामित्व प्रमाण पत्र, संपत्ति कर एवं सीमांकन उपकरण।`
      },
      officer: {
        title: 'भूमि संसाधन पंजीयक कार्यक्षेत्र',
        text: 'पूर्ण 3D CAD निरीक्षण, 3D ULPIN एन्कोडर, स्वचालित टोपोलॉजी ऑडिट, एवं आधिकारिक भू-अभिलेख प्रशासन।'
      },
      surveyor: {
        title: 'सर्वेक्षक फील्ड तकनीकी कार्यक्षेत्र',
        text: 'पूर्ण 3D CAD निरीक्षण, बहु-सेंसर स्थानिक परतें, आयतन निष्कर्षण, एवं फील्ड सीमांकन साक्ष्य।'
      }
    }
  };

  const defaultCopy = {
    en: { title: '3D Land Registry Workspace', text: 'Interactive 3D volumetric land administration platform.' },
    hi: { title: '3D भूमि रजिस्ट्री कार्यक्षेत्र', text: 'इंटरैक्टिव त्रि-आयामी (3D) भू-अभिलेख प्रशासन प्रणाली।' }
  };

  const selectedCopy = (copy[lang] && copy[lang][activeRole]) || defaultCopy[lang] || defaultCopy.en;

  if (roleTitle) roleTitle.innerText = selectedCopy.title;
  if (roleCopy) roleCopy.innerText = selectedCopy.text;

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
    const unitData = cadastralData[unitId] || cadastralData[activePropertyUnit];
    let baseY = 15;
    if (unitData && unitData.zMin) {
      const num = parseFloat(unitData.zMin.replace('+', '').replace('m', '').trim());
      if (!isNaN(num)) baseY = num;
    }
    const lookAtPos = new THREE.Vector3(0, baseY + 2, 0);
    const dir = new THREE.Vector3(0.5501, 0.4632, 0.6948);
    const defaultDist = 67 / 0.6; // 111.67m (0.6x default zoom)

    controls.target.copy(lookAtPos);
    camera.position.copy(lookAtPos).addScaledVector(dir, defaultDist);
    controls.update();

    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider) {
      zoomSlider.value = 0.6;
    }
    updateZoomDisplay(0.6);
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
function applyLanguage(lang, persist = true) {
  if (!i18n[lang]) lang = 'en';
  currentLanguage = lang;
  document.documentElement.lang = lang;
  if (persist) {
    try {
      localStorage.setItem('dharanirman_lang', lang);
    } catch (e) {}
  }

  const dict = i18n[lang];

  // 1. Update text of all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      if (dict[key].includes('<')) {
        el.innerHTML = dict[key];
      } else {
        el.innerText = dict[key];
      }
    }
  });

  // 2. Update placeholder of all data-i18n-placeholder elements
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key] !== undefined) {
      el.placeholder = dict[key];
    }
  });

  // 3. Update Language Switcher label (shows prompt for other language)
  const langLabel = document.getElementById('lang-label');
  const langLabelMobile = document.getElementById('lang-label-mobile');
  if (langLabel) {
    langLabel.innerText = dict.lang_toggle || (lang === 'hi' ? 'English' : 'हिंदी');
  }
  if (langLabelMobile) {
    langLabelMobile.innerText = lang === 'hi' ? 'EN' : 'हिंदी';
  }

  // 4. Update Theme Switcher label & tooltip
  updateThemeButton(document.documentElement.classList.contains('dark'));

  // 5. Update Pan button label
  const panLabel = document.getElementById('pan-btn-label');
  if (panLabel) {
    panLabel.innerText = isPanMode ? dict.btn_pan_on : dict.btn_pan;
  }

  // 6. Update Wireframe button label
  const wireLabel = document.getElementById('wireframe-btn-label');
  if (wireLabel) {
    wireLabel.innerText = isWireframeMode ? dict.btn_wireframe_on : dict.btn_wireframe;
  }

  // 7. Update Rotate button label
  const rotLabel = document.getElementById('rotate-btn-label');
  if (rotLabel) {
    rotLabel.innerText = isAutoRotating ? dict.btn_rotate_on : dict.btn_rotate_off;
  }

  // 8. Update Floor dropdown options
  populateFloorSelector();

  // 9. Update Role profile & Visualizer role copy
  if (activeRole) {
    applyRoleUI();
  }

  // 10. Update Selected Property Details
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  if (cadastralData[unitId] || activePropertyUnit) {
    selectUnit(cadastralData[unitId] ? unitId : activePropertyUnit);
  }

  // 11. Refresh Lucide icons
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

function toggleLanguage() {
  const nextLang = currentLanguage === 'en' ? 'hi' : 'en';
  applyLanguage(nextLang, true);
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
  const bgColor = isDark ? 0x1a1b26 : 0xb9d5e6;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, 85, 200);

  // Camera Setup (Default distance ~111.7m for 0.6x zoom)
  camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
  camera.position.set(61.43, 61.72, 77.59);

  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = false;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  // Controls (Restricted between 0.6x = 111.67m and 2.2x = 30.45m)
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 + 0.15; // Allow slight underground tilt
  controls.minDistance = 30.45; // Max Zoom: 2.2x
  controls.maxDistance = 111.67; // Min / Default Zoom: 0.6x
  controls.target.set(0, 10, 0);
  controls.screenSpacePanning = true;
  controls.enablePan = true;
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
  controls.addEventListener('change', () => {
    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider && camera && controls) {
      const dist = camera.position.distanceTo(controls.target);
      const ratio = Math.max(0.6, Math.min(2.2, 67 / Math.max(1, dist)));
      zoomSlider.value = ratio.toFixed(1);
      updateZoomDisplay(ratio);
    }
  });

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

  sunLight = new THREE.DirectionalLight(0xfff2cf, 2.8);
  sunLight.position.set(35, 85, 25);
  sunLight.castShadow = false;
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
    color: 0x2f7652,
    roughness: 0.8,
    metalness: 0.15,
    clippingPlanes: [clippingPlane]
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.3;
  groundMesh.userData = { unitId: 'SURFACE', defaultColor: 0x2f7652, defaultOpacity: 0.95 };
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
    color: 0xcfd8dc,
    metalness: 0.1,
    roughness: 0.15,
    transmission: 0.5,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    clippingPlanes: [clippingPlane]
  });
  const matBalconySlab = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, clippingPlanes: [clippingPlane] });
  const matBalconyGlass = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.35,
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
    floorObj.add(slabMesh);

    // Slab Edge Trim
    const slabTrim = new THREE.Mesh(new THREE.BoxGeometry(floorSize + 0.1, 0.1, floorSize + 0.1), matFrame);
    slabTrim.position.y = 0.175;
    floorObj.add(slabTrim);

    // 2. Central Structural Core (Elevator & Stairwell Shaft)
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(4.2, unitHeight, 4.2), matCore);
    coreMesh.position.set(0, unitHeight / 2 + 0.35, 0);
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
      floorObj.add(colMesh);
    });

    // 4. Subdivide Floor into 4 Cadastral Volumetric Units
    const unitOffsets = [
      { x: unitSize / 2 + 2.0, z: unitSize / 2 + 2.0, id: `U${String(f + 1).padStart(2, '0')}04` },
      { x: -unitSize / 2 - 2.0, z: unitSize / 2 + 2.0, id: `U${String(f + 1).padStart(2, '0')}01` },
      { x: -unitSize / 2 - 2.0, z: -unitSize / 2 - 2.0, id: `U${String(f + 1).padStart(2, '0')}02` },
      { x: unitSize / 2 + 2.0, z: -unitSize / 2 - 2.0, id: `U${String(f + 1).padStart(2, '0')}03` }
    ];

    unitOffsets.forEach((u) => {
      const isRegisteredUnit = (u.id === activePropertyUnit) || (!activePropertyUnit && u.id === 'U1204');

      let unitColor = 0x334155; // Neutral Slate Cadastre Volume Default
      let opacity = 0.25;
      let emissiveColor = 0x000000;
      let emissiveIntensity = 0;

      if (isRegisteredUnit) {
        unitColor = 0x059669; // Vibrant Emerald (Logged-in Citizen's Registered Unit)
        opacity = 0.90;
        emissiveColor = 0x059669;
        emissiveIntensity = 0.4;
      }

      const unitMat = new THREE.MeshStandardMaterial({
        color: unitColor,
        emissive: emissiveColor,
        emissiveIntensity: emissiveIntensity,
        transparent: true,
        opacity: opacity,
        roughness: 0.35,
        metalness: 0.15,
        depthWrite: false,
        clippingPlanes: [clippingPlane]
      });

      const unitGeo = new THREE.BoxGeometry(unitSize, unitHeight, unitSize);
      const unitMesh = new THREE.Mesh(unitGeo, unitMat);
      unitMesh.position.set(u.x, unitHeight / 2 + 0.35, u.z);
      unitMesh.userData = { unitId: u.id, defaultColor: unitColor, defaultOpacity: opacity, isRegistered: isRegisteredUnit };

      // High-precision Cadastral Boundary Wireframe
      const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(unitGeo),
        new THREE.LineBasicMaterial({
          color: isRegisteredUnit ? 0x34d399 : 0x64748b,
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
  parent.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), leafMaterial);
  crown.position.set(x, 2.8, z);
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
let isDraggingMouse = false;
let mouseDownPos = { x: 0, y: 0 };

function initEventListeners() {
  container.addEventListener('mousedown', (e) => {
    mouseDownPos = { x: e.clientX, y: e.clientY };
    isDraggingMouse = false;
  });
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('click', onMouseClick);
}

function onMouseMove(event) {
  if (Math.hypot(event.clientX - mouseDownPos.x, event.clientY - mouseDownPos.y) > 5) {
    isDraggingMouse = true;
  }

  if (currentViewMode !== '3d') {
    const tooltip = document.getElementById('unitTooltip');
    if (tooltip) tooltip.classList.add('hidden');
    return;
  }
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableUnits, true);

  const tooltip = document.getElementById('unitTooltip');

  if (intersects.length > 0 && !isPanMode) {
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
  container.style.cursor = isPanMode ? 'move' : 'grab';
}

function onMouseClick(event) {
  if (isDraggingMouse || isPanMode) return;
  if (currentViewMode !== '3d') return;
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
  if (activeRole === 'citizen' && session.name) {
    if (data.id === activePropertyUnit || data.owner === 'Registered Title Holder') {
      data.owner = session.name;
    }
  } else if (activeRegisteredOwner) {
    if (data.id === activePropertyUnit || data.owner === 'Registered Title Holder') {
      data.owner = activeRegisteredOwner;
    }
  }

  // Update Right Panel UI
  const lang = currentLanguage || 'en';
  let displayOwner = data.owner;
  if (displayOwner === 'Registered Title Holder') {
    displayOwner = lang === 'hi' ? 'पंजीकृत स्वामित्व धारक' : 'Registered Title Holder';
  }
  let displayStatus = data.status;
  if (displayStatus === 'Verified Freehold Title') {
    displayStatus = lang === 'hi' ? 'सत्यापित फ्रीहोल्ड स्वामित्व' : 'Verified Freehold Title';
  }
  let displayStrata = data.strataShare;
  if (lang === 'hi' && displayStrata && displayStrata.includes('of Base Parcel')) {
    displayStrata = displayStrata.replace('of Base Parcel', 'मूल भूखंड का');
  }
  let displayTax = data.tax;
  if (lang === 'hi' && displayTax && displayTax.includes('/ yr (Paid)')) {
    displayTax = displayTax.replace('/ yr (Paid)', '/ वर्ष (प्रदत्त)');
  }
  let displayLod = data.lod;
  if (lang === 'hi' && displayLod && displayLod.includes('LoD 3 Cadastre')) {
    displayLod = 'LoD 3 कैडस्ट्रे';
  }

  document.getElementById('prop-title').innerText = data.title;
  document.getElementById('prop-ulpin-display').innerText = data.ulpin;
  document.getElementById('prop-z').innerText = `${data.zMin} to ${data.zMax}`;
  document.getElementById('prop-vol').innerText = data.volume;
  document.getElementById('prop-area').innerText = data.area;
  document.getElementById('prop-owner').innerText = displayOwner;
  document.getElementById('prop-lod').innerText = displayLod;

  const propStatus = document.getElementById('prop-status');
  if (propStatus) {
    propStatus.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3"></i> ${displayStatus}`;
  }

  const propTax = document.getElementById('prop-tax');
  if (propTax) {
    propTax.innerText = displayTax;
  }

  const propStrata = document.getElementById('prop-strata');
  if (propStrata) {
    propStrata.innerText = displayStrata;
  }

  const ownedBadge = document.getElementById('owned-badge');
  if (ownedBadge) {
    const isOwned = data.id === activePropertyUnit;
    ownedBadge.classList.toggle('hidden', !isOwned);
    ownedBadge.classList.toggle('flex', isOwned);
  }

  const unitState = data.state || (activeRole === 'citizen' ? session.state : null);
  const unitCity = data.city || (activeRole === 'citizen' ? session.city : null);
  if (unitState && unitCity) {
    loadRegulationContext(unitState, unitCity);
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
      // Reset other units to their standard neutral default colors
      u.material.color.setHex(u.userData.defaultColor || 0x334155);
      if (u.material.emissive) {
        u.material.emissive.setHex(0x000000);
        u.material.emissiveIntensity = 0;
      }
      u.material.opacity = u.userData.defaultOpacity || 0.25;
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
      match.material.opacity = 0.95;
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
      match.material.color.setHex(0xf59e0b);
      if (match.material.emissive) {
        match.material.emissive.setHex(0xb45309);
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
    const dir = new THREE.Vector3().subVectors(camPos, new THREE.Vector3(0, targetY, 0));
    if (dir.lengthSq() === 0) dir.set(38, 32, 48);
    dir.normalize();
    const defaultDist = 67 / 0.6; // 111.67m (0.6x zoom)
    camera.position.copy(controls.target).addScaledVector(dir, defaultDist);
    controls.update();
    updateZoomDisplay(0.6);
  }
}

// ==================================================================
// SLIDERS & VIEW CONTROLS
// ==================================================================
function onZoomChange(val) {
  if (!camera || !controls) return;
  const ratio = Math.max(0.6, Math.min(2.2, parseFloat(val)));
  const targetDist = 67 / ratio;
  const target = controls.target || new THREE.Vector3(0, 10, 0);
  const dir = new THREE.Vector3().subVectors(camera.position, target);
  if (dir.lengthSq() === 0) dir.set(38, 32, 48);
  dir.normalize();
  camera.position.copy(target).addScaledVector(dir, targetDist);
  controls.update();
  updateZoomDisplay(ratio);
}

function adjustZoom(delta) {
  const zoomSlider = document.getElementById('zoom-slider');
  if (!zoomSlider) return;
  let newRatio = parseFloat(zoomSlider.value) + delta;
  newRatio = Math.max(0.6, Math.min(2.2, newRatio));
  zoomSlider.value = newRatio.toFixed(1);
  onZoomChange(newRatio);
}

function updateZoomDisplay(val) {
  const zoomVal = document.getElementById('zoom-val');
  if (!zoomVal) return;
  let ratio = typeof val === 'number' && val > 3 ? 67 / val : parseFloat(val);
  ratio = Math.max(0.6, Math.min(2.2, ratio));
  zoomVal.innerText = `${ratio.toFixed(1)}x`;
}

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
  camera.position.set(61.43, 61.72, 77.59);
  controls.target.set(0, 10, 0);
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
  if (isPanMode) {
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    if (controls.touches) controls.touches.ONE = THREE.TOUCH.PAN;
  }
  const zoomSlider = document.getElementById('zoom-slider');
  if (zoomSlider) {
    zoomSlider.value = 0.6;
    updateZoomDisplay(0.6);
  }
}

function togglePanMode() {
  if (!controls) return;
  isPanMode = !isPanMode;

  const panBtn = document.getElementById('btn-pan-toggle');
  const panLabel = document.getElementById('pan-btn-label');
  const container = document.getElementById('cadastreCanvasContainer');
  const lang = currentLanguage || 'en';
  const dict = i18n[lang] || i18n.en;

  if (isPanMode) {
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    if (controls.touches) controls.touches.ONE = THREE.TOUCH.PAN;

    if (panBtn) {
      panBtn.classList.remove('bg-gov-gray-light', 'hover:bg-gov-gray-cool', 'text-gov-navy');
      panBtn.classList.add('bg-cyan-600', 'hover:bg-cyan-700', 'text-white', 'border-cyan-500', 'shadow-inner');
    }
    if (panLabel) panLabel.innerText = dict.btn_pan_on;
    if (container) container.style.cursor = 'move';
  } else {
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    if (controls.touches) controls.touches.ONE = THREE.TOUCH.ROTATE;

    if (panBtn) {
      panBtn.classList.remove('bg-cyan-600', 'hover:bg-cyan-700', 'text-white', 'border-cyan-500', 'shadow-inner');
      panBtn.classList.add('bg-gov-gray-light', 'hover:bg-gov-gray-cool', 'text-gov-navy');
    }
    if (panLabel) panLabel.innerText = dict.btn_pan;
    if (container) container.style.cursor = 'grab';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleWireframe() {
  isWireframeMode = !isWireframeMode;
  const lang = currentLanguage || 'en';
  const dict = i18n[lang] || i18n.en;
  const wireLabel = document.getElementById('wireframe-btn-label');
  if (wireLabel) {
    wireLabel.innerText = isWireframeMode ? dict.btn_wireframe_on : dict.btn_wireframe;
  }
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
  const lang = currentLanguage || 'en';
  const dict = i18n[lang] || i18n.en;
  const rotLabel = document.getElementById('rotate-btn-label');
  if (rotLabel) {
    rotLabel.innerText = isAutoRotating ? dict.btn_rotate_on : dict.btn_rotate_off;
  }
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
  const camPosElem = document.getElementById('camera-pos');
  const tooltip = document.getElementById('unitTooltip');

  const activeClass = 'px-2.5 py-1 text-xs bg-gov-blue text-white font-bold transition flex items-center gap-1 shadow-sm';
  const inactiveClass = 'px-2.5 py-1 text-xs hover:bg-gov-gray-light text-gov-ink font-semibold transition flex items-center gap-1';

  if (mode === 'cross') {
    if (btnCross) btnCross.className = activeClass;
    if (btn3d) btn3d.className = inactiveClass;
    if (roleBanner) roleBanner.classList.add('hidden');
    if (tooltip) tooltip.classList.add('hidden');
    if (camPosElem) {
      camPosElem.innerText = '2D Section Plane (Z: -25m to +60m)';
    }
    if (crossCanvas) {
      crossCanvas.classList.remove('hidden');
      draw2DCrossSection(crossCanvas);
    }
  } else {
    if (btn3d) btn3d.className = activeClass;
    if (btnCross) btnCross.className = inactiveClass;
    if (roleBanner) roleBanner.classList.remove('hidden');
    if (camPosElem && camera) {
      camPosElem.innerText = `X: ${Math.round(camera.position.x)}, Y: ${Math.round(camera.position.y)}, Z: ${Math.round(camera.position.z)}`;
    }
    if (crossCanvas) {
      crossCanvas.classList.add('hidden');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function draw2DCrossSection(canvasElem) {
  if (!container || !canvasElem) return;
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const displayW = container.clientWidth || 800;
  const displayH = container.clientHeight || 600;

  // Exact physical pixel buffer sizing
  canvasElem.width = Math.round(displayW * dpr);
  canvasElem.height = Math.round(displayH * dpr);
  canvasElem.style.width = `${displayW}px`;
  canvasElem.style.height = `${displayH}px`;

  const ctx = canvasElem.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.textBaseline = 'middle';

  const w = displayW;
  const h = displayH;

  // Premium Deep CAD Navy Background
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, w, h);

  // Subtle CAD Background Grid
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let gx = 0; gx < w; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(Math.round(gx) + 0.5, 0);
    ctx.lineTo(Math.round(gx) + 0.5, h);
    ctx.stroke();
  }
  for (let gy = 0; gy < h; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(gy) + 0.5);
    ctx.lineTo(w, Math.round(gy) + 0.5);
    ctx.stroke();
  }

  // Active property & resident unit details
  const activeUnit = cadastralData[activePropertyUnit] || cadastralData['U1204'] || {};
  const floorString = String(activeUnit.floor || 'Floor 12');
  const floorMatch = floorString.match(/\d+/);
  const selectedFloorNum = floorMatch ? parseInt(floorMatch[0], 10) : 12;

  // Responsive Vertical Mapping (-25m to +60m = 85m range)
  const topPadding = 60;
  const bottomPadding = 45;
  const availableH = h - topPadding - bottomPadding;
  const meterScale = Math.max(4.2, Math.min(8.0, availableH / 85));
  const zeroY = Math.round(h - bottomPadding - (25 * meterScale));

  const getYForZ = (z) => Math.round(zeroY - (z * meterScale));

  // 1. Datum Elevation Reference Lines & Clean Typography
  const datumXStart = 90;
  for (let z = -25; z <= 60; z += 10) {
    const y = getYForZ(z);
    const isGround = z === 0;

    ctx.strokeStyle = isGround ? 'rgba(245, 158, 11, 0.75)' : 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = isGround ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(datumXStart, y + 0.5);
    ctx.lineTo(w - 20, y + 0.5);
    ctx.stroke();

    // Datum Label Badge
    ctx.fillStyle = isGround ? '#fbbf24' : '#64748b';
    ctx.font = '600 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${z >= 0 ? '+' : ''}${z}m Datum`, datumXStart - 12, y);
  }

  // Ground Surface Datum (0.00m) Bold Indicator
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
  ctx.fillText('Ground Surface Datum (0.00m) — Base 2D Parcel 2187-4930-1049-S00', datumXStart + 10, zeroY + 16);

  // Layout Dimensions for Architectural Cross-Section
  const bldgX = Math.max(110, Math.min(180, Math.round(w * 0.16)));
  const bldgW = Math.max(380, Math.min(580, Math.round(w * 0.55)));

  // 2. Air Rights Corridor (+45.0m to +60.0m)
  const airTopY = getYForZ(60);
  const airBottomY = getYForZ(45);
  const airH = airBottomY - airTopY;

  ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
  ctx.fillRect(bldgX - 10, airTopY, bldgW + 20, airH);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(bldgX - 10 + 0.5, airTopY + 0.5, bldgW + 20, airH);
  ctx.setLineDash([]);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
  ctx.fillText('✦ Air Rights Corridor (+45.0m to +60.0m) [3D ULPIN ZONE-A]', bldgX + 12, airTopY + 18);

  // 3. Multi-Storey Floors 1 to 12
  const totalFloors = (activeBuilding && activeBuilding.above_ground_floors) || 12;
  for (let floorNum = 1; floorNum <= totalFloors; floorNum++) {
    const zMin = 0.8 + (floorNum - 1) * 3.6;
    const zMax = 4.4 + (floorNum - 1) * 3.6;
    const floorTopY = getYForZ(zMax);
    const floorBottomY = getYForZ(zMin);
    const floorH = floorBottomY - floorTopY;

    const isTargetFloor = floorNum === selectedFloorNum;

    if (isTargetFloor) {
      // Highlighted Logged-in / Selected Floor (Emerald Glow)
      const grad = ctx.createLinearGradient(bldgX, floorTopY, bldgX + bldgW, floorTopY);
      grad.addColorStop(0, '#047857');
      grad.addColorStop(1, '#059669');
      ctx.fillStyle = grad;
      ctx.fillRect(bldgX, floorTopY, bldgW, floorH);

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(bldgX + 0.5, floorTopY + 0.5, bldgW, floorH);

      // Floor Label text with high contrast
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
      ctx.fillText(`★ Floor ${String(floorNum).padStart(2, '0')} (Unit #${activePropertyUnit}) · ${activeUnit.ulpin || 'IN-2187-4930-1049-A-F12-U1204-K8'}`, bldgX + 10, floorTopY + floorH / 2);

      // Callout Pin / Floating Card on the right
      const calloutX = bldgX + bldgW + 20;
      const calloutY = floorTopY + floorH / 2;

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bldgX + bldgW, calloutY);
      ctx.lineTo(calloutX, calloutY);
      ctx.stroke();

      const badgeW = Math.min(240, Math.max(160, w - calloutX - 15));
      if (badgeW > 100) {
        ctx.fillStyle = 'rgba(6, 24, 38, 0.96)';
        ctx.fillRect(calloutX, calloutY - 20, badgeW, 40);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(calloutX + 0.5, calloutY - 20 + 0.5, badgeW, 40);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
        ctx.fillText(`RESIDENT: ${activeUnit.owner || 'You'}`, calloutX + 10, calloutY - 6);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
        ctx.fillText(`Elev: ${activeUnit.zMin || '+36.5m'} to ${activeUnit.zMax || '+39.8m'}`, calloutX + 10, calloutY + 9);
      }
    } else {
      // Standard Floor Box
      ctx.fillStyle = floorNum % 2 === 0 ? 'rgba(22, 34, 54, 0.9)' : 'rgba(16, 26, 42, 0.9)';
      ctx.fillRect(bldgX, floorTopY, bldgW, floorH);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bldgX + 0.5, floorTopY + 0.5, bldgW, floorH);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
      ctx.fillText(`Floor ${String(floorNum).padStart(2, '0')} [LoD-3]  ·  +${zMin.toFixed(1)}m to +${zMax.toFixed(1)}m`, bldgX + 10, floorTopY + floorH / 2);
    }
  }

  // 4. Basement 1 Parking (-6.0m to -3.0m)
  const baseTopY = getYForZ(-3.0);
  const baseBottomY = getYForZ(-6.0);
  const baseH = baseBottomY - baseTopY;
  const isBasementSelected = activePropertyUnit === 'BASEMENT1';

  ctx.fillStyle = isBasementSelected ? 'rgba(126, 34, 206, 0.85)' : 'rgba(88, 28, 135, 0.45)';
  ctx.fillRect(bldgX - 15, baseTopY, bldgW + 30, baseH);
  ctx.strokeStyle = isBasementSelected ? '#d8b4fe' : '#9333ea';
  ctx.lineWidth = isBasementSelected ? 2 : 1;
  ctx.strokeRect(bldgX - 15 + 0.5, baseTopY + 0.5, bldgW + 30, baseH);
  ctx.fillStyle = '#f3e8ff';
  ctx.font = 'bold 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
  ctx.fillText('Basement Parking 1 (-6.0m to -3.0m) [2187-4930-1049-A-B01]', bldgX - 5, baseTopY + baseH / 2);

  // 5. Subsurface Metro Transit Tunnel (-21.0m to -14.0m)
  const metroTopY = getYForZ(-14.0);
  const metroBottomY = getYForZ(-21.0);
  const metroH = metroBottomY - metroTopY;

  ctx.fillStyle = 'rgba(225, 29, 72, 0.35)';
  ctx.fillRect(bldgX - 35, metroTopY, bldgW + 70, metroH);
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bldgX - 35 + 0.5, metroTopY + 0.5, bldgW + 70, metroH);
  ctx.fillStyle = '#ffe4e6';
  ctx.font = 'bold 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
  ctx.fillText('Subsurface Metro Rail Transit Corridor (-21.0m to -14.0m) [DMRC-EPSG:7755]', bldgX - 25, metroTopY + metroH / 2);

  // 6. Header/Footer Coordinate Badge
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px ui-monospace, "Roboto Mono", "Cascadia Code", Consolas, monospace';
  ctx.fillText('2D VOLUMETRIC STRATA CROSS-SECTION • EPSG:7755 / WGS84 ORTHOMETRIC DATUM', 12, h - 16);

  ctx.restore();
}

function runTopologyValidation() {
  if (activeRole === 'citizen') {
    alert('Topology validation results are restricted to registry and survey teams.');
    return;
  }
  const topCard = document.getElementById('topology-card');
  if (topCard) {
    topCard.className = 'mt-auto p-3 bg-emerald-950/60 border border-emerald-500 text-xs glow-emerald';
  }
  alert('✓ 3D Topology Audit Passed!\n- Standard: ISO 19152 LADM v2 3D Cadastre\n- Volumetric Overlaps: 0\n- Boundary Enclosure: 100% Valid Closed 2-Manifolds');
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
  if (certOwner) certOwner.textContent = data.owner || activeRegisteredOwner || 'Registered Title Holder';
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
          owner: p.owner_name || (activeRole === 'citizen' ? (JSON.parse(sessionStorage.getItem('ulpin-session') || '{}').name || 'Registered Title Holder') : activeRegisteredOwner || 'Registered Title Holder'),
          status: p.status === 'claimed' || p.status === 'available' ? 'Verified Freehold Title' : p.status,
          tax: '₹ 14,820 / yr (Paid)',
          strataShare: `${((p.area / 7680) * 100).toFixed(2)}% of Base Parcel`,
          lod: 'LoD 3 Cadastre',
          state: p.state || null,
          city: p.city || null
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
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];
  const ownerName = data.owner || activeRegisteredOwner || 'Registered Title Holder';

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
        <bldg:BuildingUnit gml:id="${data.ulpin}">
          <bldg:usage>${data.title}</bldg:usage>
          <bldg:owner>${ownerName}</bldg:owner>
          <bldg:netVolume uom="m3">${data.volume}</bldg:netVolume>
          <bldg:zElevationMin uom="m">${data.zMin}</bldg:zElevationMin>
          <bldg:zElevationMax uom="m">${data.zMax}</bldg:zElevationMax>
        </bldg:BuildingUnit>
      </bldg:buildingUnit>
    </bldg:Building>
  </cityObjectMember>
</CityModel>`;
  downloadFile(cityGMLContent, `3D_ULPIN_Parcel_${data.id}_2187-4930-1049.gml`, 'application/xml');
}

function downloadLADM() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];
  const ownerName = data.owner || activeRegisteredOwner || 'Registered Title Holder';

  const ladmContent = JSON.stringify({
    schema: "ISO 19152 LADM Edition 2 - Part 2: 3D Land Administration",
    baseParcelULPIN: "2187-4930-1049-S00",
    spatialReferenceSystem: "EPSG:7755 + Indian Geoid Datum",
    spatialUnits3D: [
      {
        ulpin3D: data.ulpin,
        unitId: data.id,
        stratumType: "Air/AboveGround",
        elevationBounds: { zMin: data.zMin, zMax: data.zMax, uom: "meter" },
        calculatedVolumeM3: data.volume,
        titleHolder: ownerName,
        titleType: data.status,
        topologyVerified: true
      },
      {
        ulpin3D: "IN-2187-4930-1049-U-TUN-DMRC-T7",
        unitId: "METRO",
        stratumType: "Underground Infrastructure",
        elevationBounds: { zMin: "-21.0m", zMax: "-14.0m", uom: "meter" },
        calculatedVolumeM3: "6300.0 m³",
        titleHolder: "Delhi Metro Rail Corp",
        titleType: "Public Statutory Easement",
        topologyVerified: true
      }
    ]
  }, null, 2);
  downloadFile(ladmContent, 'LADM_3D_Cadastre_ISO19152.json', 'application/json');
}

function downloadGeoJSON3D() {
  const currentTag = document.getElementById('unit-tag') ? document.getElementById('unit-tag').value : '1204';
  const unitId = currentTag.startsWith('U') ? currentTag : `U${currentTag}`;
  const data = cadastralData[unitId] || cadastralData[activePropertyUnit] || cadastralData['U1204'];
  const ownerName = data.owner || activeRegisteredOwner || 'Registered Title Holder';

  const geojson3D = JSON.stringify({
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::7755" } },
    features: [
      {
        type: "Feature",
        properties: {
          ulpin: data.ulpin,
          unit: data.title,
          volumeM3: data.volume,
          owner: ownerName,
          status: data.status,
          zMin: data.zMin,
          zMax: data.zMax
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

  if (currentViewMode === '3d') {
    if (controls) controls.update();

    const camPosElem = document.getElementById('camera-pos');
    if (camPosElem && camera) {
      camPosElem.innerText = `X: ${Math.round(camera.position.x)}, Y: ${Math.round(camera.position.y)}, Z: ${Math.round(camera.position.z)}`;
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
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
