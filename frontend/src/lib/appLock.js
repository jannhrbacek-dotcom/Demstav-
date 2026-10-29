const key = id => `demstav:lock:v1:${id}`;
export function settings(id) { if (!id) return null; const raw=localStorage.getItem(key(id)); if(!raw)return null; try { const s=JSON.parse(raw); if(/^[a-f0-9]{32}$/.test(s.salt)&&/^[a-f0-9]{64}$/.test(s.hash))return s; }catch{} return {invalid:true}; }
const hex = b => [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');
async function hash(password,salt) { const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g),n=>parseInt(n,16)),iterations:600000,hash:'SHA-256'},k,256)); }
export async function verify(id,password) { const s=settings(id);return !!s&&!s.invalid&&await hash(password,s.salt)===s.hash; }
export async function enable(id,password,mode="password") { if(mode==="pin" ? !/^\d{6,12}$/.test(password) : password.length<8)throw Error(mode==='pin'?'PIN musí mít 6 až 12 číslic.':'Heslo musí mít alespoň 8 znaků.'); const salt=hex(crypto.getRandomValues(new Uint8Array(16)));localStorage.setItem(key(id),JSON.stringify({salt,hash:await hash(password,salt),mode}));window.dispatchEvent(new Event('demstav-lock')); }
export function disable(id) {localStorage.removeItem(key(id));window.dispatchEvent(new Event('demstav-lock'));}
