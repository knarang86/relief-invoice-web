(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./config.js"));
  } else {
    root.InvoiceStorage = factory(root.InvoiceConfig);
  }
})(typeof self !== "undefined" ? self : this, function (Config) {
  "use strict";

  function trimList(list, limit) {
    return Array.isArray(list) ? list.slice(0, limit) : [];
  }

  function serializeState(state) {
    return {
      lastInvoiceNumber: state.lastInvoiceNumber || "",
      employers: trimList(state.employers, Config.EMPLOYER_CHIP_LIMIT),
      invoices: trimList(state.invoices, Config.RECENT_INVOICE_LIMIT),
      profile: {
        name: state.profile && state.profile.name ? state.profile.name : "",
        email: state.profile && state.profile.email ? state.profile.email : "",
        phone: state.profile && state.profile.phone ? state.profile.phone : "",
        paymentEmail: state.profile && state.profile.paymentEmail ? state.profile.paymentEmail : "",
      },
      preferences: {
        defaultRate: state.preferences && state.preferences.defaultRate ? state.preferences.defaultRate : "",
        defaultOtRate: state.preferences && state.preferences.defaultOtRate ? state.preferences.defaultOtRate : "",
      },
      bannerDismissed: Boolean(state.bannerDismissed),
    };
  }

  function deserializeState(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        lastInvoiceNumber: "",
        employers: [],
        invoices: [],
        profile: {
          name: "",
          email: "",
          phone: "",
          paymentEmail: "",
        },
        preferences: { defaultRate: "", defaultOtRate: "" },
        bannerDismissed: false,
      };
    }

    return {
      lastInvoiceNumber: raw.lastInvoiceNumber || "",
      employers: Array.isArray(raw.employers) ? raw.employers : [],
      invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
      profile: {
        name: (raw.profile && raw.profile.name) || "",
        email: (raw.profile && raw.profile.email) || "",
        phone: (raw.profile && raw.profile.phone) || "",
        paymentEmail: (raw.profile && raw.profile.paymentEmail) || "",
      },
      preferences: {
        defaultRate: (raw.preferences && raw.preferences.defaultRate) || "",
        defaultOtRate: (raw.preferences && raw.preferences.defaultOtRate) || "",
      },
      bannerDismissed: Boolean(raw.bannerDismissed),
    };
  }

  function rememberEmployer(employers, name, limit) {
    if (!name) return employers || [];
    var max = limit || Config.EMPLOYER_CHIP_LIMIT;
    return [name].concat(
      (employers || []).filter(function (item) {
        return item !== name;
      })
    ).slice(0, max);
  }

  function upsertInvoice(invoices, invoice, limit) {
    var max = limit || Config.RECENT_INVOICE_LIMIT;
    var next = [invoice].concat(
      (invoices || []).filter(function (item) {
        return item.invoiceNumber !== invoice.invoiceNumber;
      })
    );
    return next.slice(0, max);
  }

  return {
    trimList: trimList,
    serializeState: serializeState,
    deserializeState: deserializeState,
    rememberEmployer: rememberEmployer,
    upsertInvoice: upsertInvoice,
  };
});
