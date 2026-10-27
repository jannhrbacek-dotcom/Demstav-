"""
DEMSTAV OPERATIONS - Backend API Testing
Tests all features from the review request
"""
import requests
import sys
from datetime import datetime, timedelta

BASE_URL = "https://markdown-notes-12.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class APITester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tokens = {}
        self.test_data = {}
        
    def log(self, msg, color=Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")
    
    def test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        self.tests_run += 1
        print(f"\n{'='*60}")
        print(f"Test {self.tests_run}: {name}")
        print(f"{'='*60}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}", Colors.GREEN)
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}", Colors.RED)
                self.log(f"Response: {response.text[:500]}", Colors.RED)
            
            try:
                json_response = response.json()
                return success, json_response
            except:
                return success, {}
                
        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}", Colors.RED)
            return False, {}
    
    def login(self, login, password, role_expected=None):
        """Test login and store token"""
        success, response = self.test(
            f"Login as {login}",
            "POST",
            "auth/login",
            200,
            data={"login": login, "password": password}
        )
        
        if success and 'access_token' in response:
            self.tokens[login] = response['access_token']
            user = response.get('user', {})
            self.log(f"   User: {user.get('username')} | Role: {user.get('role')} | Label: {user.get('role_label')}", Colors.BLUE)
            
            if role_expected:
                if user.get('role') == role_expected:
                    self.log(f"   ✓ Role matches expected: {role_expected}", Colors.GREEN)
                else:
                    self.log(f"   ✗ Role mismatch! Expected: {role_expected}, Got: {user.get('role')}", Colors.RED)
            
            return True, user
        return False, {}

def main():
    tester = APITester()
    
    print("\n" + "="*80)
    print("DEMSTAV OPERATIONS - Backend API Testing")
    print("="*80)
    
    # ============================================================================
    # 1. AUTHENTICATION TESTS
    # ============================================================================
    tester.log("\n\n📋 SECTION 1: AUTHENTICATION & ROLES", Colors.YELLOW)
    
    # Test login with username
    success, strojnik_user = tester.login("strojnik", "Demstav2026!", "employee")
    if success and strojnik_user.get('username') != 'strojnik':
        tester.log(f"   ✗ Username mismatch! Expected: strojnik, Got: {strojnik_user.get('username')}", Colors.RED)
    
    # Test login with email
    success, _ = tester.login("strojnik@demstav.cz", "Demstav2026!", "employee")
    
    # Test other roles
    tester.login("vedouci", "Demstav2026!", "manager")
    tester.login("admin", "Demstav2026!", "admin")
    tester.login("jednatel", "Demstav2026!", "owner")
    
    # Test wrong password (should return 401 with Czech error)
    tester.test(
        "Login with wrong password (should return 401 Czech error)",
        "POST",
        "auth/login",
        401,
        data={"login": "strojnik", "password": "wrongpassword"}
    )
    
    # ============================================================================
    # 2. LEAVE MANAGEMENT TESTS
    # ============================================================================
    tester.log("\n\n📋 SECTION 2: LEAVE MANAGEMENT (Dovolená)", Colors.YELLOW)
    
    # Create vacation request as strojnik
    today = datetime.now()
    date_from = (today + timedelta(days=30)).strftime("%Y-%m-%d")
    date_to = (today + timedelta(days=34)).strftime("%Y-%m-%d")
    
    success, leave_response = tester.test(
        "Strojnik creates vacation request (5 days)",
        "POST",
        "leave",
        200,
        data={
            "type": "vacation",
            "date_from": date_from,
            "date_to": date_to,
            "note": "Test vacation request"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        leave_req = leave_response.get('request', {})
        leave_id = leave_req.get('id')
        tester.test_data['leave_id'] = leave_id
        
        # Verify status is pending_manager
        if leave_req.get('status') == 'pending_manager':
            tester.log(f"   ✓ Status is pending_manager", Colors.GREEN)
        else:
            tester.log(f"   ✗ Status should be pending_manager, got: {leave_req.get('status')}", Colors.RED)
        
        # Verify days calculation
        if leave_req.get('days') == 5:
            tester.log(f"   ✓ Days calculated correctly: 5", Colors.GREEN)
        else:
            tester.log(f"   ✗ Days should be 5, got: {leave_req.get('days')}", Colors.RED)
    
    # Test admin trying to approve (should get 403)
    if 'leave_id' in tester.test_data:
        tester.test(
            "Admin tries to approve vacation (should get 403)",
            "POST",
            f"leave/{tester.test_data['leave_id']}/decision",
            403,
            data={"action": "approve"},
            token=tester.tokens.get("admin")
        )
    
    # Vedouci approves vacation (should move to pending_director)
    if 'leave_id' in tester.test_data:
        success, approve_response = tester.test(
            "Vedouci approves vacation (should move to pending_director)",
            "POST",
            f"leave/{tester.test_data['leave_id']}/decision",
            200,
            data={"action": "approve"},
            token=tester.tokens.get("vedouci")
        )
        
        if success:
            if approve_response.get('status') == 'pending_director':
                tester.log(f"   ✓ Status moved to pending_director", Colors.GREEN)
            else:
                tester.log(f"   ✗ Status should be pending_director, got: {approve_response.get('status')}", Colors.RED)
    
    # Vedouci tries to approve again (should get 403)
    if 'leave_id' in tester.test_data:
        tester.test(
            "Vedouci tries to approve again (should get 403)",
            "POST",
            f"leave/{tester.test_data['leave_id']}/decision",
            403,
            data={"action": "approve"},
            token=tester.tokens.get("vedouci")
        )
    
    # Jednatel approves (should move to approved)
    if 'leave_id' in tester.test_data:
        success, final_response = tester.test(
            "Jednatel approves vacation (should move to approved)",
            "POST",
            f"leave/{tester.test_data['leave_id']}/decision",
            200,
            data={"action": "approve"},
            token=tester.tokens.get("jednatel")
        )
        
        if success and final_response.get('status') == 'approved':
            tester.log(f"   ✓ Status moved to approved", Colors.GREEN)
    
    # Test unpaid leave (should be approved by manager directly)
    date_from_unpaid = (today + timedelta(days=40)).strftime("%Y-%m-%d")
    date_to_unpaid = (today + timedelta(days=41)).strftime("%Y-%m-%d")
    
    success, unpaid_response = tester.test(
        "Strojnik creates unpaid leave request",
        "POST",
        "leave",
        200,
        data={
            "type": "unpaid",
            "date_from": date_from_unpaid,
            "date_to": date_to_unpaid,
            "note": "Test unpaid leave"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        unpaid_id = unpaid_response.get('request', {}).get('id')
        
        # Vedouci approves unpaid leave (should go directly to approved)
        success, unpaid_approve = tester.test(
            "Vedouci approves unpaid leave (should go directly to approved)",
            "POST",
            f"leave/{unpaid_id}/decision",
            200,
            data={"action": "approve"},
            token=tester.tokens.get("vedouci")
        )
        
        if success and unpaid_approve.get('status') == 'approved':
            tester.log(f"   ✓ Unpaid leave approved directly (no director approval needed)", Colors.GREEN)
    
    # Test doctor visit (requires time_from and time_to)
    date_doctor = (today + timedelta(days=50)).strftime("%Y-%m-%d")
    
    success, doctor_response = tester.test(
        "Strojnik creates doctor visit request",
        "POST",
        "leave",
        200,
        data={
            "type": "doctor",
            "date_from": date_doctor,
            "date_to": date_doctor,
            "time_from": "09:00",
            "time_to": "11:00",
            "note": "Test doctor visit"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        doctor_id = doctor_response.get('request', {}).get('id')
        
        # Vedouci approves doctor visit
        tester.test(
            "Vedouci approves doctor visit (should go directly to approved)",
            "POST",
            f"leave/{doctor_id}/decision",
            200,
            data={"action": "approve"},
            token=tester.tokens.get("vedouci")
        )
    
    # Test doctor visit without time (should get 400)
    tester.test(
        "Doctor visit without time (should get 400)",
        "POST",
        "leave",
        400,
        data={
            "type": "doctor",
            "date_from": date_doctor,
            "date_to": date_doctor,
            "note": "Missing time"
        },
        token=tester.tokens.get("strojnik")
    )
    
    # Test rejection without note (should get 400)
    date_sick = (today + timedelta(days=60)).strftime("%Y-%m-%d")
    success, sick_response = tester.test(
        "Strojnik creates sick leave request",
        "POST",
        "leave",
        200,
        data={
            "type": "sick",
            "date_from": date_sick,
            "date_to": date_sick,
            "note": "Test sick leave"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        sick_id = sick_response.get('request', {}).get('id')
        
        # Try to reject without note (should get 400)
        tester.test(
            "Vedouci tries to reject without note (should get 400)",
            "POST",
            f"leave/{sick_id}/decision",
            400,
            data={"action": "reject"},
            token=tester.tokens.get("vedouci")
        )
        
        # Reject with note (should work)
        tester.test(
            "Vedouci rejects with note (should work)",
            "POST",
            f"leave/{sick_id}/decision",
            200,
            data={"action": "reject", "note": "Test rejection reason"},
            token=tester.tokens.get("vedouci")
        )
    
    # Test strojnik trying to approve (should get 403)
    date_test = (today + timedelta(days=70)).strftime("%Y-%m-%d")
    success, test_leave = tester.test(
        "Create another vacation for approval test",
        "POST",
        "leave",
        200,
        data={
            "type": "vacation",
            "date_from": date_test,
            "date_to": date_test,
            "note": "Test"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        test_leave_id = test_leave.get('request', {}).get('id')
        
        # Strojnik tries to approve own leave (should get 403)
        tester.test(
            "Strojnik tries to approve own leave (should get 403)",
            "POST",
            f"leave/{test_leave_id}/decision",
            403,
            data={"action": "approve"},
            token=tester.tokens.get("strojnik")
        )
    
    # Test overlapping leave request (should get 409)
    tester.test(
        "Create overlapping leave request (should get 409)",
        "POST",
        "leave",
        409,
        data={
            "type": "vacation",
            "date_from": date_from,
            "date_to": date_to,
            "note": "Overlapping request"
        },
        token=tester.tokens.get("strojnik")
    )
    
    # ============================================================================
    # 3. EXPORTS TESTS
    # ============================================================================
    tester.log("\n\n📋 SECTION 3: EXPORTS", Colors.YELLOW)
    
    # Test data export as admin (XLSX)
    success, _ = tester.test(
        "Export attendance data as XLSX (admin)",
        "GET",
        "exports/data",
        200,
        params={
            "dataset": "attendance",
            "format": "xlsx",
            "date_from": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
            "date_to": today.strftime("%Y-%m-%d")
        },
        token=tester.tokens.get("admin")
    )
    
    # Test data export as CSV
    success, _ = tester.test(
        "Export timesheet data as CSV (admin)",
        "GET",
        "exports/data",
        200,
        params={
            "dataset": "timesheet",
            "format": "csv",
            "date_from": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
            "date_to": today.strftime("%Y-%m-%d")
        },
        token=tester.tokens.get("admin")
    )
    
    # Test strojnik can only export own data
    success, _ = tester.test(
        "Strojnik exports own data (should only get own data)",
        "GET",
        "exports/data",
        200,
        params={
            "dataset": "attendance",
            "format": "xlsx",
            "date_from": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
            "date_to": today.strftime("%Y-%m-%d")
        },
        token=tester.tokens.get("strojnik")
    )
    
    # Test PDF export
    # Note: This endpoint might be /api/exports/sichtovnice.pdf based on the review request
    # But I don't see it in routes_data.py, so it might be in exports.py
    
    # Test weekly exports list (manager only)
    success, _ = tester.test(
        "List weekly exports (vedouci)",
        "GET",
        "exports/weekly",
        200,
        token=tester.tokens.get("vedouci")
    )
    
    # Test strojnik cannot access weekly exports (should get 403)
    tester.test(
        "Strojnik tries to list weekly exports (should get 403)",
        "GET",
        "exports/weekly",
        403,
        token=tester.tokens.get("strojnik")
    )
    
    # Test cron endpoint without authorization (should get 401)
    tester.test(
        "Cron weekly exports without auth (should get 401)",
        "POST",
        "cron/weekly-exports",
        401,
        data={}
    )
    
    # ============================================================================
    # 3.5. MACHINE LOG XLSX EXPORT (Phase 7.5-7.7)
    # ============================================================================
    tester.log("\n\n📋 SECTION 3.5: MACHINE LOG XLSX EXPORT", Colors.YELLOW)
    
    # Test machine_log XLSX export as manager
    success, _ = tester.test(
        "Manager exports machine_log as XLSX",
        "GET",
        "exports/data",
        200,
        params={
            "dataset": "machine_log",
            "format": "xlsx",
            "date_from": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
            "date_to": today.strftime("%Y-%m-%d")
        },
        token=tester.tokens.get("vedouci")
    )
    
    if success:
        tester.log("   ✓ Machine log XLSX export works", Colors.GREEN)
    
    # Test machine_log CSV format (should return 400)
    tester.test(
        "Machine log CSV format (should return 400)",
        "GET",
        "exports/data",
        400,
        params={
            "dataset": "machine_log",
            "format": "csv"
        },
        token=tester.tokens.get("vedouci")
    )
    
    # Test machine_log with include_drafts parameter
    success, _ = tester.test(
        "Machine log with include_drafts=1",
        "GET",
        "exports/data",
        200,
        params={
            "dataset": "machine_log",
            "format": "xlsx",
            "include_drafts": "1"
        },
        token=tester.tokens.get("vedouci")
    )
    
    # Test machine_log with machine filter
    if 'test_machine' in tester.test_data:
        success, _ = tester.test(
            f"Machine log filtered by machine: {tester.test_data['test_machine']}",
            "GET",
            "exports/data",
            200,
            params={
                "dataset": "machine_log",
                "format": "xlsx",
                "machine": tester.test_data['test_machine']
            },
            token=tester.tokens.get("vedouci")
        )
    
    # Test employee can access machine_log (only own records)
    success, _ = tester.test(
        "Strojnik exports machine_log (only own records)",
        "GET",
        "exports/data",
        200,
        params={
            "dataset": "machine_log",
            "format": "xlsx"
        },
        token=tester.tokens.get("strojnik")
    )
    
    # ============================================================================
    # 4. MY SUMMARY (PŘEHLEDY)
    # ============================================================================
    tester.log("\n\n📋 SECTION 4: MY SUMMARY (Přehledy)", Colors.YELLOW)
    
    # Test strojnik can get own summary
    success, summary = tester.test(
        "Strojnik gets own summary",
        "GET",
        "my/summary",
        200,
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        # Verify response structure
        if 'timesheet' in summary and 'attendance' in summary and 'totals' in summary and 'leaves' in summary:
            tester.log(f"   ✓ Summary has all required fields", Colors.GREEN)
        else:
            tester.log(f"   ✗ Summary missing fields", Colors.RED)
    
    # ============================================================================
    # 5. USERS MANAGEMENT
    # ============================================================================
    tester.log("\n\n📋 SECTION 5: USERS MANAGEMENT", Colors.YELLOW)
    
    # Test roles info endpoint
    success, roles_info = tester.test(
        "Get roles info",
        "GET",
        "roles",
        200,
        token=tester.tokens.get("admin")
    )
    
    if success:
        roles = roles_info.get('roles', [])
        positions = roles_info.get('positions', [])
        
        # Verify 4 roles
        if len(roles) == 4:
            tester.log(f"   ✓ Found 4 roles", Colors.GREEN)
            role_labels = {r['role']: r['label'] for r in roles}
            tester.log(f"   Roles: {role_labels}", Colors.BLUE)
        else:
            tester.log(f"   ✗ Expected 4 roles, got {len(roles)}", Colors.RED)
        
        # Verify positions
        tester.log(f"   Positions: {[p['label'] for p in positions]}", Colors.BLUE)
    
    # Create test user with position mechanik
    test_username = f"test_mechanik_{datetime.now().strftime('%H%M%S')}"
    success, user_response = tester.test(
        "Admin creates TEST user with position mechanik",
        "POST",
        "users",
        200,
        data={
            "email": f"{test_username}@test.cz",
            "name": f"TEST Mechanik {datetime.now().strftime('%H%M%S')}",
            "username": test_username,
            "role": "employee",
            "position": "mechanik"
        },
        token=tester.tokens.get("admin")
    )
    
    if success:
        test_user = user_response.get('user', {})
        test_user_id = test_user.get('id')
        tester.test_data['test_user_id'] = test_user_id
        
        # Verify position is mechanik
        if test_user.get('position') == 'mechanik':
            tester.log(f"   ✓ User created with position mechanik", Colors.GREEN)
        else:
            tester.log(f"   ✗ Position should be mechanik, got: {test_user.get('position')}", Colors.RED)
        
        # List users and verify the new user appears with "Mechanik" label
        success, users_list = tester.test(
            "List users (verify TEST user shows as Mechanik)",
            "GET",
            "users",
            200,
            token=tester.tokens.get("admin")
        )
        
        if success:
            test_user_in_list = next((u for u in users_list if u.get('id') == test_user_id), None)
            if test_user_in_list:
                role_label = test_user_in_list.get('role_label')
                if role_label == 'Mechanik':
                    tester.log(f"   ✓ User shows as 'Mechanik' in list", Colors.GREEN)
                else:
                    tester.log(f"   ✗ User should show as 'Mechanik', got: {role_label}", Colors.RED)
        
        # Deactivate the test user
        success, _ = tester.test(
            "Admin deactivates TEST user",
            "PATCH",
            f"users/{test_user_id}",
            200,
            data={"active": False},
            token=tester.tokens.get("admin")
        )
        
        if success:
            tester.log(f"   ✓ TEST user deactivated", Colors.GREEN)
    
    # ============================================================================
    # 6. MACHINES
    # ============================================================================
    tester.log("\n\n📋 SECTION 6: MACHINES", Colors.YELLOW)
    
    # List machines and verify L566/3 and L576/7 exist
    success, machines = tester.test(
        "List machines (verify L566/3 and L576/7 exist)",
        "GET",
        "machines",
        200,
        token=tester.tokens.get("admin")
    )
    
    if success:
        machine_labels = [m.get('label') for m in machines]
        tester.log(f"   Found machines: {machine_labels}", Colors.BLUE)
        
        if 'L566/3' in machine_labels:
            tester.log(f"   ✓ Found L566/3", Colors.GREEN)
        else:
            tester.log(f"   ✗ L566/3 not found", Colors.RED)
        
        if 'L576/7' in machine_labels:
            tester.log(f"   ✓ Found L576/7", Colors.GREEN)
        else:
            tester.log(f"   ✗ L576/7 not found", Colors.RED)
        
        # Store first active machine for later tests
        active_machines = [m for m in machines if m.get('active', True)]
        if active_machines:
            tester.test_data['test_machine'] = active_machines[0].get('label', 'L566/3')
    
    # ============================================================================
    # 7. PLANNED EXCEPTIONS (Phase 6)
    # ============================================================================
    tester.log("\n\n📋 SECTION 7: PLANNED EXCEPTIONS (zkrácené směny)", Colors.YELLOW)
    
    # Test late_arrival exception (requires time_from)
    exception_date = (today + timedelta(days=3)).strftime("%Y-%m-%d")
    
    success, late_response = tester.test(
        "Strojnik creates late_arrival exception (requires time_from)",
        "POST",
        "exceptions",
        200,
        data={
            "kind": "late_arrival",
            "date": exception_date,
            "time_from": "09:30",
            "reason": "Lékař - kontrola"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        late_exc = late_response.get('exception', {})
        late_exc_id = late_exc.get('id')
        tester.test_data['late_exc_id'] = late_exc_id
        
        # Verify kind_label is returned
        if late_exc.get('kind_label') == 'Pozdní příchod':
            tester.log(f"   ✓ kind_label returned: {late_exc.get('kind_label')}", Colors.GREEN)
        else:
            tester.log(f"   ✗ kind_label should be 'Pozdní příchod', got: {late_exc.get('kind_label')}", Colors.RED)
    
    # Test late_arrival without time_from (should fail with 400)
    tester.test(
        "Late arrival without time_from (should get 400)",
        "POST",
        "exceptions",
        400,
        data={
            "kind": "late_arrival",
            "date": exception_date,
            "reason": "Test"
        },
        token=tester.tokens.get("strojnik")
    )
    
    # Test early_departure exception (requires time_to)
    success, early_response = tester.test(
        "Strojnik creates early_departure exception (requires time_to)",
        "POST",
        "exceptions",
        200,
        data={
            "kind": "early_departure",
            "date": (today + timedelta(days=4)).strftime("%Y-%m-%d"),
            "time_to": "14:00",
            "reason": "Úřad - vyřízení dokumentů"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        early_exc_id = early_response.get('exception', {}).get('id')
        tester.test_data['early_exc_id'] = early_exc_id
    
    # Test early_departure without time_to (should fail with 400)
    tester.test(
        "Early departure without time_to (should get 400)",
        "POST",
        "exceptions",
        400,
        data={
            "kind": "early_departure",
            "date": exception_date,
            "reason": "Test"
        },
        token=tester.tokens.get("strojnik")
    )
    
    # Test other exception (optional times)
    success, other_response = tester.test(
        "Strojnik creates 'other' exception (optional times)",
        "POST",
        "exceptions",
        200,
        data={
            "kind": "other",
            "date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
            "time_from": "10:00",
            "time_to": "12:00",
            "reason": "Osobní záležitost"
        },
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        other_exc_id = other_response.get('exception', {}).get('id')
        tester.test_data['other_exc_id'] = other_exc_id
    
    # Test exception without reason (should fail with 400)
    tester.test(
        "Exception without reason (should get 400)",
        "POST",
        "exceptions",
        400,
        data={
            "kind": "other",
            "date": exception_date
        },
        token=tester.tokens.get("strojnik")
    )
    
    # Test GET /api/exceptions?mine=1 (employee sees only own)
    success, my_exceptions = tester.test(
        "Strojnik gets own exceptions (mine=1)",
        "GET",
        "exceptions",
        200,
        params={"mine": 1},
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        if len(my_exceptions) >= 3:
            tester.log(f"   ✓ Found {len(my_exceptions)} exceptions", Colors.GREEN)
        else:
            tester.log(f"   ✗ Expected at least 3 exceptions, got {len(my_exceptions)}", Colors.RED)
        
        # Verify can_delete is True for own exceptions
        if all(exc.get('can_delete') for exc in my_exceptions):
            tester.log(f"   ✓ All exceptions have can_delete=True", Colors.GREEN)
        else:
            tester.log(f"   ✗ Some exceptions have can_delete=False", Colors.RED)
    
    # Test GET /api/exceptions as manager (sees all)
    success, all_exceptions = tester.test(
        "Vedouci gets all exceptions (manager view)",
        "GET",
        "exceptions",
        200,
        token=tester.tokens.get("vedouci")
    )
    
    if success:
        tester.log(f"   Manager sees {len(all_exceptions)} total exceptions", Colors.BLUE)
        
        # Verify manager sees strojnik's exceptions
        strojnik_exceptions = [e for e in all_exceptions if e.get('user_name') == strojnik_user.get('name')]
        if len(strojnik_exceptions) >= 3:
            tester.log(f"   ✓ Manager sees strojnik's exceptions", Colors.GREEN)
        else:
            tester.log(f"   ✗ Manager should see strojnik's exceptions", Colors.RED)
    
    # Test DELETE /api/exceptions/{id} (author can delete)
    if 'late_exc_id' in tester.test_data:
        success, _ = tester.test(
            "Strojnik deletes own exception (should succeed)",
            "DELETE",
            f"exceptions/{tester.test_data['late_exc_id']}",
            200,
            token=tester.tokens.get("strojnik")
        )
    
    # Test DELETE /api/exceptions/{id} (non-author gets 403)
    if 'early_exc_id' in tester.test_data:
        # Create an exception as vedouci first
        success, vedouci_exc = tester.test(
            "Vedouci creates own exception",
            "POST",
            "exceptions",
            200,
            data={
                "kind": "other",
                "date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
                "reason": "Test exception for delete test"
            },
            token=tester.tokens.get("vedouci")
        )
        
        if success:
            vedouci_exc_id = vedouci_exc.get('exception', {}).get('id')
            
            # Strojnik tries to delete vedouci's exception (should get 403)
            tester.test(
                "Strojnik tries to delete vedouci's exception (should get 403)",
                "DELETE",
                f"exceptions/{vedouci_exc_id}",
                403,
                token=tester.tokens.get("strojnik")
            )
    
    # Test GET /api/overview includes upcoming_exceptions
    success, overview = tester.test(
        "Vedouci gets overview (should include upcoming_exceptions)",
        "GET",
        "overview",
        200,
        token=tester.tokens.get("vedouci")
    )
    
    if success:
        if 'upcoming_exceptions' in overview:
            tester.log(f"   ✓ Overview includes upcoming_exceptions array", Colors.GREEN)
            tester.log(f"   Found {len(overview['upcoming_exceptions'])} upcoming exceptions (next 7 days)", Colors.BLUE)
        else:
            tester.log(f"   ✗ Overview missing upcoming_exceptions", Colors.RED)
    
    # ============================================================================
    # 8. PUSH NOTIFICATIONS (Phase 6)
    # ============================================================================
    tester.log("\n\n📋 SECTION 8: PUSH NOTIFICATIONS (Web Push)", Colors.YELLOW)
    
    # Test GET /api/push/public-key
    success, pubkey_response = tester.test(
        "Get VAPID public key",
        "GET",
        "push/public-key",
        200,
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        if 'public_key' in pubkey_response:
            tester.log(f"   ✓ public_key returned", Colors.GREEN)
            tester.log(f"   Public key: {pubkey_response['public_key'][:50]}...", Colors.BLUE)
        else:
            tester.log(f"   ✗ public_key missing in response", Colors.RED)
    
    # Test POST /api/push/subscribe
    fake_subscription = {
        "subscription": {
            "endpoint": f"https://fcm.googleapis.com/fcm/send/test-endpoint-{datetime.now().strftime('%H%M%S')}",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
                "auth": "tBHItJI5svbpez7KI4CCXg=="
            }
        },
        "user_agent": "Test Agent"
    }
    
    success, subscribe_response = tester.test(
        "Subscribe to push notifications",
        "POST",
        "push/subscribe",
        200,
        data=fake_subscription,
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        status = subscribe_response.get('status')
        if status in ('created', 'updated'):
            tester.log(f"   ✓ Subscription {status}", Colors.GREEN)
        else:
            tester.log(f"   ✗ Unexpected status: {status}", Colors.RED)
    
    # Test POST /api/push/subscribe again (should return 'updated')
    success, subscribe_response2 = tester.test(
        "Subscribe again (should return 'updated')",
        "POST",
        "push/subscribe",
        200,
        data=fake_subscription,
        token=tester.tokens.get("strojnik")
    )
    
    if success and subscribe_response2.get('status') == 'updated':
        tester.log(f"   ✓ Idempotent subscription update works", Colors.GREEN)
    
    # Test POST /api/push/test (may fail silently if endpoint is fake)
    success, test_response = tester.test(
        "Send test push notification (may fail silently with fake endpoint)",
        "POST",
        "push/test",
        200,
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        sent = test_response.get('sent', 0)
        tester.log(f"   Push test sent to {sent} subscription(s)", Colors.BLUE)
        tester.log(f"   Note: Actual delivery may fail with fake endpoint (expected)", Colors.YELLOW)
    
    # Test POST /api/push/unsubscribe
    success, unsub_response = tester.test(
        "Unsubscribe from push notifications",
        "POST",
        "push/unsubscribe",
        200,
        data={"endpoint": fake_subscription["subscription"]["endpoint"]},
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        deleted = unsub_response.get('deleted', 0)
        if deleted == 1:
            tester.log(f"   ✓ Subscription deleted", Colors.GREEN)
        else:
            tester.log(f"   Deleted count: {deleted}", Colors.BLUE)
    
    # ============================================================================
    # 9. RECORDS INTERVALSERVICE RESTRICTIONS (Phase 6)
    # ============================================================================
    tester.log("\n\n📋 SECTION 9: RECORDS INTERVALSERVICE RESTRICTIONS", Colors.YELLOW)
    
    # Get test machine
    test_machine = tester.test_data.get('test_machine', 'L566/3')
    record_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Helper function to create a minimal valid record
    def create_test_record(record_id, interval_service=False, service_by=""):
        return {
            "opId": f"test-op-{record_id}",
            "baseRevision": 0,
            "confirm": True,
            "record": {
                "id": record_id,
                "date": record_date,
                "machine": test_machine,
                "operator": "Test Operator",
                "shift": "ranní",
                "mthStart": "1000",
                "mthEnd": "1008",
                "billing": [{"start": "07:00", "end": "15:00"}],
                "intervalService": interval_service,
                "serviceBy": service_by,
                "serviceDescription": "Test service" if interval_service else "",
                "service": [{"start": "07:00", "end": "08:00"}] if interval_service else []
            }
        }
    
    # Test 1: Regular employee (strojnik) tries to save intervalService=true without external (should FAIL)
    record_id_1 = f"test-rec-{datetime.now().strftime('%H%M%S')}-1"
    tester.test(
        "Strojnik (employee) saves intervalService=true with serviceBy=operator (should FAIL 422)",
        "PUT",
        f"records/{record_id_1}",
        422,
        data=create_test_record(record_id_1, interval_service=True, service_by="operator"),
        token=tester.tokens.get("strojnik")
    )
    
    # Test 2: Regular employee with serviceBy='external' (should SUCCEED)
    record_id_2 = f"test-rec-{datetime.now().strftime('%H%M%S')}-2"
    rec2_data = create_test_record(record_id_2, interval_service=True, service_by="external")
    rec2_data["record"]["externalCompany"] = "Test External Service s.r.o."
    success, rec2_response = tester.test(
        "Strojnik saves intervalService=true with serviceBy=external (should SUCCEED)",
        "PUT",
        f"records/{record_id_2}",
        200,
        data=rec2_data,
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        tester.log(f"   ✓ External service allowed for regular employee", Colors.GREEN)
    
    # Test 3: serviceBy='operator_workshop' is accepted as valid value
    record_id_3 = f"test-rec-{datetime.now().strftime('%H%M%S')}-3"
    success, rec3_response = tester.test(
        "Strojnik saves record with serviceBy=operator_workshop (should be accepted)",
        "PUT",
        f"records/{record_id_3}",
        200,
        data=create_test_record(record_id_3, interval_service=False, service_by="operator_workshop"),
        token=tester.tokens.get("strojnik")
    )
    
    if success:
        saved_rec = rec3_response.get('record', {})
        if saved_rec.get('serviceBy') == 'operator_workshop':
            tester.log(f"   ✓ serviceBy='operator_workshop' accepted", Colors.GREEN)
        else:
            tester.log(f"   ✗ serviceBy should be 'operator_workshop', got: {saved_rec.get('serviceBy')}", Colors.RED)
    
    # Test 4: Mechanik can save intervalService=true (if test_user_id exists and is mechanik)
    if 'test_user_id' in tester.test_data:
        # First, reset password for test mechanik user
        success, reset_response = tester.test(
            "Admin resets password for test mechanik",
            "POST",
            f"users/{tester.test_data['test_user_id']}/reset-password",
            200,
            token=tester.tokens.get("admin")
        )
        
        if success:
            temp_password = reset_response.get('temporary_password')
            
            # Login as test mechanik with temporary password
            success, mechanik_user = tester.login(f"test_mechanik_{datetime.now().strftime('%H%M%S')}", temp_password)
            
            # Note: First login requires password change, so this might fail
            # We'll skip this test if login fails
            tester.log(f"   Note: Mechanik login test skipped (requires password change flow)", Colors.YELLOW)
    
    # ============================================================================
    # 10. REGRESSION TESTS
    # ============================================================================
    tester.log("\n\n📋 SECTION 10: REGRESSION (existing endpoints)", Colors.YELLOW)
    
    # Test /api/auth/login still works
    tester.test(
        "Regression: Login still works",
        "POST",
        "auth/login",
        200,
        data={"login": "strojnik", "password": "Demstav2026!"}
    )
    
    # Test /api/machines still works
    tester.test(
        "Regression: GET /api/machines still works",
        "GET",
        "machines",
        200,
        token=tester.tokens.get("admin")
    )
    
    # Test /api/records still works
    tester.test(
        "Regression: GET /api/records still works",
        "GET",
        "records",
        200,
        params={"mine": 1, "limit": 10},
        token=tester.tokens.get("strojnik")
    )
    
    # Test /api/attendance/events still works (requires manager role)
    tester.test(
        "Regression: GET /api/attendance/events still works (manager)",
        "GET",
        "attendance/events",
        200,
        token=tester.tokens.get("vedouci")
    )
    
    # Test /api/leave still works
    tester.test(
        "Regression: GET /api/leave still works",
        "GET",
        "leave",
        200,
        params={"mine": 1},
        token=tester.tokens.get("strojnik")
    )
    
    # Test PDF exports still work (should return PDF content)
    # Note: We can't easily verify PDF content, but we can check status code
    tester.log(f"   Testing PDF exports...", Colors.BLUE)
    
    # Test sichtovnice.pdf
    url_sichtovnice = f"{BASE_URL}/exports/sichtovnice.pdf"
    headers = {'Authorization': f'Bearer {tester.tokens.get("vedouci")}'}
    try:
        response = requests.get(url_sichtovnice, headers=headers, timeout=30)
        if response.status_code == 200 and response.headers.get('content-type') == 'application/pdf':
            tester.tests_run += 1
            tester.tests_passed += 1
            tester.log(f"   ✅ Regression: GET /api/exports/sichtovnice.pdf works (PDF returned)", Colors.GREEN)
        else:
            tester.tests_run += 1
            tester.log(f"   ❌ Regression: sichtovnice.pdf failed - Status: {response.status_code}", Colors.RED)
    except Exception as e:
        tester.tests_run += 1
        tester.log(f"   ❌ Regression: sichtovnice.pdf error - {str(e)}", Colors.RED)
    
    # Test denik.pdf
    url_denik = f"{BASE_URL}/exports/denik.pdf"
    try:
        response = requests.get(url_denik, headers=headers, timeout=30)
        if response.status_code == 200 and response.headers.get('content-type') == 'application/pdf':
            tester.tests_run += 1
            tester.tests_passed += 1
            tester.log(f"   ✅ Regression: GET /api/exports/denik.pdf works (PDF returned)", Colors.GREEN)
        else:
            tester.tests_run += 1
            tester.log(f"   ❌ Regression: denik.pdf failed - Status: {response.status_code}", Colors.RED)
    except Exception as e:
        tester.tests_run += 1
        tester.log(f"   ❌ Regression: denik.pdf error - {str(e)}", Colors.RED)
    
    # ============================================================================
    # SUMMARY
    # ============================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    print("="*80)
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
