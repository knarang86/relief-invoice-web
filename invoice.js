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

  function dateToIso(date) {
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + day;
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

  function formatWorkPeriod(shifts) {
    var dates = [];
    var i;
    var list = Array.isArray(shifts) ? shifts : [];
    for (i = 0; i < list.length; i += 1) {
      var parsed = parseLocalDate(list[i].date);
      if (parsed) dates.push(parsed);
    }
    if (!dates.length) return "";
    dates.sort(function (a, b) {
      return a - b;
    });
    var first = dates[0];
    var last = dates[dates.length - 1];
    if (first.getTime() === last.getTime()) {
      return formatDate(dateToIso(first));
    }
    var sameMonth =
      first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
    if (sameMonth) {
      return (
        first.toLocaleDateString("en-CA", { month: "long", day: "numeric" }) +
        "-" +
        last.getDate() +
        ", " +
        last.getFullYear()
      );
    }
    return formatDate(dateToIso(first)) + " – " + formatDate(dateToIso(last));
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
    var regularHours = 0;
    var regularRate = 0;
    var i;

    for (i = 0; i < shifts.length; i += 1) {
      var shift = shifts[i];
      var hours = Number(shift.hours || 0);
      var rate = Number(shift.rate || 0);
      if (!shift.date && hours <= 0) continue;
      regularHours = roundMoney(regularHours + hours);
      if (rate > 0) regularRate = rate;
    }

    if (regularHours > 0) {
      lines.push({
        label: "Regular Hours",
        hours: regularHours,
        rate: regularRate,
        amount: lineAmount(regularHours, regularRate),
      });
    }

    var overtime = invoice && invoice.overtime;
    if (overtime && Number(overtime.hours) > 0) {
      lines.push({
        label: "Overtime Hours",
        hours: Number(overtime.hours),
        rate: Number(overtime.rate || 0),
        amount: lineAmount(overtime.hours, overtime.rate),
      });
    }

    var subtotal = 0;
    for (i = 0; i < lines.length; i += 1) {
      subtotal = roundMoney(subtotal + lines[i].amount);
    }

    return {
      lines: lines,
      subtotal: subtotal,
      total: subtotal,
      workPeriod: formatWorkPeriod(shifts),
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
    formatWorkPeriod: formatWorkPeriod,
    nextInvoiceNumber: nextInvoiceNumber,
    lineAmount: lineAmount,
    summarizeInvoice: summarizeInvoice,
    invoiceFilename: invoiceFilename,
  };
});
