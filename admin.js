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
    licenseRows: document.getElementById("licenseRows"),
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
      return new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function setLastUpdated(ok) {
    if (!els.lastUpdated) return;
    els.lastUpdated.textContent = ok
      ? "Última atualização: " + formatNow()
      : "Falha ao atualizar · " + formatNow();
  }

  function planLabel(billing) {
    const b = String(billing || "").toLowerCase();
    if (b === "starter") {
      return { text: "MySiteCloner - Teste", cls: "is-test" };
    }
    if (b === "monthly") {
      return { text: "MySiteCloner - Pro (mensal)", cls: "is-month" };
    }
    return { text: "MySiteCloner - Pro", cls: "is-pro" };
  }

  function formatExpiry(expiresAt) {
    if (!expiresAt) return "—";
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

  async function api(action, payload) {
    if (!API || !ANON) {
      throw new Error("config.js incompleto");
    }
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
      throw new Error(
        (data && (data.message || data.error)) || "Falha na API admin"
      );
    }
    return data;
  }

  function renderStats(stats) {
    const items = [
      ["Total", stats.total],
      ["Ativas", stats.active],
      ["Teste", stats.starter],
      ["Pro", stats.lifetime],
      ["Mensal", stats.monthly],
      ["Cakto", stats.from_cakto],
    ];
    els.stats.innerHTML = items
      .map(
        ([label, value]) =>
          `<div class="stat"><b>${value ?? 0}</b><span>${label}</span></div>`
      )
      .join("");
  }

  function quotaLabel(lic) {
    if (lic.quota_limit == null) return "∞";
    return `${lic.quota_used || 0}/${lic.quota_limit}`;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderLicenses(list) {
    els.licenseRows.innerHTML = (list || [])
      .map((lic) => {
        const plan = planLabel(lic.billing_type);
        const keyRaw = String(lic.license_key || "");
        const keyAttr = keyRaw.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const keyHtml = escapeHtml(keyRaw);
        return `<tr>
          <td><code>${keyHtml}</code></td>
          <td><span class="plan-tag ${plan.cls}">${plan.text}</span></td>
          <td>${escapeHtml(lic.status)}</td>
          <td>${quotaLabel(lic)}</td>
          <td>${escapeHtml(formatExpiry(lic.expires_at))}</td>
          <td>${escapeHtml(lic.email || "—")}</td>
          <td class="actions">
            <button type="button" data-act="copy" data-key="${keyAttr}">Copiar</button>
            <button type="button" data-act="upgrade" data-key="${keyAttr}">Pro</button>
            <button type="button" data-act="reset" data-key="${keyAttr}">Reset quota</button>
            <button type="button" class="danger" data-act="revoke" data-key="${keyAttr}">Revogar</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function syncCreateFields() {
    const type = els.createType.value;
    const isStarter = type === "starter";
    const isMonthly = type === "monthly";
    els.quotaField.hidden = !isStarter;
    els.monthsField.hidden = !isMonthly;
    const custom = isMonthly && els.createMonths.value === "custom";
    els.daysField.hidden = !custom;
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
        api("list_licenses", { limit: 200 }),
        api("get_settings"),
      ]);
      renderStats(statsRes.stats || {});
      renderLicenses(listRes.licenses || []);
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
      refresh().catch(() => {
        /* keep polling; status shown in lastUpdated */
      });
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

  els.createLicenseBtn.addEventListener("click", async () => {
    els.createMsg.style.color = "var(--warn)";
    const email = String(els.createEmail.value || "").trim().toLowerCase();
    if (!email || email.indexOf("@") < 0) {
      els.createMsg.textContent = "Informe um e-mail válido.";
      return;
    }

    const type = els.createType.value;
    const notesExtra = String(els.createNotes.value || "").trim();
    let payload = {
      email: email,
      source: "manual",
      notes: notesExtra || "Admin painel",
    };
    let detail = "";

    try {
      if (type === "starter") {
        const quota = Math.max(1, Number(els.createQuota.value) || 1);
        payload.billing_type = "starter";
        payload.quota_limit = quota;
        payload.notes =
          (notesExtra || "Admin · teste") + " · " + quota + " clone(s)";
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
        payload.notes =
          (notesExtra || "Admin · mensal") + " · +" + days + " dias";
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

  els.licenseRows.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const key = btn.getAttribute("data-key");
    const act = btn.getAttribute("data-act");
    try {
      if (act === "copy") {
        await copyText(key);
        return;
      }
      if (act === "revoke") {
        if (!confirm("Revogar " + key + "?")) return;
        await api("revoke_license", { license_key: key, reason: "admin_panel" });
      }
      if (act === "upgrade") {
        await api("upgrade_lifetime", {
          license_key: key,
          reason: "admin_panel",
        });
      }
      if (act === "reset") {
        await api("set_quota", {
          license_key: key,
          quota_used: 0,
          quota_limit: 3,
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
