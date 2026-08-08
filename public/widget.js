(function () {
  "use strict";

  var API_URL = (document.currentScript && document.currentScript.getAttribute("data-api")) ||
    "https://seely-deal.vercel.app/api/site-assistant";

  var host = document.createElement("div");
  host.id = "seely-widget-host";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif}" +
    ".fab{position:fixed;bottom:22px;right:22px;width:60px;height:60px;border-radius:50%;" +
    "background:linear-gradient(155deg,#8b7bf7 0%,#6d4de0 45%,#5334c9 100%);" +
    "color:#fff;border:none;cursor:pointer;" +
    "box-shadow:0 10px 24px -6px rgba(83,52,201,.55),0 2px 6px rgba(83,52,201,.35),inset 0 1px 0 rgba(255,255,255,.4),inset 0 -6px 10px rgba(0,0,0,.12);" +
    "z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
    "transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s ease;}" +
    ".fab:hover{transform:scale(1.08) translateY(-2px);" +
    "box-shadow:0 14px 28px -6px rgba(83,52,201,.6),0 4px 10px rgba(83,52,201,.4),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -6px 10px rgba(0,0,0,.12);}" +
    ".fab:active{transform:scale(.96)}" +
    ".fab svg{width:26px;height:26px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.15))}" +
    ".panel{position:fixed;bottom:96px;right:22px;width:360px;max-width:calc(100vw - 32px);height:520px;" +
    "max-height:calc(100vh - 140px);background:#faf9ff;border-radius:22px;" +
    "box-shadow:0 24px 60px -12px rgba(83,52,201,.35),0 8px 24px rgba(0,0,0,.12);" +
    "display:none;flex-direction:column;overflow:hidden;z-index:2147483000;border:1px solid #e6e2fb;}" +
    ".panel.open{display:flex}" +
    ".hd{background:linear-gradient(135deg,#8b7bf7 0%,#6d4de0 55%,#5334c9 100%);color:#fff;padding:16px 18px;" +
    "display:flex;align-items:center;gap:10px;position:relative;overflow:hidden;}" +
    ".hd::after{content:'';position:absolute;top:-40%;right:-10%;width:120px;height:120px;border-radius:50%;" +
    "background:radial-gradient(circle,rgba(255,255,255,.25) 0%,rgba(255,255,255,0) 70%);pointer-events:none}" +
    ".hd .dot{width:9px;height:9px;border-radius:50%;background:#c9f56b;box-shadow:0 0 0 3px rgba(201,245,107,.3)}" +
    ".hd .t{flex:1}" +
    ".hd .t b{display:block;font-size:14px;font-weight:800}" +
    ".hd .t span{display:block;font-size:11px;color:#e3ddff}" +
    ".hd button{background:none;border:none;color:#e3ddff;cursor:pointer;padding:4px;border-radius:8px;}" +
    ".hd button:hover{background:rgba(255,255,255,.15)}" +
    ".msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#faf9ff}" +
    ".msg{max-width:82%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}" +
    ".msg.bot{background:#fff;border:1px solid #ece8fb;color:#221c3d;align-self:flex-start;border-bottom-left-radius:4px;" +
    "box-shadow:0 1px 2px rgba(83,52,201,.06)}" +
    ".msg.user{background:linear-gradient(135deg,#8b7bf7,#6741e0);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;" +
    "box-shadow:0 2px 6px rgba(103,65,224,.3)}" +
    ".msg.typing{background:#fff;border:1px solid #ece8fb;align-self:flex-start;border-bottom-left-radius:4px;padding:12px 16px}" +
    ".typing span{display:inline-block;width:6px;height:6px;margin:0 1px;background:#a99cee;border-radius:50%;animation:b 1.2s infinite}" +
    ".typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}" +
    "@keyframes b{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +
    ".cta{padding:0 16px 10px;display:flex;gap:8px;flex-wrap:wrap}" +
    ".cta a{font-size:12px;font-weight:700;text-decoration:none;padding:7px 12px;border-radius:999px;" +
    "background:linear-gradient(135deg,#c9f56b,#a9e23d);color:#3a4d0a;white-space:nowrap;" +
    "box-shadow:0 2px 6px rgba(169,226,61,.4)}" +
    ".cta a.secondary{background:#fff;border:1px solid #e0dcf5;color:#5b5470;box-shadow:none}" +
    ".ft{padding:12px;border-top:1px solid #ece8fb;display:flex;gap:8px;background:#fff}" +
    ".ft input{flex:1;border:1px solid #e0dcf5;border-radius:12px;padding:10px 12px;font-size:13.5px;outline:none;color:#221c3d}" +
    ".ft input:focus{border-color:#8b7bf7;box-shadow:0 0 0 3px rgba(139,123,247,.15)}" +
    ".ft button{background:linear-gradient(135deg,#8b7bf7,#6741e0);color:#fff;border:none;border-radius:12px;width:40px;cursor:pointer;" +
    "display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(103,65,224,.35);" +
    "transition:transform .15s ease;}" +
    ".ft button:hover:not(:disabled){transform:scale(1.05)}" +
    ".ft button:disabled{opacity:.4;cursor:default}" +
    "@media (max-width:480px){.panel{right:16px;left:16px;width:auto;bottom:88px}}";
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.innerHTML =
    '<button class="fab" aria-label="AI ile sohbet et">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' +
    '</button>' +
    '<div class="panel">' +
      '<div class="hd"><span class="dot"></span><div class="t"><b>Seely</b><span>seelynow AI asistanı</span></div>' +
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
  var panel = root.querySelector(".panel");
  var closeBtn = root.querySelector(".close");
  var msgsEl = root.querySelector(".msgs");
  var input = root.querySelector(".ft input");
  var sendBtn = root.querySelector(".ft button");

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
    if (!greeted) {
      greeted = true;
      addMsg("bot", "Merhaba! Ben Seely, seelynow'un AI asistanıyım. Otomasyon ihtiyaçların hakkında soru sorabilir ya da direkt bir görüşme ayarlayabilirsin. Nasıl yardımcı olabilirim?");
    }
    input.focus();
  }

  fab.addEventListener("click", function () {
    if (panel.classList.contains("open")) {
      panel.classList.remove("open");
    } else {
      openPanel();
    }
  });
  closeBtn.addEventListener("click", function () { panel.classList.remove("open"); });

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
})();
