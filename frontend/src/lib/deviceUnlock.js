// Local UI lock only. Credentials never replace server account authentication.
const key = id => `demstav:device-key:${id}`;
const bytes = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function deviceKey(id) { try { return JSON.parse(localStorage.getItem(key(id)) || 'null'); } catch { return null; } }
export function removeDeviceKey(id) { localStorage.removeItem(key(id)); }
export async function supportsDeviceUnlock() { try { return !!window.isSecureContext && !!await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; } }
export async function enrollDevice(user) {
 const credential = await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rp:{name:'DEMSTAV Operations',id:location.hostname},user:{id:new TextEncoder().encode(user.id),name:user.username||user.email||user.id,displayName:user.name||user.id},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},timeout:60000,attestation:'none'}});
 const publicKey = credential?.response.getPublicKey?.();
 if(!publicKey) throw Error('Tento prohlížeč nepodporuje bezpečné nastavení zámku zařízení.');
 // Verify possession and user verification before persisting enrollment.
 const config={id:b64(credential.rawId),publicKey:b64(publicKey)};
 await assertDevice(config);
 localStorage.setItem(key(user.id),JSON.stringify(config));
}
// WebAuthn ECDSA signatures use ASN.1 DER; WebCrypto expects fixed-width r || s.
export function signatureBytes(input) {
 const a=new Uint8Array(input);if(a[0]!==48||a[2]!==2)throw Error('Neplatný podpis.');
 const rlen=a[3],spos=4+rlen;if(a[spos]!==2)throw Error('Neplatný podpis.');const slen=a[spos+1];
 const r=a.slice(4,4+rlen),s=a.slice(spos+2,spos+2+slen),out=new Uint8Array(64);
 if(r.length>33||s.length>33||spos+2+slen!==a.length)throw Error('Neplatný podpis.');
 out.set(r.slice(-32),32-Math.min(r.length,32));out.set(s.slice(-32),64-Math.min(s.length,32));return out;
}
async function assertDevice(config) {
 const challenge=crypto.getRandomValues(new Uint8Array(32));
 const c=await navigator.credentials.get({publicKey:{challenge,rpId:location.hostname,allowCredentials:[{id:bytes(config.id),type:'public-key'}],userVerification:'required',timeout:60000}});
 if(!c||b64(c.rawId)!==config.id)throw Error('Ověření zařízení selhalo.');
 const response=c.response,client=JSON.parse(new TextDecoder().decode(response.clientDataJSON)),auth=new Uint8Array(response.authenticatorData);
 const rp=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(location.hostname)));
 if(client.type!=='webauthn.get'||client.challenge!==b64(challenge)||client.origin!==location.origin||client.crossOrigin===true||auth.length<37||!(auth[32]&1)||!(auth[32]&4)||!rp.every((v,i)=>auth[i]===v))throw Error('Ověření zařízení selhalo.');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',response.clientDataJSON)),signed=new Uint8Array(auth.length+digest.length);signed.set(auth);signed.set(digest,auth.length);
 const publicKey=await crypto.subtle.importKey('spki',bytes(config.publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signatureBytes(response.signature),signed))throw Error('Ověření zařízení selhalo.');
 return true;
}
export async function unlockDevice(id) { const config=deviceKey(id);if(!config)throw Error('Nejprve nastavte ověření zařízení.');return assertDevice(config); }
