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

  function formatDayLabel(iso) {
    var date = parseLocalDate(iso);
    if (!date) return "Hours";
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sept",
      "Oct",
      "Nov",
      "Dec",
    ];
    return months[date.getMonth()] + " " + date.getDate();
  }

  function formatHours(value) {
    var n = Number(value || 0);
    if (!isFinite(n)) n = 0;
    var rounded = roundMoney(n);
    if (rounded === Math.round(rounded)) return String(Math.round(rounded));
    return String(rounded);
  }

  function formatHoursTotal(summary) {
    var bits = [];
    var currency = (summary && summary.currency) || "CAD";
    if (summary && Number(summary.regularHours) > 0) {
      bits.push(
        formatHours(summary.regularHours) + " × " + formatMoney(summary.regularRate, currency)
      );
    }
    if (summary && Number(summary.overtimeHours) > 0) {
      bits.push(
        formatHours(summary.overtimeHours) + " × " + formatMoney(summary.overtimeRate, currency)
      );
    }
    if (!bits.length) return "Total Due";
    return "Total " + bits.join(" + ");
  }

  function formatWorkPeriod(shifts) {
    var dates = [];
    var seen = {};
    var i;
    var list = Array.isArray(shifts) ? shifts : [];
    for (i = 0; i < list.length; i += 1) {
      var iso = list[i].date;
      var parsed = parseLocalDate(iso);
      if (parsed && iso && !seen[iso]) {
        seen[iso] = true;
        dates.push(parsed);
      }
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

  function artistNames(invoice) {
    var from = (invoice && invoice.from) || {};
    if (Array.isArray(from.artists) && from.artists.length) {
      return from.artists
        .map(function (name) {
          return String(name || "").trim();
        })
        .filter(Boolean);
    }
    if (from.name) {
      return String(from.name)
        .split(",")
        .map(function (name) {
          return name.trim();
        })
        .filter(Boolean);
    }
    return [];
  }

  function formatHonorariumLabel(honorarium) {
    var event = honorarium || {};
    var title = String(event.event || "").trim() || "Artist honorarium";
    var dateLabel = formatDate(event.eventDate);
    if (dateLabel) return title + " (" + dateLabel + ")";
    return title;
  }

  function summarizeHonorarium(invoice) {
    var event = (invoice && invoice.honorarium) || {};
    var amount = roundMoney(event.amount || 0);
    var lines = [];
    if (amount > 0 || event.event || event.eventDate) {
      lines.push({
        label: formatHonorariumLabel(event),
        amount: amount,
        taxIncluded: true,
        kind: "honorarium",
      });
    }
    return {
      type: "honorarium",
      lines: lines,
      subtotal: amount,
      total: amount,
      workPeriod: formatDate(event.eventDate),
      currency: (invoice && invoice.currency) || "CAD",
      taxIncluded: true,
      artists: artistNames(invoice),
    };
  }

  function summarizeInvoice(invoice) {
    if (invoice && invoice.type === "honorarium") {
      return summarizeHonorarium(invoice);
    }

    var shifts = Array.isArray(invoice && invoice.shifts) ? invoice.shifts : [];
    var lines = [];
    var regularHours = 0;
    var regularRate = 0;
    var i;

    var showDailyHours = Boolean(invoice && invoice.showDailyHours);

    for (i = 0; i < shifts.length; i += 1) {
      var shift = shifts[i];
      var hours = Number(shift.hours || 0);
      var rate = Number(shift.rate || 0);
      if (!shift.date && hours <= 0) continue;
      regularHours = roundMoney(regularHours + hours);
      if (rate > 0) regularRate = rate;
      if (showDailyHours) {
        lines.push({
          label: formatDayLabel(shift.date),
          hours: hours,
          rate: rate,
          amount: lineAmount(hours, rate),
          kind: "day",
        });
      }
    }

    if (!showDailyHours && regularHours > 0) {
      lines.push({
        label: "Regular Hours",
        hours: regularHours,
        rate: regularRate,
        amount: lineAmount(regularHours, regularRate),
      });
    }

    var overtime = invoice && invoice.overtime;
    var overtimeHours = 0;
    var overtimeRate = 0;
    if (overtime && Number(overtime.hours) > 0) {
      overtimeHours = Number(overtime.hours);
      overtimeRate = Number(overtime.rate || 0);
      lines.push({
        label: "Overtime",
        hours: overtimeHours,
        rate: overtimeRate,
        amount: lineAmount(overtime.hours, overtime.rate),
        kind: "overtime",
      });
    }

    var subtotal = 0;
    for (i = 0; i < lines.length; i += 1) {
      subtotal = roundMoney(subtotal + lines[i].amount);
    }

    var currency = (invoice && invoice.currency) || "CAD";
    var result = {
      type: "hours",
      lines: lines,
      subtotal: subtotal,
      total: subtotal,
      workPeriod: formatWorkPeriod(shifts),
      currency: currency,
      taxIncluded: false,
      showDailyHours: showDailyHours,
      regularHours: regularHours,
      regularRate: regularRate,
      overtimeHours: overtimeHours,
      overtimeRate: overtimeRate,
    };
    result.totalLabel = formatHoursTotal(result);
    return result;
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
    formatDayLabel: formatDayLabel,
    formatHours: formatHours,
    formatHoursTotal: formatHoursTotal,
    formatWorkPeriod: formatWorkPeriod,
    formatHonorariumLabel: formatHonorariumLabel,
    artistNames: artistNames,
    nextInvoiceNumber: nextInvoiceNumber,
    lineAmount: lineAmount,
    summarizeInvoice: summarizeInvoice,
    invoiceFilename: invoiceFilename,
  };
});
