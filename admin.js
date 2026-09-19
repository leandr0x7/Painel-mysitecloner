(function () {
  "use strict";

  const cfg = window.MSC_ADMIN_CONFIG || {};
  const API = cfg.API_URL;
  const ANON = cfg.ANON_KEY;
  const REFRESH_MS = Number(cfg.REFRESH_MS) || 30000;
  const SECRET_KEY = "msc_admin_secret";
  const LIVE_KEY = "msc_admin_live";
  const MONTH_DAYS = { 1: 30, 3: 90, 5: 150, 12: 365 };

  const els = {
    loginCard: document.getElementById("loginCard"),
    dashCard: document.getElementById("dashCard"),
    topMeta: document.getElementById("topMeta"),
    adminSecret: document.getElementById("adminSecret"),
    loginBtn: document.getElementById("loginBtn"),
    loginMsg: document.getElementById("loginMsg"),
    stats: document.getElementById("stats"),
    licenseList: document.getElementById("licenseList"),
    licenseCount: document.getElementById("licenseCount"),
    searchInput: document.getElementById("searchInput"),
    filterType: document.getElementById("filterType"),
    refreshBtn: document.getElementById("refreshBtn"),
    createEmail: document.getElementById("createEmail"),
    createType: document.getElementById("createType"),
    createQuota: document.getElementById("createQuota"),
    createMonths: document.getElementById("createMonths"),
    createDays: document.getElementById("createDays"),
    createNotes: document.getElementById("createNotes"),
    quotaField: document.getElementById("quotaField"),
    monthsField: document.getElementById("monthsField"),
    daysField: document.getElementById("daysField"),
    createLicenseBtn: document.getElementById("createLicenseBtn"),
    copyLastKeyBtn: document.getElementById("copyLastKeyBtn"),
    createMsg: document.getElementById("createMsg"),
    createKeyOut: document.getElementById("createKeyOut"),
    checkoutStarter: document.getElementById("checkoutStarter"),
    checkoutLifetime: document.getElementById("checkoutLifetime"),
    productStarter: document.getElementById("productStarter"),
    productLifetime: document.getElementById("productLifetime"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    settingsMsg: document.getElementById("settingsMsg"),
    lastUpdated: document.getElementById("lastUpdated"),
    liveToggle: document.getElementById("liveToggle"),
    logoutBtn: document.getElementById("logoutBtn"),
  };

  let liveTimer = null;
  let refreshing = false;
  let lastCreatedKey = "";
  let allLicenses = [];

  function getSecret() {
    return localStorage.getItem(SECRET_KEY) || "";
  }
  function setSecret(v) {
    localStorage.setItem(SECRET_KEY, v);
  }
  function clearSecret() {
    localStorage.removeItem(SECRET_KEY);
  }
  function isLiveEnabled() {
    const stored = localStorage.getItem(LIVE_KEY);
    if (stored == null) return true;
    return stored === "1";
  }
  function setLiveEnabled(on) {
    localStorage.setItem(LIVE_KEY, on ? "1" : "0");
  }

  function formatNow() {
    try {
      return new Date().toLocaleString("pt-BR");
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function setLastUpdated(ok) {
    if (!els.lastUpdated) return;
    els.lastUpdated.textContent = ok
      ? "Atualizado: " + formatNow()
      : "Falha · " + formatNow();
  }

  function planLabel(billing) {
    const b = String(billing || "").toLowerCase();
    if (b === "starter") return { text: "Teste", cls: "is-test" };
    if (b === "monthly") return { text: "Mensal", cls: "is-month" };
    return { text: "Vitalício", cls: "is-pro" };
  }

  function statusLabel(status) {
    const s = String(status || "").toLowerCase();
    if (s === "active") return { text: "Ativa", cls: "is-active" };
    if (s === "pending") return { text: "Pendente", cls: "is-pending" };
    if (s === "expired") return { text: "Expirada", cls: "is-bad" };
    if (s === "revoked" || s === "refunded") return { text: s, cls: "is-bad" };
    return { text: s || "—", cls: "" };
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return String(value).slice(0, 16);
    }
  }

  function formatExpiry(expiresAt) {
    if (!expiresAt) return "Sem expiração";
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return d.toLocaleDateString("pt-BR");
    } catch (_) {
      return String(expiresAt).slice(0, 10);
    }
  }

  function expiresInDays(days) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d.toISOString();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(action, payload) {
    if (!API || !ANON) throw new Error("config.js incompleto");
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: "Bearer " + ANON,
        "x-admin-secret": getSecret(),
      },
      body: JSON.stringify({ action, ...(payload || {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error((data && (data.message || data.error)) || "Falha na API admin");
    }
    return data;
  }

  function usageText(lic) {
    const used = Number(lic.quota_used || 0);
    if (lic.quota_limit == null) return used + " usos · ∞";
    return used + " / " + lic.quota_limit + " clones";
  }

  function originMeta(lic) {
    const source = String(lic.source || "").toLowerCase();
    if (source === "cakto") {
      return {
        text: lic.origin_label || "Cakto · compra",
        cls: "is-cakto",
      };
    }
    return {
      text: lic.origin_label || "Manual / admin",
      cls: "is-manual",
    };
  }

  function renderStats(stats) {
    const items = [
      ["Total", stats.total],
      ["Ativas", stats.active],
      ["Pendentes", stats.pending],
      ["Teste", stats.starter],
      ["Mensal", stats.monthly],
      ["Vitalício", stats.lifetime],
      ["Cakto", stats.from_cakto],
      ["Manual", stats.from_manual],
      ["Dispositivos", stats.devices],
      ["Clones usados", stats.clones_used],
    ];
    els.stats.innerHTML = items
      .map(
        ([label, value]) =>
          `<div class="stat"><b>${value ?? 0}</b><span>${label}</span></div>`
      )
      .join("");
  }

  function filteredLicenses() {
    const q = String(els.searchInput.value || "").trim().toLowerCase();
    const f = els.filterType.value;
    return allLicenses.filter((lic) => {
      if (f === "starter" && lic.billing_type !== "starter") return false;
      if (f === "monthly" && lic.billing_type !== "monthly") return false;
      if (f === "lifetime" && lic.billing_type !== "lifetime") return false;
      if (f === "cakto" && lic.source !== "cakto") return false;
      if (f === "manual" && lic.source !== "manual") return false;
      if (f === "active" && !(Number(lic.devices_active || 0) > 0)) return false;
      if (!q) return true;
      const hay = [
        lic.email,
        lic.license_key,
        lic.customer_name,
        lic.notes,
        lic.cakto_order_id,
      ]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function renderLicenses() {
    const list = filteredLicenses();
    els.licenseCount.textContent = list.length + " de " + allLicenses.length;
    if (!list.length) {
      els.licenseList.innerHTML =
        '<div class="empty">Nenhuma licença encontrada com esse filtro.</div>';
      return;
    }

    els.licenseList.innerHTML = list
      .map((lic) => {
        const plan = planLabel(lic.billing_type);
        const st = statusLabel(lic.status);
        const origin = originMeta(lic);
        const keyRaw = String(lic.license_key || "");
        const keyAttr = keyRaw.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const devices = Number(lic.devices_active || 0);
        const name = lic.customer_name ? " · " + escapeHtml(lic.customer_name) : "";
        const notes = lic.notes
          ? `<p class="lic-notes">${escapeHtml(lic.notes)}</p>`
          : "";
        return `<article class="lic-card">
          <div class="lic-top">
            <span class="plan-tag ${plan.cls}">${plan.text}</span>
            <span class="status-tag ${st.cls}">${escapeHtml(st.text)}</span>
            <span class="origin-tag ${origin.cls}">${escapeHtml(origin.text)}</span>
          </div>
          <p class="lic-email">${escapeHtml(lic.email || "Sem e-mail")}${name}</p>
          <div class="lic-key">${escapeHtml(keyRaw)}</div>
          <div class="lic-grid">
            <div class="lic-field"><span>Uso</span><b>${escapeHtml(usageText(lic))}</b></div>
            <div class="lic-field"><span>Dispositivos</span><b>${devices} ativo(s)</b></div>
            <div class="lic-field"><span>Expira</span><b>${escapeHtml(formatExpiry(lic.expires_at))}</b></div>
            <div class="lic-field"><span>Último uso</span><b>${escapeHtml(formatDateTime(lic.last_seen_at))}</b></div>
            <div class="lic-field"><span>Criada</span><b>${escapeHtml(formatDateTime(lic.created_at))}</b></div>
            <div class="lic-field"><span>Ativada</span><b>${escapeHtml(formatDateTime(lic.first_activated_at))}</b></div>
            <div class="lic-field"><span>Pedido Cakto</span><b>${escapeHtml(lic.cakto_order_id || "—")}</b></div>
            <div class="lic-field"><span>Produto</span><b>${escapeHtml(String(lic.cakto_product_id || "—").slice(0, 13))}${lic.cakto_product_id ? "…" : ""}</b></div>
          </div>
          ${notes}
          <div class="actions">
            <button type="button" class="small" data-act="copy" data-key="${keyAttr}">Copiar</button>
            <button type="button" class="small" data-act="add-quota" data-key="${keyAttr}">+ Testes</button>
            <button type="button" class="small" data-act="upgrade" data-key="${keyAttr}">Virar Pro</button>
            <button type="button" class="small" data-act="reset" data-key="${keyAttr}">Zerar uso</button>
            <button type="button" class="small danger" data-act="revoke" data-key="${keyAttr}">Revogar</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function syncCreateFields() {
    const type = els.createType.value;
    const isStarter = type === "starter";
    const isMonthly = type === "monthly";
    els.quotaField.hidden = !isStarter;
    els.monthsField.hidden = !isMonthly;
    els.daysField.hidden = !(isMonthly && els.createMonths.value === "custom");
  }

  function showCreatedKey(key, detail) {
    lastCreatedKey = key || "";
    els.createKeyOut.hidden = !lastCreatedKey;
    els.createKeyOut.textContent = lastCreatedKey
      ? "Chave: " + lastCreatedKey + (detail ? " · " + detail : "")
      : "";
    els.copyLastKeyBtn.hidden = !lastCreatedKey;
    els.createMsg.textContent = lastCreatedKey ? "Licença criada." : "";
    els.createMsg.style.color = "var(--ok)";
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const [statsRes, listRes, settingsRes] = await Promise.all([
        api("stats"),
        api("list_licenses", { limit: 300 }),
        api("get_settings"),
      ]);
      renderStats(statsRes.stats || {});
      allLicenses = listRes.licenses || [];
      renderLicenses();
      const s = settingsRes.settings || {};
      els.checkoutStarter.value = s.checkout_url_starter || "";
      els.checkoutLifetime.value = s.checkout_url_lifetime || "";
      els.productStarter.value = s.cakto_product_starter_id || "";
      els.productLifetime.value =
        s.cakto_product_lifetime_id || s.cakto_product_user_id || "";
      setLastUpdated(true);
    } catch (err) {
      setLastUpdated(false);
      throw err;
    } finally {
      refreshing = false;
    }
  }

  function stopLive() {
    if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
  }
  function startLive() {
    stopLive();
    if (!isLiveEnabled() || els.dashCard.hidden) return;
    liveTimer = setInterval(() => {
      refresh().catch(() => {});
    }, REFRESH_MS);
  }
  function showDashboard() {
    els.loginCard.hidden = true;
    els.dashCard.hidden = false;
    els.topMeta.hidden = false;
    els.liveToggle.checked = isLiveEnabled();
    syncCreateFields();
    startLive();
  }
  function showLogin() {
    stopLive();
    els.dashCard.hidden = true;
    els.topMeta.hidden = true;
    els.loginCard.hidden = false;
  }
  function logout() {
    clearSecret();
    els.adminSecret.value = "";
    els.loginMsg.textContent = "";
    showLogin();
  }

  els.loginBtn.addEventListener("click", async () => {
    els.loginMsg.textContent = "Validando…";
    setSecret(els.adminSecret.value.trim());
    try {
      await api("stats");
      showDashboard();
      await refresh();
      els.loginMsg.textContent = "";
    } catch (err) {
      clearSecret();
      els.loginMsg.textContent = err.message || String(err);
    }
  });
  els.adminSecret.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.loginBtn.click();
    }
  });
  els.refreshBtn.addEventListener("click", () => {
    refresh().catch((e) => alert(e.message));
  });
  els.liveToggle.addEventListener("change", () => {
    setLiveEnabled(els.liveToggle.checked);
    if (els.liveToggle.checked) startLive();
    else stopLive();
  });
  els.logoutBtn.addEventListener("click", logout);
  els.createType.addEventListener("change", syncCreateFields);
  els.createMonths.addEventListener("change", syncCreateFields);
  els.searchInput.addEventListener("input", renderLicenses);
  els.filterType.addEventListener("change", renderLicenses);

  els.createLicenseBtn.addEventListener("click", async () => {
    els.createMsg.style.color = "var(--warn)";
    const email = String(els.createEmail.value || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0) {
      els.createMsg.textContent = "Informe um e-mail válido.";
      return;
    }
    const type = els.createType.value;
    const notesExtra = String(els.createNotes.value || "").trim();
    let payload = { email: email, source: "manual", notes: notesExtra || "Admin painel" };
    let detail = "";
    try {
      if (type === "starter") {
        const quota = Math.max(1, Number(els.createQuota.value) || 1);
        payload.billing_type = "starter";
        payload.quota_limit = quota;
        payload.notes = (notesExtra || "Admin · teste") + " · " + quota + " clone(s)";
        detail = quota + " clone(s)";
      } else if (type === "monthly") {
        const monthsSel = els.createMonths.value;
        const days =
          monthsSel === "custom"
            ? Math.max(1, Number(els.createDays.value) || 30)
            : MONTH_DAYS[monthsSel] || 30;
        payload.billing_type = "monthly";
        payload.quota_limit = null;
        payload.expires_at = expiresInDays(days);
        payload.notes = (notesExtra || "Admin · mensal") + " · +" + days + " dias";
        detail = "+" + days + " dias · até " + formatExpiry(payload.expires_at);
      } else {
        payload.billing_type = "lifetime";
        payload.quota_limit = null;
        payload.notes = notesExtra || "Admin · vitalício";
        detail = "vitalício";
      }
      els.createMsg.textContent = "Gerando…";
      const data = await api("create_license", payload);
      const key =
        (data.license &&
          (data.license.license_key ||
            (Array.isArray(data.license) &&
              data.license[0] &&
              data.license[0].license_key))) ||
        "";
      if (!key) throw new Error("API não retornou a chave");
      showCreatedKey(key, detail);
      await refresh();
    } catch (e) {
      els.createMsg.style.color = "var(--danger)";
      els.createMsg.textContent = e.message || String(e);
    }
  });

  els.copyLastKeyBtn.addEventListener("click", async () => {
    await copyText(lastCreatedKey);
    els.createMsg.style.color = "var(--ok)";
    els.createMsg.textContent = "Chave copiada.";
  });

  els.saveSettingsBtn.addEventListener("click", async () => {
    els.settingsMsg.textContent = "Salvando…";
    try {
      await api("update_settings", {
        settings: {
          checkout_url_starter: els.checkoutStarter.value.trim(),
          checkout_url_lifetime: els.checkoutLifetime.value.trim(),
          cakto_product_starter_id: els.productStarter.value.trim(),
          cakto_product_lifetime_id: els.productLifetime.value.trim(),
          cakto_product_user_id: els.productLifetime.value.trim(),
        },
      });
      els.settingsMsg.textContent = "Settings salvas.";
    } catch (e) {
      els.settingsMsg.textContent = e.message;
    }
  });

  els.licenseList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const key = btn.getAttribute("data-key");
    const act = btn.getAttribute("data-act");
    try {
      if (act === "copy") {
        await copyText(key);
        return;
      }
      if (act === "add-quota") {
        const raw = prompt("Quantos testes extras adicionar?", "2");
        if (raw == null) return;
        const amount = Math.max(1, Math.min(100, parseInt(raw, 10) || 2));
        const data = await api("add_quota", { license_key: key, amount: amount });
        alert(
          "+" +
            amount +
            " teste(s).\nRestantes agora: " +
            (data.remaining != null ? data.remaining : "?")
        );
      }
      if (act === "revoke") {
        if (!confirm("Revogar " + key + "?")) return;
        await api("revoke_license", { license_key: key, reason: "admin_panel" });
      }
      if (act === "upgrade") {
        await api("upgrade_lifetime", { license_key: key, reason: "admin_panel" });
      }
      if (act === "reset") {
        const lic = allLicenses.find((l) => l.license_key === key);
        const limit =
          lic && lic.quota_limit != null ? Number(lic.quota_limit) : 3;
        await api("set_quota", {
          license_key: key,
          quota_used: 0,
          quota_limit: limit,
        });
      }
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopLive();
    else if (!els.dashCard.hidden && isLiveEnabled()) startLive();
  });

  els.liveToggle.checked = isLiveEnabled();
  syncCreateFields();

  if (getSecret()) {
    els.adminSecret.value = getSecret();
    api("stats")
      .then(async () => {
        showDashboard();
        await refresh();
      })
      .catch(() => {
        clearSecret();
        showLogin();
      });
  }
})();
