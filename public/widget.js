(function () {
  "use strict";

  var API_URL = (document.currentScript && document.currentScript.getAttribute("data-api")) ||
    "https://seely-deal.vercel.app/api/site-assistant";
  // Site-bazlı tema: script tagine data-theme="dark" eklenen sitelerde widget
  // koyu/neon (mor #8B5CF6 → siyan #06B6D4) görünür. Eklenmezse (varsayılan
  // SeelyDeal müşterileri) mevcut açık/glass tasarım hiç değişmeden kalır.
  var theme = (document.currentScript && document.currentScript.getAttribute("data-theme")) || "light";

  var host = document.createElement("div");
  host.id = "seely-widget-host";
  if (theme !== "light") host.className = theme;
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif}" +
    ".fab{position:fixed;bottom:22px;right:22px;width:52px;height:52px;border-radius:16px;" +
    "background:#fff;color:#4B3DE0;border:1px solid #E3DFFA;cursor:pointer;" +
    "box-shadow:0 1px 2px rgba(32,27,61,.04),0 12px 28px -8px rgba(32,27,61,.16);" +
    "z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
    "transition:transform .22s cubic-bezier(.22,1,.36,1),box-shadow .22s ease,border-color .22s ease;}" +
    ".fab:hover{transform:translateY(-2px);border-color:#C9BFFF;" +
    "box-shadow:0 1px 2px rgba(32,27,61,.05),0 16px 32px -8px rgba(32,27,61,.2);}" +
    ".fab:active{transform:translateY(0) scale(.97)}" +
    ".fab svg{width:22px;height:22px}" +
    /* small live status dot, top-right of the bubble — quiet "we're online" signal
       instead of a heavy glow/ring around the whole button. */
    ".fabdot{position:fixed;bottom:58px;right:24px;width:10px;height:10px;border-radius:50%;" +
    "background:#22c55e;border:2px solid #fff;box-shadow:0 0 0 0 rgba(34,197,94,.5);" +
    "animation:fabdot 2s ease-in-out infinite;z-index:2147483001;pointer-events:none;}" +
    "@keyframes fabdot{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)}}" +
    "@keyframes dotpulse{0%,100%{opacity:1}50%{opacity:.45}}" +
    /* Apple/macOS-Sonoma-style frosted glass: translucent white over a blurred
       backdrop of whatever page sits behind the widget, plus a soft inset
       highlight along the top edge for the "light catching glass" look. Stays
       always in the layout (position:fixed, so no reflow) and opens/closes via
       opacity+scale+visibility instead of display:none so the transition is a
       smooth fade/lift rather than a hard cut. */
    ".panel{position:fixed;bottom:96px;right:22px;width:360px;max-width:calc(100vw - 32px);height:520px;" +
    "max-height:calc(100vh - 140px);background:rgba(255,255,255,.72);" +
    "backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);border-radius:22px;" +
    "box-shadow:0 24px 60px -12px rgba(75,61,224,.28),0 8px 24px rgba(0,0,0,.10),inset 0 1px 0 rgba(255,255,255,.7);" +
    "display:flex;flex-direction:column;overflow:hidden;z-index:2147483000;border:1px solid rgba(255,255,255,.55);" +
    "opacity:0;visibility:hidden;pointer-events:none;transform:translateY(16px) scale(.96);" +
    "transition:opacity .28s cubic-bezier(.22,1,.36,1),transform .28s cubic-bezier(.22,1,.36,1),visibility 0s linear .28s;}" +
    ".panel.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1);" +
    "transition:opacity .28s cubic-bezier(.22,1,.36,1),transform .28s cubic-bezier(.22,1,.36,1),visibility 0s linear 0s;}" +
    ".fab.hidden,.fabdot.hidden{display:none}" +
    ".hd{background:rgba(255,255,255,.7);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);" +
    "color:#201B3D;padding:16px 18px;display:flex;align-items:center;gap:10px;position:relative;overflow:hidden;" +
    "border-bottom:1px solid rgba(75,61,224,.08);}" +
    ".hd::after{content:'';position:absolute;top:-40%;right:-10%;width:120px;height:120px;border-radius:50%;" +
    "background:radial-gradient(circle,rgba(75,61,224,.10) 0%,rgba(75,61,224,0) 70%);pointer-events:none}" +
    ".hd .dot{width:9px;height:9px;border-radius:50%;background:#6C5CE8;box-shadow:0 0 0 3px rgba(108,92,232,.25);animation:dotpulse 2s ease-in-out infinite}" +
    ".hd .t{flex:1}" +
    ".hd .t b{display:block;font-size:14px;font-weight:800;color:#201B3D}" +
    ".hd .t span{display:block;font-size:11px;color:#5B5480}" +
    ".hd button{background:none;border:none;color:#5B5480;cursor:pointer;padding:4px;border-radius:8px;transition:background .15s ease;}" +
    ".hd button:hover{background:rgba(75,61,224,.08)}" +
    ".msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:rgba(255,255,255,.32)}" +
    ".msg{max-width:82%;padding:10px 13px;border-radius:18px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}" +
    ".msg.bot{background:#fff;border:none;color:#201B3D;align-self:flex-start;border-bottom-left-radius:6px;" +
    "box-shadow:0 4px 20px rgba(32,27,61,.06)}" +
    ".msg.user{background:linear-gradient(135deg,#6C5CE8,#4B3DE0);color:#fff;align-self:flex-end;border-bottom-right-radius:6px;" +
    "box-shadow:0 2px 6px rgba(75,61,224,.3)}" +
    ".msg.typing{background:#fff;border:none;align-self:flex-start;border-bottom-left-radius:6px;padding:12px 16px;" +
    "box-shadow:0 4px 20px rgba(32,27,61,.06)}" +
    ".typing span{display:inline-block;width:6px;height:6px;margin:0 1px;background:#9C8CE0;border-radius:50%;animation:b 1.2s infinite}" +
    ".typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}" +
    "@keyframes b{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +
    ".cta{padding:0 16px 10px;display:flex;gap:8px;flex-wrap:wrap}" +
    ".cta a{font-size:12px;font-weight:700;text-decoration:none;padding:7px 12px;border-radius:999px;" +
    "background:linear-gradient(135deg,#6C5CE8,#4B3DE0);color:#fff;white-space:nowrap;" +
    "box-shadow:0 2px 6px rgba(75,61,224,.35)}" +
    ".cta a.secondary{background:#fff;border:1px solid #E3DFFA;color:#5B5480;box-shadow:none}" +
    ".ft{padding:12px;border-top:1px solid rgba(75,61,224,.08);display:flex;gap:8px;background:rgba(255,255,255,.55);" +
    "backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}" +
    ".ft input{flex:1;background:rgba(241,245,249,.6);border:1px solid transparent;border-radius:12px;padding:10px 12px;" +
    "font-size:13.5px;outline:none;color:#201B3D;transition:background .15s ease,box-shadow .15s ease;}" +
    ".ft input:focus{background:#fff;box-shadow:0 0 0 3px rgba(75,61,224,.15)}" +
    ".ft button{background:linear-gradient(135deg,#6C5CE8,#4B3DE0);color:#fff;border:none;border-radius:12px;width:40px;cursor:pointer;" +
    "display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(75,61,224,.35);" +
    "transition:transform .15s ease;}" +
    ".ft button:hover:not(:disabled){transform:scale(1.05)}" +
    ".ft button:disabled{opacity:.4;cursor:default}" +
    "@media (max-width:480px){.panel{right:16px;left:16px;width:auto;bottom:88px}}" +
    // ---- dark/neon tema (site-bazlı, host.dark) — leinDigital referanslı
    // koyu tema (#030305 zemin, mor #8B5CF6 / siyan #06B6D4 aksan) ile aynı dil.
    ":host(.dark) .fab{background:#0A0A0C;color:#06B6D4;border:1px solid rgba(255,255,255,.12);" +
    "box-shadow:0 1px 2px rgba(0,0,0,.3),0 12px 28px -8px rgba(139,92,246,.35);}" +
    ":host(.dark) .fab:hover{border-color:rgba(139,92,246,.5);" +
    "box-shadow:0 1px 2px rgba(0,0,0,.3),0 16px 32px -8px rgba(6,182,212,.45);}" +
    ":host(.dark) .panel{background:rgba(10,10,12,.82);" +
    "box-shadow:0 24px 60px -12px rgba(139,92,246,.35),0 8px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08);" +
    "border:1px solid rgba(255,255,255,.1);}" +
    ":host(.dark) .hd{background:rgba(255,255,255,.04);color:#F2F1F5;border-bottom:1px solid rgba(255,255,255,.1);}" +
    ":host(.dark) .hd::after{background:radial-gradient(circle,rgba(139,92,246,.22) 0%,rgba(139,92,246,0) 70%);}" +
    ":host(.dark) .hd .dot{background:#06B6D4;box-shadow:0 0 0 3px rgba(6,182,212,.25);}" +
    ":host(.dark) .hd .t b{color:#F2F1F5}" +
    ":host(.dark) .hd .t span{color:#9B99A8}" +
    ":host(.dark) .hd button{color:#9B99A8}" +
    ":host(.dark) .hd button:hover{background:rgba(255,255,255,.08)}" +
    ":host(.dark) .msgs{background:rgba(255,255,255,.02)}" +
    ":host(.dark) .msg.bot{background:rgba(255,255,255,.06);color:#F2F1F5;box-shadow:none;border:1px solid rgba(255,255,255,.08)}" +
    ":host(.dark) .msg.user{background:linear-gradient(135deg,#8B5CF6,#06B6D4);color:#fff;box-shadow:0 2px 10px rgba(139,92,246,.35)}" +
    ":host(.dark) .msg.typing{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);box-shadow:none}" +
    ":host(.dark) .typing span{background:#8B5CF6}" +
    ":host(.dark) .cta a{background:linear-gradient(135deg,#8B5CF6,#06B6D4);box-shadow:0 2px 10px rgba(139,92,246,.35)}" +
    ":host(.dark) .cta a.secondary{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#F2F1F5}" +
    ":host(.dark) .ft{background:rgba(255,255,255,.03);border-top:1px solid rgba(255,255,255,.1)}" +
    ":host(.dark) .ft input{background:rgba(255,255,255,.06);color:#F2F1F5}" +
    ":host(.dark) .ft input::placeholder{color:#9B99A8}" +
    ":host(.dark) .ft input:focus{background:rgba(255,255,255,.09);box-shadow:0 0 0 3px rgba(139,92,246,.25)}" +
    ":host(.dark) .ft button{background:linear-gradient(135deg,#8B5CF6,#06B6D4);box-shadow:0 2px 10px rgba(139,92,246,.35)}" +
    // ---- seelydeal tema (host.seelydeal) — SeelyDeal'in 2026 "Glassmorphism
    // Techwave" landing page'iyle aynı dil: koyu lacivert zemin (#080C14),
    // frosted glass yüzeyler, indigo→violet marka gradyanı, siyan AI vurgusu.
    ":host(.seelydeal) .fabdot{background:#10B981;box-shadow:0 0 0 0 rgba(16,185,129,.5)}" +
    ":host(.seelydeal) .fab{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;border:1px solid rgba(255,255,255,.12);" +
    "box-shadow:0 1px 2px rgba(0,0,0,.3),0 12px 28px -8px rgba(79,70,229,.45);}" +
    ":host(.seelydeal) .fab:hover{border-color:rgba(34,211,238,.5);" +
    "box-shadow:0 1px 2px rgba(0,0,0,.3),0 16px 32px -8px rgba(34,211,238,.4);}" +
    ":host(.seelydeal) .panel{background:rgba(8,12,20,.85);" +
    "box-shadow:0 24px 60px -12px rgba(79,70,229,.35),0 8px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08);" +
    "border:1px solid rgba(255,255,255,.08);}" +
    ":host(.seelydeal) .hd{background:rgba(255,255,255,.04);color:#F8FAFC;border-bottom:1px solid rgba(255,255,255,.08);}" +
    ":host(.seelydeal) .hd::after{background:radial-gradient(circle,rgba(79,70,229,.24) 0%,rgba(79,70,229,0) 70%);}" +
    ":host(.seelydeal) .hd .dot{background:#22D3EE;box-shadow:0 0 0 3px rgba(34,211,238,.25);}" +
    ":host(.seelydeal) .hd .t b{color:#F8FAFC}" +
    ":host(.seelydeal) .hd .t span{color:#94A3B8}" +
    ":host(.seelydeal) .hd button{color:#94A3B8}" +
    ":host(.seelydeal) .hd button:hover{background:rgba(255,255,255,.08)}" +
    ":host(.seelydeal) .msgs{background:rgba(255,255,255,.02)}" +
    ":host(.seelydeal) .msg.bot{background:rgba(255,255,255,.06);color:#F8FAFC;box-shadow:none;border:1px solid rgba(255,255,255,.08)}" +
    ":host(.seelydeal) .msg.user{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,.4)}" +
    ":host(.seelydeal) .msg.typing{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);box-shadow:none}" +
    ":host(.seelydeal) .typing span{background:#818CF8}" +
    ":host(.seelydeal) .cta a{background:linear-gradient(135deg,#4F46E5,#7C3AED);box-shadow:0 2px 10px rgba(79,70,229,.4)}" +
    ":host(.seelydeal) .cta a.secondary{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#F8FAFC}" +
    ":host(.seelydeal) .ft{background:rgba(255,255,255,.03);border-top:1px solid rgba(255,255,255,.08)}" +
    ":host(.seelydeal) .ft input{background:rgba(255,255,255,.06);color:#F8FAFC}" +
    ":host(.seelydeal) .ft input::placeholder{color:#94A3B8}" +
    ":host(.seelydeal) .ft input:focus{background:rgba(255,255,255,.09);box-shadow:0 0 0 3px rgba(79,70,229,.3)}" +
    ":host(.seelydeal) .ft button{background:linear-gradient(135deg,#4F46E5,#7C3AED);box-shadow:0 2px 10px rgba(79,70,229,.4)}";
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.innerHTML =
    '<span class="fabdot"></span>' +
    '<button class="fab" aria-label="AI ile sohbet et">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' +
    '</button>' +
    '<div class="panel">' +
      '<div class="hd"><span class="dot"></span><div class="t"><b>seelynow destek</b><span>AI asistanı</span></div>' +
      '<button class="close" aria-label="Kapat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<div class="msgs"></div>' +
      '<div class="cta">' +
        '<a href="https://calendly.com/seelynow/tanisma-gorusmesi" target="_blank" rel="noopener">Görüşme ayarla</a>' +
        '<a class="secondary" href="mailto:info@seelynow.com">Mail at</a>' +
      '</div>' +
      '<div class="ft"><input type="text" placeholder="Bir şey sor..." /><button aria-label="Gönder">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
      '</button></div>' +
    '</div>';
  root.appendChild(wrap);

  var fab = root.querySelector(".fab");
  var fabdot = root.querySelector(".fabdot");
  var panel = root.querySelector(".panel");
  var closeBtn = root.querySelector(".close");
  var msgsEl = root.querySelector(".msgs");
  var input = root.querySelector(".ft input");
  var sendBtn = root.querySelector(".ft button");

  // iOS Safari doesn't resize `position:fixed` elements when the software
  // keyboard opens — it keeps them pinned to the *layout* viewport, so the
  // panel (and the CTA row above the input) ends up partly hidden behind the
  // keyboard, and Safari's compositor leaves a smeared/ghosted frame of that
  // stale content floating above the keyboard's own accessory bar. Track the
  // real visible area via visualViewport and push the panel above the
  // keyboard instead of trusting the CSS `bottom` alone.
  var mqMobile = window.matchMedia("(max-width:480px)");
  function repositionForKeyboard() {
    if (!window.visualViewport) return;
    var vv = window.visualViewport;
    var keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    var baseBottom = mqMobile.matches ? 88 : 96;
    panel.style.bottom = baseBottom + keyboardInset + "px";
    panel.style.maxHeight = "calc(" + vv.height + "px - " + (baseBottom + keyboardInset + 24) + "px)";
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", repositionForKeyboard);
    window.visualViewport.addEventListener("scroll", repositionForKeyboard);
  }
  input.addEventListener("focus", function () {
    repositionForKeyboard();
    // iOS reports the shrunk viewport a beat after focus fires — resample.
    setTimeout(repositionForKeyboard, 60);
    setTimeout(repositionForKeyboard, 350);
  });
  input.addEventListener("blur", function () {
    setTimeout(repositionForKeyboard, 60);
  });

  var history = [];
  var greeted = false;

  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "msg " + (role === "user" ? "user" : "bot");
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  function addTyping() {
    var el = document.createElement("div");
    el.className = "msg typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  function openPanel() {
    panel.classList.add("open");
    fab.classList.add("hidden");
    fabdot.classList.add("hidden");
    repositionForKeyboard();
    if (!greeted) {
      greeted = true;
      addMsg("bot", "Merhaba! Ben Seely, seelynow ajansının AI asistanıyım. Otomasyon ihtiyaçların hakkında soru sorabilir ya da direkt bir görüşme ayarlayabilirsin. Nasıl yardımcı olabilirim?");
    }
    input.focus();
  }

  function closePanel() {
    panel.classList.remove("open");
    fab.classList.remove("hidden");
    fabdot.classList.remove("hidden");
  }

  fab.addEventListener("click", function () {
    if (panel.classList.contains("open")) {
      closePanel();
    } else {
      openPanel();
    }
  });
  closeBtn.addEventListener("click", closePanel);

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendBtn.disabled = true;
    addMsg("user", text);
    history.push({ role: "user", content: text });
    var typingEl = addTyping();

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typingEl.remove();
        var reply = data.reply || "Şu an cevap veremiyorum, direkt mail atabilirsin: info@seelynow.com";
        addMsg("bot", reply);
        history.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        typingEl.remove();
        addMsg("bot", "Bağlantı sorunu yaşadım. info@seelynow.com adresine yazabilirsin.");
      })
      .finally(function () { sendBtn.disabled = false; });
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });

  window.SeelyWidget = { open: openPanel };
  window.dispatchEvent(new CustomEvent("seely:ready"));
})();
