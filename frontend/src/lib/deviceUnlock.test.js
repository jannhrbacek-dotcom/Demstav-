import {webcrypto} from 'crypto';
import {TextEncoder,TextDecoder} from 'util';
import {deviceKey,enrollDevice,removeDeviceKey,supportsDeviceUnlock,unlockDevice} from './deviceUnlock';
const user={id:'employee-a',username:'jan',name:'Jan'},id=new Uint8Array([7,12,43,98]);
const encode=s=>new TextEncoder().encode(s),b64=b=>Buffer.from(b).toString('base64url');
let pair,config;
function der(raw){
 const integer=a=>{let i=0;while(i<a.length-1&&a[i]===0)i++;let b=Array.from(a.slice(i));if(b[0]&128)b=[0,...b];return [2,b.length,...b];};
 const a=new Uint8Array(raw),body=[...integer(a.slice(0,32)),...integer(a.slice(32))];return new Uint8Array([48,body.length,...body]);
}
async function assertion(options,change={}){
 const clientDataJSON=encode(JSON.stringify({type:'webauthn.get',challenge:b64(options.publicKey.challenge),origin:location.origin,crossOrigin:false,...change.client}));
 const authenticatorData=new Uint8Array(37);
 authenticatorData.set(new Uint8Array(await webcrypto.subtle.digest('SHA-256',encode(change.rp||location.hostname))));authenticatorData[32]=change.flags??5;
 const hash=new Uint8Array(await webcrypto.subtle.digest('SHA-256',clientDataJSON)),signed=new Uint8Array(37+hash.length);signed.set(authenticatorData);signed.set(hash,37);
 const signature=der(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},change.privateKey||pair.privateKey,signed));if(change.tamper)signature[signature.length-1]^=1;
 return {rawId:change.id||id,response:{clientDataJSON,authenticatorData,signature}};
}
const registration=()=>({rawId:id,response:{getPublicKey:()=>Buffer.from(config.publicKey,'base64url')}});
const save=()=>localStorage.setItem(`demstav:device-key:${user.id}`,JSON.stringify(config));
beforeAll(async()=>{
 Object.defineProperty(window,'crypto',{configurable:true,value:webcrypto});global.TextEncoder=TextEncoder;global.TextDecoder=TextDecoder;
 pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);config={id:b64(id),publicKey:b64(await webcrypto.subtle.exportKey('spki',pair.publicKey))};
});
beforeEach(()=>{
 localStorage.clear();Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
 Object.defineProperty(window,'PublicKeyCredential',{configurable:true,value:{isUserVerifyingPlatformAuthenticatorAvailable:jest.fn().mockResolvedValue(true)}});
 Object.defineProperty(navigator,'credentials',{configurable:true,value:{get:jest.fn(options=>assertion(options)),create:jest.fn()}});
});
test('accepts a real ES256 assertion bound to account credential, RP and required verification',async()=>{
 save();await expect(unlockDevice(user.id)).resolves.toBe(true);
 expect(navigator.credentials.get).toHaveBeenCalledWith(expect.objectContaining({publicKey:expect.objectContaining({rpId:location.hostname,userVerification:'required',allowCredentials:[{id,type:'public-key'}]})}));
 await expect(unlockDevice('another-account')).rejects.toThrow();
});
test('rejects well-formed signatures made by a different private key',async()=>{
 save();const impostor=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);navigator.credentials.get.mockImplementation(options=>assertion(options,{privateKey:impostor.privateKey}));await expect(unlockDevice(user.id)).rejects.toThrow('Ověření zařízení selhalo.');
});
test('rejects a tampered signature',async()=>{
 save();navigator.credentials.get.mockImplementation(options=>assertion(options,{tamper:true}));await expect(unlockDevice(user.id)).rejects.toThrow('Ověření zařízení selhalo.');
});
test.each([
 ['wrong challenge',{client:{challenge:'replayed-challenge'}}],['wrong origin',{client:{origin:'https://impostor.example'}}],['missing user verification',{flags:1}],['missing user presence',{flags:4}],['wrong RP hash',{rp:'impostor.example'}],['cross-origin assertion',{client:{crossOrigin:true}}],['wrong ceremony type',{client:{type:'webauthn.create'}}],['wrong credential ID',{id:new Uint8Array([99])}],
])('rejects correctly signed assertion with %s',async(_,change)=>{
 save();navigator.credentials.get.mockImplementation(options=>assertion(options,change));await expect(unlockDevice(user.id)).rejects.toThrow('Ověření zařízení selhalo.');
});
test('enrollment stores public material only after successful signed verification',async()=>{
 navigator.credentials.create.mockResolvedValue(registration());navigator.credentials.get.mockImplementation(async options=>{expect(deviceKey(user.id)).toBeNull();return assertion(options);});
 await enrollDevice(user);expect(deviceKey(user.id)).toEqual(config);expect(navigator.credentials.create.mock.calls[0][0].publicKey.authenticatorSelection.userVerification).toBe('required');removeDeviceKey(user.id);expect(deviceKey(user.id)).toBeNull();
});
test.each(['create','get'])('canceling %s during enrollment does not persist key',async stage=>{
 navigator.credentials.create.mockResolvedValue(registration());navigator.credentials[stage].mockRejectedValue(new DOMException('Canceled','NotAllowedError'));await expect(enrollDevice(user)).rejects.toThrow('Canceled');expect(deviceKey(user.id)).toBeNull();expect(localStorage.length).toBe(0);
});
test('unsupported, insecure, unavailable and failing authenticators report false',async()=>{
 await expect(supportsDeviceUnlock()).resolves.toBe(true);Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});await expect(supportsDeviceUnlock()).resolves.toBe(false);
 Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockResolvedValue(false);await expect(supportsDeviceUnlock()).resolves.toBe(false);
 window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockRejectedValue(new Error('Unavailable'));await expect(supportsDeviceUnlock()).resolves.toBe(false);
 Object.defineProperty(window,'PublicKeyCredential',{configurable:true,value:undefined});await expect(supportsDeviceUnlock()).resolves.toBe(false);
});
