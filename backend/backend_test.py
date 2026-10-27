#!/usr/bin/env python3
"""
Backend API tests for DEMSTAV OPERATIONS
Tests the critical bug fix: PUT /api/machines/{id} with partial body should NOT delete last_service_mth
"""
import requests
import sys
import json
from datetime import datetime

BASE_URL = "https://markdown-notes-12.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class APITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.machine_id = None
        self.record_id = None

    def log(self, msg, color=Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")

    def success(self, msg):
        self.tests_passed += 1
        self.log(f"✅ {msg}", Colors.GREEN)

    def fail(self, msg):
        self.tests_failed += 1
        self.log(f"❌ {msg}", Colors.RED)

    def test(self, name, method, endpoint, expected_status, data=None, check_fn=None):
        """Run a single API test"""
        url = f"{BASE_URL}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"\n🔍 Test {self.tests_run}: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                self.fail(f"Unknown method {method}")
                return False, {}

            # Check status code
            if response.status_code != expected_status:
                self.fail(f"Expected status {expected_status}, got {response.status_code}")
                try:
                    self.log(f"Response: {response.json()}", Colors.YELLOW)
                except:
                    self.log(f"Response text: {response.text[:200]}", Colors.YELLOW)
                return False, {}

            # Parse response
            try:
                resp_data = response.json()
            except:
                resp_data = {}

            # Run custom check function
            if check_fn:
                if not check_fn(resp_data):
                    self.fail(f"Custom check failed")
                    return False, resp_data

            self.success(f"Passed - Status: {response.status_code}")
            return True, resp_data

        except Exception as e:
            self.fail(f"Exception: {str(e)}")
            return False, {}

    def login(self, email, password):
        """Login and get token"""
        self.log(f"\n{'='*60}", Colors.BLUE)
        self.log(f"🔐 Logging in as {email}", Colors.BLUE)
        self.log(f"{'='*60}", Colors.BLUE)
        
        success, response = self.test(
            f"Login as {email}",
            "POST",
            "/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log(f"✓ Token obtained for {response.get('user', {}).get('name', email)}", Colors.GREEN)
            return True
        return False

    def test_machine_partial_update_bug_fix(self):
        """
        CRITICAL BUG FIX TEST:
        PUT /api/machines/{id} with partial body (e.g., just {label, active:false}) 
        should NOT delete last_service_mth / operating_hours / interval
        
        Test procedure:
        1. Create machine TEST_Fix2 (operating_hours 2420)
        2. Create confirmed record with intervalService=true, mthStart 2420, mthEnd 2430
        3. GET /api/machines: verify last_service_mth 2430, next_service_mth 3000
        4. PUT only {label:'TEST_Fix2', active:false}
        5. Verify last_service_mth still 2430
        """
        self.log(f"\n{'='*60}", Colors.YELLOW)
        self.log("🔧 CRITICAL BUG FIX TEST: Machine Partial Update", Colors.YELLOW)
        self.log(f"{'='*60}", Colors.YELLOW)

        # Step 1: Create machine TEST_Fix2
        machine_data = {
            "label": "TEST_Fix2",
            "type": "Test Machine",
            "operating_hours": "2420",
            "service_interval_mth": 500,
            "service_warn_mth": 100,
            "active": True
        }
        
        success, resp = self.test(
            "Create machine TEST_Fix2 with operating_hours 2420",
            "POST",
            "/machines",
            200,
            data=machine_data,
            check_fn=lambda r: r.get('label') == 'TEST_Fix2' and float(r.get('operating_hours', 0)) == 2420
        )
        
        if not success:
            self.fail("Failed to create machine TEST_Fix2")
            return False
        
        self.machine_id = resp['id']
        self.log(f"✓ Machine created with ID: {self.machine_id}", Colors.GREEN)

        # Step 2: Create confirmed record with intervalService
        record_data = {
            "opId": f"test_{datetime.now().timestamp()}",
            "baseRevision": 0,
            "confirm": True,
            "record": {
                "id": f"rec_test_fix2_{int(datetime.now().timestamp())}",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "machine": "TEST_Fix2",
                "operator": "Test Operator",
                "shift": "Denní",
                "billing": [{"start": "06:00", "end": "14:00"}],
                "service": [],
                "downtime": [],
                "mthStart": "2420",
                "mthEnd": "2430",
                "intervalService": True,
                "dailyCheck": True,
                "fit": "yes",
                "drive": "1",
                "faults": [],
                "attachments": []
            }
        }
        
        self.record_id = record_data["record"]["id"]
        
        success, resp = self.test(
            "Create confirmed record with intervalService (mthStart 2420, mthEnd 2430)",
            "PUT",
            f"/records/{self.record_id}",
            200,
            data=record_data,
            check_fn=lambda r: r.get('status') == 'saved' and r.get('record', {}).get('status') == 'confirmed'
        )
        
        if not success:
            self.fail("Failed to create confirmed record")
            return False
        
        self.log(f"✓ Record created and confirmed", Colors.GREEN)

        # Step 3: GET /api/machines and verify last_service_mth
        success, resp = self.test(
            "GET /api/machines - verify last_service_mth updated to 2430",
            "GET",
            "/machines",
            200,
            check_fn=lambda r: any(
                m.get('label') == 'TEST_Fix2' and 
                m.get('last_service_mth') == 2430.0 and
                m.get('next_service_mth') == 3000
                for m in r
            )
        )
        
        if not success:
            self.fail("Machine last_service_mth not updated correctly after interval service")
            return False
        
        # Find the machine in response
        machines = resp if isinstance(resp, list) else []
        test_machine = next((m for m in machines if m.get('label') == 'TEST_Fix2'), None)
        
        if test_machine:
            self.log(f"✓ Before partial update:", Colors.GREEN)
            self.log(f"  - last_service_mth: {test_machine.get('last_service_mth')}", Colors.GREEN)
            self.log(f"  - next_service_mth: {test_machine.get('next_service_mth')}", Colors.GREEN)
            self.log(f"  - operating_hours: {test_machine.get('operating_hours')}", Colors.GREEN)
            self.log(f"  - active: {test_machine.get('active')}", Colors.GREEN)

        # Step 4: PUT with partial body (only label and active)
        partial_update = {
            "label": "TEST_Fix2",
            "active": False
        }
        
        success, resp = self.test(
            "PUT /api/machines/{id} with ONLY {label, active:false}",
            "PUT",
            f"/machines/{self.machine_id}",
            200,
            data=partial_update
        )
        
        if not success:
            self.fail("Failed to update machine with partial body")
            return False

        # Step 5: Verify last_service_mth still exists
        updated_machine = resp
        
        self.log(f"\n✓ After partial update:", Colors.YELLOW)
        self.log(f"  - last_service_mth: {updated_machine.get('last_service_mth')}", Colors.YELLOW)
        self.log(f"  - operating_hours: {updated_machine.get('operating_hours')}", Colors.YELLOW)
        self.log(f"  - active: {updated_machine.get('active')}", Colors.YELLOW)
        
        # CRITICAL CHECK: last_service_mth should still be 2430
        if updated_machine.get('last_service_mth') != 2430.0:
            self.fail(f"BUG STILL EXISTS! last_service_mth was {updated_machine.get('last_service_mth')}, expected 2430.0")
            return False
        
        # Check operating_hours still exists
        if updated_machine.get('operating_hours') != 2420.0:
            self.fail(f"BUG! operating_hours was {updated_machine.get('operating_hours')}, expected 2420.0")
            return False
        
        # Check active was updated
        if updated_machine.get('active') != False:
            self.fail(f"active field not updated correctly")
            return False
        
        self.success("🎉 BUG FIX VERIFIED! Partial update does NOT delete last_service_mth/operating_hours")
        return True

    def test_service_alerts(self):
        """Test service alerts endpoint"""
        self.log(f"\n{'='*60}", Colors.BLUE)
        self.log("🔔 Testing Service Alerts", Colors.BLUE)
        self.log(f"{'='*60}", Colors.BLUE)
        
        success, resp = self.test(
            "GET /api/service-alerts",
            "GET",
            "/service-alerts",
            200
        )
        
        if success:
            alerts = resp if isinstance(resp, list) else []
            self.log(f"✓ Found {len(alerts)} service alerts", Colors.GREEN)
            for alert in alerts:
                self.log(f"  - {alert.get('label')}: {alert.get('service_state')} (remaining: {alert.get('remaining_mth')} mth)", Colors.YELLOW)
        
        return success

    def test_machines_list(self):
        """Test machines list endpoint"""
        self.log(f"\n{'='*60}", Colors.BLUE)
        self.log("🚜 Testing Machines List", Colors.BLUE)
        self.log(f"{'='*60}", Colors.BLUE)
        
        success, resp = self.test(
            "GET /api/machines",
            "GET",
            "/machines",
            200
        )
        
        if success:
            machines = resp if isinstance(resp, list) else []
            self.log(f"✓ Found {len(machines)} machines", Colors.GREEN)
            
            # Check for Liebherr machines mentioned in test requirements
            liebherr_machines = [m for m in machines if 'Liebherr' in m.get('label', '')]
            if liebherr_machines:
                self.log(f"✓ Found {len(liebherr_machines)} Liebherr machines:", Colors.GREEN)
                for m in liebherr_machines:
                    self.log(f"  - {m.get('label')}: {m.get('service_state', 'unknown')} (remaining: {m.get('remaining_mth')} mth)", Colors.YELLOW)
        
        return success

    def cleanup(self):
        """Cleanup test data"""
        self.log(f"\n{'='*60}", Colors.BLUE)
        self.log("🧹 Cleaning up test data", Colors.BLUE)
        self.log(f"{'='*60}", Colors.BLUE)
        
        # Delete test record
        if self.record_id:
            success, _ = self.test(
                f"Delete test record {self.record_id}",
                "DELETE",
                f"/records/{self.record_id}",
                200
            )
        
        # Deactivate test machine
        if self.machine_id:
            success, _ = self.test(
                "Deactivate TEST_Fix2 machine",
                "PUT",
                f"/machines/{self.machine_id}",
                200,
                data={"label": "TEST_Fix2", "active": False}
            )

    def print_summary(self):
        """Print test summary"""
        self.log(f"\n{'='*60}", Colors.BLUE)
        self.log("📊 TEST SUMMARY", Colors.BLUE)
        self.log(f"{'='*60}", Colors.BLUE)
        
        total = self.tests_run
        passed = self.tests_passed
        failed = self.tests_failed
        
        self.log(f"Total tests: {total}", Colors.BLUE)
        self.log(f"Passed: {passed}", Colors.GREEN)
        self.log(f"Failed: {failed}", Colors.RED if failed > 0 else Colors.GREEN)
        
        if failed == 0:
            self.log(f"\n🎉 ALL TESTS PASSED!", Colors.GREEN)
            return 0
        else:
            self.log(f"\n⚠️  {failed} TEST(S) FAILED", Colors.RED)
            return 1

def main():
    tester = APITester()
    
    # Login as admin
    if not tester.login("admin@demstav.cz", "Demstav2026!"):
        print("❌ Login failed, cannot proceed")
        return 1
    
    # Run tests
    try:
        # Test 1: Critical bug fix
        tester.test_machine_partial_update_bug_fix()
        
        # Test 2: Service alerts
        tester.test_service_alerts()
        
        # Test 3: Machines list
        tester.test_machines_list()
        
    finally:
        # Cleanup
        tester.cleanup()
    
    # Print summary
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
