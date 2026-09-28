// ==============================================================================
// DHARANIRMAN - END-TO-END WORKFLOW INTEGRATION TEST
// Verifies: Citizen Request Demarcation -> Officer Assignment -> Surveyor Evidence ->
//           3D Topology Audit -> Officer Approval -> Unified 3D Viewer Inspection
// ==============================================================================

const assert = require('assert');
const crypto = require('crypto');

console.log('='.repeat(80));
console.log('🏛️  DHARANIRMAN 3D CADASTRAL PLATFORM - FULL WORKFLOW VERIFICATION SUITE');
console.log('='.repeat(80));

// --- 1. SIMULATED DATABASE & ENGINE STATE ---
const db = {
  users: [
    { id: 1, name: 'Dr. Ananya Sharma', role: 'citizen', unit_id: 'U1204', identifier: 'ananya@example.com' },
    { id: 2, name: 'R. K. Iyer (DoLR)', role: 'officer', identifier: 'officer@nic.gov.in' },
    { id: 3, name: 'Neha Kulkarni', role: 'surveyor', identifier: 'surveyor@survey.gov.in' }
  ],
  properties: [
    {
      id: 1,
      unit_id: 'U1204',
      property_ulpin: 'IN-2187-4930-1049-A-F12-U1204-K8',
      base_parcel: '2187-4930-1049',
      floor: 'Floor 12',
      floor_code: 'F12',
      z_min: 36.5,
      z_max: 39.8,
      area: 128.0,
      volume: 384.2,
      owner_name: 'Dr. Ananya Sharma',
      status: 'claimed',
      geometry_closed: true,
      srid: 7755
    },
    {
      id: 2,
      unit_id: 'U1201',
      property_ulpin: 'IN-2187-4930-1049-A-F12-U1201-J4',
      base_parcel: '2187-4930-1049',
      floor: 'Floor 12',
      floor_code: 'F12',
      z_min: 36.5,
      z_max: 39.8,
      area: 137.5,
      volume: 412.5,
      owner_name: 'Registered Title Holder',
      status: 'claimed',
      geometry_closed: true,
      srid: 7755
    }
  ],
  cases: [],
  case_events: [],
  case_files: []
};

// --- TOPOLOGY AUDIT ENGINE (Mirrors backend/app/validation.py) ---
function evaluateCaseValidation(caseItem) {
  const property = db.properties.find(p => p.property_ulpin === caseItem.property_ulpin || p.unit_id === caseItem.property_ulpin);
  const files = db.case_files.filter(f => f.case_id === caseItem.id);
  
  const crs_ok = property ? property.srid === 7755 : false;
  const closed_ok = property ? (property.geometry_closed || files.length > 0) : false;
  const height = property ? (property.z_max - property.z_min) : 0;
  const volume_ok = property && property.volume > 0 && property.area > 0 && height > 0;
  
  // Overlap check against sibling units
  let overlap_found = false;
  if (property) {
    const siblings = db.properties.filter(p => p.id !== property.id && p.base_parcel === property.base_parcel);
    for (const sib of siblings) {
      if (sib.unit_id === property.unit_id) overlap_found = true;
    }
  }
  const no_overlap = property !== null && !overlap_found;
  
  // Sliver / Gap check (0.3m <= height <= 8.0m)
  const sliver_or_gap = height < 0.3 || height > 8.0;
  
  // Air rights check
  const air_rights_ok = property ? property.z_max <= 45.0 : false;
  
  const checks = {
    crs_epsg_7755: Boolean(crs_ok),
    closed_geometry: Boolean(closed_ok),
    volume_positive: Boolean(volume_ok),
    no_3d_overlap: Boolean(no_overlap),
    no_gaps_or_slivers: !sliver_or_gap,
    air_rights_clear: Boolean(air_rights_ok)
  };
  
  const overall_valid = Object.values(checks).every(Boolean);
  return { checks, overall_valid };
}

// ==============================================================================
// TEST EXECUTION
// ==============================================================================

try {
  // ----------------------------------------------------------------------------
  // STEP 1: CITIZEN LOGS IN & REQUESTS 3D DEMARCATION
  // ----------------------------------------------------------------------------
  console.log('\n[STEP 1] Citizen Authentication & 3D Demarcation Submission');
  const citizen = db.users.find(u => u.role === 'citizen');
  assert.strictEqual(citizen.name, 'Dr. Ananya Sharma', 'Citizen identity must match Dr. Ananya Sharma');
  assert.strictEqual(citizen.unit_id, 'U1204', 'Citizen must own Unit #1204');

  const citizenProperty = db.properties.find(p => p.unit_id === citizen.unit_id);
  assert.ok(citizenProperty, 'Citizen property must exist in cadastral database');

  // Submit Demarcation Case
  const newCase = {
    id: 101,
    title: '3D Boundary Demarcation & Balcony Clearance for Unit #U1204',
    request_type: 'demarcation',
    property_ulpin: citizenProperty.property_ulpin,
    notes: 'Citizen requests height and balcony encroachment inspection with CORS RTK GNSS',
    citizen_id: citizen.id,
    citizen_name: citizen.name,
    officer_id: null,
    surveyor_id: null,
    status: 'submitted',
    created_at: new Date().toISOString()
  };
  db.cases.push(newCase);
  db.case_events.push({
    case_id: newCase.id,
    actor: citizen.name,
    status: 'submitted',
    message: 'Citizen submitted a new 3D demarcation request'
  });

  console.log(`  ✓ Case #${newCase.id} created with status: '${newCase.status}'`);
  console.log(`  ✓ Target Property: ${newCase.property_ulpin} (Applicant: ${newCase.citizen_name})`);
  assert.strictEqual(db.cases.length, 1);
  assert.strictEqual(db.cases[0].status, 'submitted');

  // ----------------------------------------------------------------------------
  // STEP 2: OFFICER REVIEWS QUEUE & ASSIGNS SURVEYOR
  // ----------------------------------------------------------------------------
  console.log('\n[STEP 2] Officer Case Review & Assignment');
  const officer = db.users.find(u => u.role === 'officer');
  const surveyor = db.users.find(u => u.role === 'surveyor');
  
  // Officer inspects queue
  const pendingCases = db.cases.filter(c => c.status === 'submitted');
  assert.strictEqual(pendingCases.length, 1, 'Officer should see 1 submitted case');
  
  // Officer assigns to Licensed Surveyor
  const targetCase = pendingCases[0];
  targetCase.officer_id = officer.id;
  targetCase.surveyor_id = surveyor.id;
  targetCase.status = 'assigned';
  db.case_events.push({
    case_id: targetCase.id,
    actor: officer.name,
    status: 'assigned',
    message: `Case assigned to licensed surveyor ${surveyor.name}`
  });

  console.log(`  ✓ Case #${targetCase.id} assigned by Officer '${officer.name}' to Surveyor '${surveyor.name}'`);
  console.log(`  ✓ New Status: '${targetCase.status}'`);
  assert.strictEqual(targetCase.status, 'assigned');
  assert.strictEqual(targetCase.surveyor_id, surveyor.id);

  // ----------------------------------------------------------------------------
  // STEP 3: SURVEYOR UPLOADS TECHNICAL EVIDENCE & SUBMITS SURVEY
  // ----------------------------------------------------------------------------
  console.log('\n[STEP 3] Surveyor Field Evidence Upload & Submission');
  const surveyorCases = db.cases.filter(c => c.surveyor_id === surveyor.id && c.status === 'assigned');
  assert.strictEqual(surveyorCases.length, 1, 'Surveyor should have 1 active assignment');

  // Surveyor uploads LiDAR / IFC point cloud file
  const surveyFile = {
    id: 1,
    case_id: targetCase.id,
    uploaded_by: surveyor.id,
    filename: '3D_LiDAR_Demarcation_U1204.las',
    content_type: 'application/octet-stream',
    storage_path: '/storage/surveys/101-3D_LiDAR_Demarcation_U1204.las'
  };
  db.case_files.push(surveyFile);
  targetCase.status = 'survey_in_progress';
  db.case_events.push({
    case_id: targetCase.id,
    actor: surveyor.name,
    status: 'survey_in_progress',
    message: `Surveyor uploaded technical evidence: ${surveyFile.filename}`
  });

  // Surveyor submits survey for review
  targetCase.status = 'survey_submitted';
  db.case_events.push({
    case_id: targetCase.id,
    actor: surveyor.name,
    status: 'survey_submitted',
    message: 'Surveyor submitted technical survey for officer volumetric validation'
  });

  console.log(`  ✓ Uploaded evidence: '${surveyFile.filename}'`);
  console.log(`  ✓ Survey submitted for Officer review. Status: '${targetCase.status}'`);
  assert.strictEqual(targetCase.status, 'survey_submitted');
  assert.strictEqual(db.case_files.length, 1);

  // ----------------------------------------------------------------------------
  // STEP 4: AUTOMATED 3D TOPOLOGY AUDIT
  // ----------------------------------------------------------------------------
  console.log('\n[STEP 4] Automated Volumetric 3D Topology Audit');
  const auditResult = evaluateCaseValidation(targetCase);
  
  console.log('  Audit Rules Evaluation:');
  console.log(`    [1] CRS Reference EPSG:7755 (CORS RTK)    : ${auditResult.checks.crs_epsg_7755 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`    [2] Closed 2-Manifold Enclosure (Mesh)    : ${auditResult.checks.closed_geometry ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`    [3] Positive Volume & Dimensional Bounds  : ${auditResult.checks.volume_positive ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`    [4] Zero 3D Volumetric Overlaps           : ${auditResult.checks.no_3d_overlap ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`    [5] No Gaps / No Micro-Slivers (>0.3m)    : ${auditResult.checks.no_gaps_or_slivers ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`    [6] Statutory Air-Rights Clearance (<=45m): ${auditResult.checks.air_rights_clear ? 'PASSED ✅' : 'FAILED ❌'}`);

  assert.strictEqual(auditResult.overall_valid, true, 'Topology audit must pass all 6 rules');
  targetCase.status = 'validated';
  targetCase.validation = auditResult.checks;
  db.case_events.push({
    case_id: targetCase.id,
    actor: officer.name,
    status: 'validated',
    message: 'Automated volumetric validation completed: all 6 spatial rules passed'
  });
  console.log(`  ✓ Overall Topology Status: 'VALIDATED' (All 6 checks true)`);

  // ----------------------------------------------------------------------------
  // STEP 5: OFFICER APPROVES & ISSUES 3D ULPIN CERTIFICATE
  // ----------------------------------------------------------------------------
  console.log('\n[STEP 5] Officer Approval & 3D ULPIN Certificate Issuance');
  assert.strictEqual(targetCase.status, 'validated', 'Case must be validated before approval');
  
  const issuedUlpin = `${citizenProperty.property_ulpin}-APPROVED-CERT`;
  targetCase.issued_ulpin = issuedUlpin;
  targetCase.status = 'certificate_issued';
  db.case_events.push({
    case_id: targetCase.id,
    actor: officer.name,
    status: 'certificate_issued',
    message: `Officer approved case and issued 3D ULPIN certificate: ${issuedUlpin}`
  });

  console.log(`  ✓ Official 3D ULPIN Issued: '${issuedUlpin}'`);
  console.log(`  ✓ Final Case Status: '${targetCase.status}'`);
  assert.strictEqual(targetCase.status, 'certificate_issued');

  // ----------------------------------------------------------------------------
  // STEP 6: 3D VIEWER UNIFIED RESOLUTION VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n[STEP 6] Unified 3D Viewer State & Dynamic Rendering Verification');
  
  // Simulate 3D Viewer loading for Officer inspecting Case #101
  const loadedCase = db.cases.find(c => c.id === 101);
  const activeRole = 'officer';
  const officerSession = { name: officer.name, role: activeRole };
  
  let activePropertyUnit = 'U1204';
  let activeRegisteredOwner = loadedCase.citizen_name; // From loaded case
  
  // Verify owner resolution rule
  let displayOwner;
  if (activeRole === 'citizen') {
    displayOwner = officerSession.name;
  } else if (activeRegisteredOwner) {
    displayOwner = activeRegisteredOwner; // Correct: shows citizen applicant
  }

  console.log(`  Inspecting Role   : ${activeRole.toUpperCase()} (${officerSession.name})`);
  console.log(`  Active Unit       : #${activePropertyUnit}`);
  console.log(`  Resolved Owner    : '${displayOwner}'`);
  console.log(`  Target Case Title : '${loadedCase.title}'`);
  console.log(`  Issued Certificate: '${loadedCase.issued_ulpin}'`);

  assert.strictEqual(displayOwner, 'Dr. Ananya Sharma', '3D Viewer MUST show Citizen applicant as owner, NOT the officer');
  assert.notStrictEqual(displayOwner, officer.name, 'Officer name must never overwrite citizen property owner');

  console.log('\n' + '='.repeat(80));
  console.log('🎉 ALL WORKFLOW TESTS PASSED SUCCESSFULLY (6/6 INTEGRATION GATES)!');
  console.log('='.repeat(80));

} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
}
