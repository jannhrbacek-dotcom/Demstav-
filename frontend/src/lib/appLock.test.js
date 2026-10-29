import {webcrypto} from 'crypto';
import {TextEncoder} from 'util';
import {settings,verify,enable,disable} from './appLock';
beforeAll(()=>{Object.defineProperty(window,'crypto',{value:webcrypto});global.TextEncoder=TextEncoder;});beforeEach(()=>localStorage.clear());
test('account-scoped salted verifier rejects wrong password and never stores plaintext',async()=>{await enable('a','test-password');expect(localStorage.getItem('demstav:lock:v1:a')).not.toContain('test-password');expect(await verify('a','wrong')).toBe(false);expect(await verify('a','test-password')).toBe(true);expect(await verify('b','test-password')).toBe(false);disable('a');expect(settings('a')).toBeNull();});
test('invalid settings stay locked and short passwords cannot enable lock',async()=>{localStorage.setItem('demstav:lock:v1:a','broken');expect(settings('a').invalid).toBe(true);await expect(enable('b','123')).rejects.toThrow();});
test('PIN requires 6–12 digits and remains account scoped',async()=>{await expect(enable('a','12345','pin')).rejects.toThrow();await expect(enable('a','abc123','pin')).rejects.toThrow();await enable('a','123456','pin');expect(settings('a').mode).toBe('pin');expect(await verify('a','123456')).toBe(true);expect(await verify('a','654321')).toBe(false);expect(await verify('b','123456')).toBe(false);});
