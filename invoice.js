(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Invoice = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value, currency) {
    var amount = roundMoney(value);
    var code = currency || "CAD";
    try {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: code,
      }).format(amount);
    } catch (err) {
      return "$" + amount.toFixed(2);
    }
  }

  function parseLocalDate(iso) {
    if (!iso) return null;
    var parts = String(iso).split("-");
    if (parts.length !== 3) return null;
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function formatDate(iso) {
    var date = parseLocalDate(iso);
    if (!date) return "";
    return date.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function padInvoiceSeq(seq) {
    return String(seq).padStart(3, "0");
  }

  function nextInvoiceNumber(previous, now) {
    var today = now || new Date();
    var year = today.getFullYear();
    var prev = String(previous || "");
    var match = /^(\d{4})-(\d+)$/.exec(prev);
    var seq = 1;
    if (match && Number(match[1]) === year) {
      seq = Number(match[2]) + 1;
    }
    return year + "-" + padInvoiceSeq(seq);
  }

  function lineAmount(hours, rate) {
    return roundMoney(Number(hours || 0) * Number(rate || 0));
  }

  function summarizeInvoice(invoice) {
    var shifts = Array.isArray(invoice && invoice.shifts) ? invoice.shifts : [];
    var lines = [];
    var i;

    for (i = 0; i < shifts.length; i += 1) {
      var shift = shifts[i];
      var hours = Number(shift.hours || 0);
      var rate = Number(shift.rate || 0);
      if (!shift.date && hours <= 0) continue;
      lines.push({
        label: formatDate(shift.date) || "Shift",
        hours: hours,
        rate: rate,
        amount: lineAmount(hours, rate),
      });
    }

    var overtime = invoice && invoice.overtime;
    if (overtime && Number(overtime.hours) > 0) {
      lines.push({
        label: "Overtime",
        hours: Number(overtime.hours),
        rate: Number(overtime.rate || 0),
        amount: lineAmount(overtime.hours, overtime.rate),
      });
    }

    var subtotal = 0;
    for (i = 0; i < lines.length; i += 1) {
      subtotal = roundMoney(subtotal + lines[i].amount);
    }

    var taxRate = Number((invoice && invoice.taxRate) || 0);
    var tax = roundMoney(subtotal * (taxRate / 100));
    var total = roundMoney(subtotal + tax);

    return {
      lines: lines,
      subtotal: subtotal,
      taxRate: taxRate,
      tax: tax,
      total: total,
      currency: (invoice && invoice.currency) || "CAD",
    };
  }

  function invoiceFilename(invoice) {
    var number = (invoice && invoice.invoiceNumber) || "invoice";
    var employer = ((invoice && invoice.to && invoice.to.name) || "invoice")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return "Invoice-" + number + (employer ? "-" + employer : "") + ".pdf";
  }

  return {
    roundMoney: roundMoney,
    formatMoney: formatMoney,
    formatDate: formatDate,
    nextInvoiceNumber: nextInvoiceNumber,
    lineAmount: lineAmount,
    summarizeInvoice: summarizeInvoice,
    invoiceFilename: invoiceFilename,
  };
});
