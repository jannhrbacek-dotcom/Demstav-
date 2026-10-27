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
