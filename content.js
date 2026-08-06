/*
 * RaidX AKTU Copy Downloader — content script
 * Runs on aktuexams.in. Panel appears automatically on the answer-script page,
 * and can be toggled from the extension icon.
 */
(() => {
  if (window.__raidxAktuLoaded) return;
  window.__raidxAktuLoaded = true;

  const IMG_ID_PROBE = 'ctl00_Ajaxmastercontentplaceholder_IMGAS';

  const hasViewer = () => {
    const walk = (d) => {
      if (d.getElementById(IMG_ID_PROBE)) return true;
      return [...d.querySelectorAll('iframe,frame')].some((f) => {
        try { return f.contentDocument && walk(f.contentDocument); } catch (e) { return false; }
      });
    };
    try { return walk(document); } catch (e) { return false; }
  };

  function mountPanel() {

    document.querySelectorAll('#__aktu3').forEach((n) => n.remove());

    const IMG_ID = 'ctl00_Ajaxmastercontentplaceholder_IMGAS';
    const P = 'ctl00$Ajaxmastercontentplaceholder$';
    const TXT = P + 'TxtGoTo', TXT0 = P + 'TxtGoTo0';
    const BTN = P + 'BtnGoTo', TOTAL = P + 'txttotalpagecount';

    /* ---------- ZIP ---------- */
    const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
    const crc32 = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    function buildZip(files) {
      const enc = new TextEncoder(), d = new Date();
      const T = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
      const D = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
      const parts = [], cdir = []; let off = 0;
      for (const f of files) {
        const nb = enc.encode(f.name), crc = crc32(f.data);
        const lh = new Uint8Array(30 + nb.length), v = new DataView(lh.buffer);
        v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
        v.setUint16(10, T, true); v.setUint16(12, D, true); v.setUint32(14, crc, true);
        v.setUint32(18, f.data.length, true); v.setUint32(22, f.data.length, true);
        v.setUint16(26, nb.length, true); lh.set(nb, 30); parts.push(lh, f.data);
        const cd = new Uint8Array(46 + nb.length), c = new DataView(cd.buffer);
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
        c.setUint16(8, 0x0800, true); c.setUint16(12, T, true); c.setUint16(14, D, true);
        c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true);
        c.setUint16(28, nb.length, true); c.setUint32(42, off, true); cd.set(nb, 46);
        cdir.push(cd); off += lh.length + f.data.length;
      }
      const cs = cdir.reduce((a, b) => a + b.length, 0);
      const e = new Uint8Array(22), ev = new DataView(e.buffer);
      ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true);
      ev.setUint16(10, files.length, true); ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
      return new Blob([...parts, ...cdir, e], { type: 'application/zip' });
    }

    /* ---------- PDF ---------- */
    async function toJpeg(blob, q = 0.85) {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
      bmp.close?.();
      const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
      return { data: new Uint8Array(await out.arrayBuffer()), w: c.width, h: c.height };
    }
    function buildPdf(pages) {
      const enc = new TextEncoder(), chunks = []; let len = 0;
      const put = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; chunks.push(u); len += u.length; };
      const offs = [0];
      const obj = (n, b, s) => { offs[n] = len; put(`${n} 0 obj\n${b}\n`); if (s) { put('stream\n'); put(s); put('\nendstream\n'); } put('endobj\n'); };
      put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`);
      pages.forEach((p, i) => {
        const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
        const s = Math.min(595 / p.w, 842 / p.h, 1) || 1;
        const W = Math.round(p.w * s), H = Math.round(p.h * s);
        obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
        const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
        obj(ct, `<< /Length ${cs.length} >>`, cs);
        obj(im, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>`, p.data);
      });
      const total = 2 + pages.length * 3, xref = len;
      let t = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
      for (let n = 1; n <= total; n++) t += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
      put(t); put(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      return new Blob(chunks, { type: 'application/pdf' });
    }

    /* ---------- context ---------- */
    let doc = null, form = null, state = {};
    const urls = new Map();

    function init() {
      doc = null;
      const walk = (d) => {
        if (d.getElementById(IMG_ID)) { doc = d; return true; }
        return [...d.querySelectorAll('iframe,frame')].some((f) => { try { return f.contentDocument && walk(f.contentDocument); } catch (e) { return false; } });
      };
      walk(document);
      if (!doc) { log('❌ answer-script frame not found — open a script and stay on that page'); return false; }
      form = doc.forms[0];
      state = {};
      form.querySelectorAll('input,select,textarea').forEach((el) => {
        if (!el.name) return;
        if (el.type === 'submit' || el.type === 'button' || el.type === 'image') return;
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        state[el.name] = el.value;
      });
      const t = state[TOTAL];
      if (t && +t > 0) $('total').value = +t;
      log(`✅ frame: ${doc.location.pathname.split('/').pop()}\n✅ total pages (server): ${t || '?'}\n✅ current image: ${(doc.getElementById(IMG_ID).getAttribute('src') || '').split('/').pop()}`);
      return true;
    }

    async function goToPage(n) {
      const body = new URLSearchParams();
      for (const [k, v] of Object.entries(state)) body.set(k, v);
      body.set('__EVENTTARGET', '');
      body.set('__EVENTARGUMENT', '');
      body.set('__LASTFOCUS', '');
      body.set(TXT, String(n));
      body.set(TXT0, '');
      body.set(BTN, 'Go');
      const url = new URL(form.getAttribute('action') || doc.location.href, doc.location.href).href;
      const res = await fetch(url, { method: 'POST', credentials: 'include', body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = new DOMParser().parseFromString(await res.text(), 'text/html');
      d.querySelectorAll('input[type=hidden]').forEach((i) => { if (i.name) state[i.name] = i.value; });
      const img = d.getElementById(IMG_ID);
      const src = img && img.getAttribute('src');
      const m = (d.body.textContent || '').match(/(\d+)\s*of\s*(\d+)/);
      return { src: src ? new URL(src, doc.location.href).href : null, reported: m ? +m[1] : null };
    }

    async function test() {
      if (!init()) return;
      try {
        const r = await goToPage(1);
        log(`test page 1 → server says page ${r.reported}\n${r.src ? r.src.split('/').pop() : '❌ no image'}`);
      } catch (e) { log('❌ ' + e.message); }
    }

    const grabbed = new Map(); // page -> Blob (downloaded immediately)

    async function fetchImg(url) {
      const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = await r.blob();
      if (b.size < 1000) throw new Error('too small (' + b.size + 'b)');
      return b;
    }

    async function run() {
      if (!init()) return;
      urls.clear(); grabbed.clear();
      const total = +$('total').value || 36;
      const failed = [];
      for (let n = 1; n <= total; n++) {
        $('st').textContent = `page ${n}/${total}`;
        try {
          const r = await goToPage(n);
          if (!r.src) { log(`⚠️ page ${n}: no image in response`); failed.push(n); continue; }
          urls.set(n, r.src);
          // download RIGHT NOW — the server deletes these temp files quickly
          try {
            grabbed.set(r.reported || n, await fetchImg(r.src));
          } catch (e1) {
            // one retry: re-request the page to regenerate the file
            try {
              const r2 = await goToPage(n);
              grabbed.set(r2.reported || n, await fetchImg(r2.src));
              log(`↻ page ${n} recovered on retry`);
            } catch (e2) { log(`⚠️ page ${n} image: ${e2.message}`); failed.push(n); }
          }
        } catch (e) { log(`⚠️ page ${n}: ${e.message}`); failed.push(n); }
        $('count').textContent = grabbed.size;
      }
      const bytes = [...grabbed.values()].reduce((a, b) => a + b.size, 0);
      log(`✅ downloaded ${grabbed.size}/${total} pages (${(bytes / 1048576).toFixed(1)} MB)` +
          (failed.length ? `\n❌ missing: ${failed.join(', ')} — use Retry missing` : ''));
      window.__aktu3.failed = failed;
    }

    async function retryMissing() {
      const total = +$('total').value || 36;
      const miss = [];
      for (let n = 1; n <= total; n++) if (!grabbed.has(n)) miss.push(n);
      if (!miss.length) return log('nothing missing ✅');
      log('retrying: ' + miss.join(', '));
      if (!init()) return;
      for (const n of miss) {
        $('st').textContent = `retry ${n}`;
        try {
          const r = await goToPage(n);
          if (r.src) grabbed.set(r.reported || n, await fetchImg(r.src));
        } catch (e) { log(`⚠️ ${n} still failing: ${e.message}`); }
        $('count').textContent = grabbed.size;
      }
      log(`now have ${grabbed.size}/${total}`);
    }

    const save = (b, n) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 15000); };

    async function exportAll(kind) {
      const list = [...grabbed.entries()].sort((a, b) => a[0] - b[0]);
      if (!list.length) return log('nothing downloaded — run Fetch all first');
      const files = [], pdf = [];
      for (let i = 0; i < list.length; i++) {
        $('st').textContent = `building ${i + 1}/${list.length}`;
        const [pageNo, blob] = list[i];
        try {
          if (kind === 'zip') files.push({ name: `page_${String(pageNo).padStart(3, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
          else pdf.push(await toJpeg(blob));
        } catch (e) { log(`⚠️ page ${pageNo} unreadable: ${e.message}`); }
      }
      const st = new Date().toISOString().slice(0, 10);
      if (kind === 'zip') save(buildZip(files), `answer-script-${st}.zip`);
      else save(buildPdf(pdf), `answer-script-${st}.pdf`);
      log(`✅ saved ${kind === 'zip' ? files.length : pdf.length} pages`);
      $('st').textContent = 'done';
    }

    /* ---------- UI ---------- */
    const host = document.createElement('div');
    host.id = '__aktu3';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        .p{position:fixed;top:12px;right:12px;width:350px;z-index:2147483647;background:#0b0b0e;color:#e4e4e7;
          border:1px solid #3f3f46;border-radius:10px;padding:12px;box-shadow:0 10px 40px rgba(0,0,0,.5);
          font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
        h2{margin:0 0 8px;font-size:13px;color:#f59e0b;font-family:ui-sans-serif,system-ui,sans-serif}
        button{background:#18181b;color:#e4e4e7;border:1px solid #3f3f46;border-radius:6px;padding:6px 10px;
          cursor:pointer;font:inherit;margin:4px 4px 0 0}
        button:hover{background:#27272a}
        button.p1{background:#f59e0b;border-color:#f59e0b;color:#18181b;font-weight:700}
        input{width:55px;background:#18181b;color:#e4e4e7;border:1px solid #3f3f46;border-radius:5px;padding:4px 6px;font:inherit}
        pre{white-space:pre-wrap;word-break:break-all;margin:8px 0 0;max-height:220px;overflow:auto;
          color:#a1a1aa;font-size:11px;border-top:1px solid #27272a;padding-top:8px}
        .x{float:right;cursor:pointer;color:#71717a}
      </style>
      <div class="p">
        <span class="x" id="close">✕</span>
        <h2>RaidX AKTU Copy Downloader</h2>
        <button id="test">Test page 1</button>
        total <input id="total" value="36">
        <br>
        <button id="run" class="p1">Fetch all pages</button>
        <span id="count">0</span> got · <span id="st">idle</span>
        <br>
        <button id="retry">Retry missing</button>
        <br>
        <button id="pdf" class="p1">Download PDF</button>
        <button id="zip">ZIP</button>
        <pre id="out"></pre>
      </div>`;
    const $ = (i) => root.getElementById(i);
    const log = (m) => { $('out').textContent = m + '\n\n' + $('out').textContent.slice(0, 1800); console.log('[aktu3]\n' + m); };

    $('test').onclick = test;
    $('run').onclick = run;
    $('retry').onclick = retryMissing;
    $('pdf').onclick = () => exportAll('pdf');
    $('zip').onclick = () => exportAll('zip');
    $('close').onclick = () => host.remove();

    document.documentElement.appendChild(host);
    window.__aktu3 = { init, goToPage, run, retryMissing, exportAll, urls, grabbed };
    init();

  }

  // toggle from the extension popup
  chrome.runtime.onMessage.addListener((msg, s, send) => {
    if (msg && msg.type === 'toggle') {
      const existing = document.getElementById('__aktu3');
      if (existing) { existing.remove(); send({ open: false, viewer: hasViewer() }); }
      else { mountPanel(); send({ open: true, viewer: hasViewer() }); }
    }
    if (msg && msg.type === 'status') send({ open: !!document.getElementById('__aktu3'), viewer: hasViewer() });
    return true;
  });

  // auto-mount once the viewer is on screen
  let tries = 0;
  const poll = setInterval(() => {
    if (document.getElementById('__aktu3')) { clearInterval(poll); return; }
    if (hasViewer()) { clearInterval(poll); mountPanel(); }
    if (++tries > 40) clearInterval(poll);
  }, 700);
})();
