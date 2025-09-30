window.addEventListener('DOMContentLoaded', () => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const cryptoObj = window.crypto;

  // UI
  const seedInput = document.getElementById('wallet-seed');
  const btnCreateAll = document.getElementById('create-all-keys-btn');
  const btnGenerate = document.getElementById('btn-generate');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const statusMsg = document.getElementById('status-msg');

  // Helpers
  const buf2b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b642buf = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const readFileAsText = (file) => file.text();
  const downloadJSON = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Local app secret
  const APP_SECRET_KEY = 'evay_app_secret_v1';
  function ensureAppSecret() {
    let s = localStorage.getItem(APP_SECRET_KEY);
    if (s) return b642buf(s);
    const secret = cryptoObj.getRandomValues(new Uint8Array(32));
    localStorage.setItem(APP_SECRET_KEY, buf2b64(secret));
    return secret;
  }
  const APP_SECRET = ensureAppSecret();

  // Crypto helpers
  async function deriveBits(password, salt, iterations = 150000) {
    const pwKey = await cryptoObj.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return cryptoObj.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, pwKey, 256);
  }
  async function importAesKeyFromBits(bits) {
    return cryptoObj.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function aesEncrypt(key, plaintext) {
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const ct = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return { iv: buf2b64(iv), ciphertext: buf2b64(ct) };
  }
  async function aesDecrypt(key, obj) {
    const iv = b642buf(obj.iv);
    const ct = b642buf(obj.ciphertext);
    const pt = await cryptoObj.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return dec.decode(pt);
  }
  async function hmacSignWithRawKey(rawKeyBuf, msg) {
    const key = await cryptoObj.subtle.importKey('raw', rawKeyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await cryptoObj.subtle.sign('HMAC', key, enc.encode(msg));
    return buf2b64(sig);
  }
  async function hmacVerifyWithRawKey(rawKeyBuf, msg, sigB64) {
    const key = await cryptoObj.subtle.importKey('raw', rawKeyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return cryptoObj.subtle.verify('HMAC', key, b642buf(sigB64), enc.encode(msg));
  }
  async function sha256b64(str) {
    const h = await cryptoObj.subtle.digest('SHA-256', enc.encode(str));
    return buf2b64(h);
  }

  // Create three keys
  async function createThreeKeys(seedText, accessPIN, rescuePIN) {
    const masterKeyRaw = cryptoObj.getRandomValues(new Uint8Array(32));
    const masterAesKey = await cryptoObj.subtle.importKey('raw', masterKeyRaw.buffer, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
    const encryptedSeed = await aesEncrypt(masterAesKey, seedText);
    const masterHash = await sha256b64(encryptedSeed.ciphertext);
    const masterPayload = { format: 'evay-master-v1', created_at: new Date().toISOString(), encrypted_seed: encryptedSeed, master_hash: masterHash };

    const saltRescue = cryptoObj.getRandomValues(new Uint8Array(16));
    const derivedBitsRescue = await deriveBits(rescuePIN, saltRescue);
    const aesKeyRescue = await importAesKeyFromBits(derivedBitsRescue);
    const innerRescue = { masterKeyRawB64: buf2b64(masterKeyRaw.buffer), master_hash: masterHash };
    const encMasterKeyObj = await aesEncrypt(aesKeyRescue, JSON.stringify(innerRescue));
    const rescuePayloadNoHmac = { format: 'evay-rescue-v1', created_at: new Date().toISOString(), salt: buf2b64(saltRescue), encrypted_master_key: encMasterKeyObj };
    const rescueHmac = await hmacSignWithRawKey(derivedBitsRescue, JSON.stringify(rescuePayloadNoHmac));
    const rescuePayload = { ...rescuePayloadNoHmac, hmac: rescueHmac };

    const saltAccess = cryptoObj.getRandomValues(new Uint8Array(16));
    const derivedBitsAccess = await deriveBits(accessPIN, saltAccess);
    const aesKeyAccess = await importAesKeyFromBits(derivedBitsAccess);
    const accessTokenObj = { token: 'access-' + Math.random().toString(36).slice(2,12), permissions: ['view','submit-idea'], hint: seedText ? (seedText.slice(0,8)+'...') : null };
    const encAccessObj = await aesEncrypt(aesKeyAccess, JSON.stringify(accessTokenObj));
    const accessPayloadNoHmac = { format: 'evay-access-v1', created_at: new Date().toISOString(), salt: buf2b64(saltAccess), encrypted_token: encAccessObj };
    const accessHmac = await hmacSignWithRawKey(derivedBitsAccess, JSON.stringify(accessPayloadNoHmac));
    const accessPayload = { ...accessPayloadNoHmac, hmac: accessHmac };
    const localSig = await hmacSignWithRawKey(APP_SECRET, JSON.stringify(accessPayload));
    const finalAccess = { ...accessPayload, local_hmac: localSig };

    downloadJSON(masterPayload, 'master.key');
    downloadJSON(rescuePayload, 'rescue.key');
    downloadJSON(finalAccess, 'access.key');

    return { masterPayload, rescuePayload, finalAccess };
  }

  // Validate access.key
  async function validateAndLoginAccessKey(obj) {
    try {
      if (!obj.format || !obj.format.startsWith('evay-access')) throw new Error('Formato inválido');
      if (!obj.local_hmac) throw new Error('Arquivo não assinado localmente');
      const ok = await hmacVerifyWithRawKey(APP_SECRET, JSON.stringify({
        format: obj.format, created_at: obj.created_at,
        salt: obj.salt, encrypted_token: obj.encrypted_token, hmac: obj.hmac
      }), obj.local_hmac).catch(()=>false);
      const ok2 = ok || await hmacVerifyWithRawKey(APP_SECRET, JSON.stringify(obj), obj.local_hmac).catch(()=>false);
      if (!ok2) throw new Error('Falha na verificação local (arquivo não gerado aqui)');
      sessionStorage.setItem('evay_token','local-'+Math.random().toString(36).slice(2,8));
      if(obj.hint) sessionStorage.setItem('evay_hint', obj.hint);
      window.location.href = 'app.html';
    } catch(err){ console.error(err); alert('Chave inválida: '+(err.message||err)); }
  }

  // Dropzone & file input
  if(dropZone){
    dropZone.addEventListener('click',()=>fileInput&&fileInput.click());
    dropZone.addEventListener('dragover',e=>{ e.preventDefault(); dropZone.classList.add('hover'); statusMsg.textContent='Solte o arquivo aqui'; });
    dropZone.addEventListener('dragleave',()=>{ dropZone.classList.remove('hover'); statusMsg.textContent=''; });
    dropZone.addEventListener('drop', async(e)=>{
      e.preventDefault(); dropZone.classList.remove('hover'); statusMsg.textContent='Processando arquivo...';
      const f = e.dataTransfer?.files?.[0]; if(!f){ statusMsg.textContent='Nenhum arquivo detectado'; return; }
      try { const txt = await readFileAsText(f); const obj = JSON.parse(txt); fileInfo.textContent=`Arquivo: ${f.name}`; await validateAndLoginAccessKey(obj); }
      catch(err){ console.error(err); statusMsg.textContent='Erro ao processar o arquivo: '+(err.message||''); }
    });
    if(fileInput) fileInput.addEventListener('change', async(e)=>{
      const f = e.target.files?.[0]; if(!f) return; statusMsg.textContent='Arquivo selecionado...';
      try { const txt = await readFileAsText(f); const obj = JSON.parse(txt); fileInfo.textContent=`Arquivo: ${f.name}`; await validateAndLoginAccessKey(obj); }
      catch(err){ console.error(err); statusMsg.textContent='Erro ao ler arquivo: '+(err.message||''); }
      finally{ fileInput.value=''; }
    });
  }

  // Quick TXT generator
  if(btnGenerate) btnGenerate.addEventListener('click',()=>{
    const words = ["Evaw","Neura","Crypto","Node","Block","Seed","Wallet","Login","Secure","Data"];
    const shuffled = words.sort(()=>Math.random()-0.5).join("-");
    const blob = new Blob([shuffled],{type:'text/plain'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='evaw_access.txt'; a.click(); URL.revokeObjectURL(a.href);
    statusMsg.textContent='Arquivo de acesso rápido gerado!'; setTimeout(()=>statusMsg.textContent='',3000);
  });

  // Create-all keys button
  if(btnCreateAll) btnCreateAll.addEventListener('click', async()=>{
    try{
      statusMsg.textContent='Gerando chaves...';
      const seed = (seedInput?.value?.trim())||Math.random().toString(36).slice(2,12);
      const accessPIN = Math.floor(1000+Math.random()*9000).toString();
      const rescuePIN = Math.random().toString(36).slice(2,10);
      await createThreeKeys(seed, accessPIN, rescuePIN);
      statusMsg.textContent='Chaves geradas e baixadas.';
    } catch(err){ console.error(err); statusMsg.textContent='Erro ao gerar chaves: '+(err.message||''); }
    finally{ setTimeout(()=>statusMsg.textContent='',3000); }
  });
});

