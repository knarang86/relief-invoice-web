(function () {
  "use strict";

  var STORAGE_KEY = "relief-invoice-v1";

  var state = {
    settings: {
      name: "",
      email: "",
      phone: "",
      address: "",
      taxNumber: "",
      taxRate: 0,
      defaultRate: "",
      defaultOtRate: "",
      paymentEmail: "",
    },
    lastInvoiceNumber: "",
    employers: [],
    invoices: [],
    current: emptyDraft(),
    bannerDismissed: false,
  };

  function emptyDraft() {
    return {
      invoiceNumber: "",
      issuedDate: todayIso(),
      employer: "",
      employerEmail: "",
      shifts: [{ date: todayIso(), hours: "8", rate: "" }],
      otHours: "",
      otRate: "",
      notes: "",
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      state.settings = Object.assign(state.settings, saved.settings || {});
      state.lastInvoiceNumber = saved.lastInvoiceNumber || "";
      state.employers = saved.employers || [];
      state.invoices = saved.invoices || [];
      state.bannerDismissed = Boolean(saved.bannerDismissed);
    } catch (err) {
      /* ignore corrupt storage */
    }
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: state.settings,
        lastInvoiceNumber: state.lastInvoiceNumber,
        employers: state.employers.slice(0, 8),
        invoices: state.invoices.slice(0, 12),
        bannerDismissed: state.bannerDismissed,
      })
    );
  }

  function show(id) {
    ["setup", "editor", "preview"].forEach(function (name) {
      $(name).classList.toggle("hidden", name !== id);
    });
    window.scrollTo(0, 0);
  }

  function fillSettingsForm() {
    $("s-name").value = state.settings.name || "";
    $("s-email").value = state.settings.email || "";
    $("s-phone").value = state.settings.phone || "";
    $("s-address").value = state.settings.address || "";
    $("s-taxNumber").value = state.settings.taxNumber || "";
    $("s-taxRate").value = state.settings.taxRate || "";
    $("s-rate").value = state.settings.defaultRate || "";
    $("s-otRate").value = state.settings.defaultOtRate || "";
    $("s-payEmail").value = state.settings.paymentEmail || state.settings.email || "";
  }

  function readSettingsForm() {
    state.settings = {
      name: $("s-name").value.trim(),
      email: $("s-email").value.trim(),
      phone: $("s-phone").value.trim(),
      address: $("s-address").value.trim(),
      taxNumber: $("s-taxNumber").value.trim(),
      taxRate: Number($("s-taxRate").value || 0),
      defaultRate: $("s-rate").value.trim(),
      defaultOtRate: $("s-otRate").value.trim(),
      paymentEmail: $("s-payEmail").value.trim(),
    };
  }

  function defaultRate() {
    return state.settings.defaultRate || "";
  }

  function renderShifts() {
    var box = $("shifts");
    box.innerHTML = "";
    state.current.shifts.forEach(function (shift, index) {
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<div><span class="field-label">Date</span><input type="date" data-field="date" value="' +
        (shift.date || "") +
        '"></div>' +
        '<div><span class="field-label">Hours</span><input inputmode="decimal" data-field="hours" value="' +
        (shift.hours || "") +
        '"></div>' +
        '<button type="button" class="remove" aria-label="Remove day">✕</button>';
      row.querySelectorAll("input").forEach(function (input) {
        input.addEventListener("input", function () {
          state.current.shifts[index][input.getAttribute("data-field")] = input.value;
          updateTotal();
        });
      });
      row.querySelector(".remove").addEventListener("click", function () {
        if (state.current.shifts.length === 1) return;
        state.current.shifts.splice(index, 1);
        renderShifts();
        updateTotal();
      });
      box.appendChild(row);
    });
  }

  function renderEmployers() {
    var box = $("employers");
    box.innerHTML = "";
    state.employers.forEach(function (name) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = name;
      chip.addEventListener("click", function () {
        $("employer").value = name;
        state.current.employer = name;
        updateTotal();
      });
      box.appendChild(chip);
    });
  }

  function renderRecent() {
    var box = $("recent");
    var wrap = $("recent-wrap");
    box.innerHTML = "";
    if (!state.invoices.length) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    state.invoices.forEach(function (invoice, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      var summary = Invoice.summarizeInvoice(invoice);
      btn.innerHTML =
        "<strong>#" +
        invoice.invoiceNumber +
        " · " +
        (invoice.to && invoice.to.name ? invoice.to.name : "Invoice") +
        "</strong><div class='muted'>" +
        Invoice.formatMoney(summary.total, summary.currency) +
        "</div>";
      btn.addEventListener("click", function () {
        openSavedInvoice(index);
      });
      box.appendChild(btn);
    });
  }

  function collectDraft() {
    state.current.employer = $("employer").value.trim();
    state.current.employerEmail = $("employerEmail").value.trim();
    state.current.issuedDate = $("issuedDate").value || todayIso();
    state.current.notes = $("notes").value.trim();
    state.current.otHours = $("otHours").value.trim();
    state.current.otRate = $("otRate").value.trim();
    state.current.rate = $("rate").value.trim();
  }

  function buildInvoiceFromDraft() {
    collectDraft();
    var rate = Number(state.current.rate || defaultRate() || 0);
    var shifts = state.current.shifts
      .map(function (shift) {
        return {
          date: shift.date,
          hours: Number(shift.hours || 0),
          rate: rate,
        };
      })
      .filter(function (shift) {
        return shift.date || shift.hours > 0;
      });

    var overtime = null;
    if (Number(state.current.otHours) > 0) {
      overtime = {
        hours: Number(state.current.otHours),
        rate: Number(state.current.otRate || rate * 1.5),
      };
    }

    return {
      invoiceNumber: state.current.invoiceNumber || Invoice.nextInvoiceNumber(state.lastInvoiceNumber),
      issuedDate: state.current.issuedDate,
      currency: "CAD",
      from: {
        name: state.settings.name,
        email: state.settings.email,
        phone: state.settings.phone,
        address: state.settings.address,
        taxNumber: state.settings.taxNumber,
        paymentEmail: state.settings.paymentEmail || state.settings.email,
      },
      to: {
        name: state.current.employer,
        email: state.current.employerEmail,
      },
      shifts: shifts,
      overtime: overtime,
      taxRate: Number(state.settings.taxRate || 0),
      notes: state.current.notes,
    };
  }

  function updateTotal() {
    var invoice = buildInvoiceFromDraft();
    var summary = Invoice.summarizeInvoice(invoice);
    $("live-total").textContent = Invoice.formatMoney(summary.total, summary.currency);
    $("preview-btn").disabled = !state.current.employer || summary.lines.length === 0;
  }

  function fillEditor() {
    $("employer").value = state.current.employer;
    $("employerEmail").value = state.current.employerEmail;
    $("issuedDate").value = state.current.issuedDate || todayIso();
    $("rate").value = state.current.rate || defaultRate();
    $("otHours").value = state.current.otHours;
    $("otRate").value = state.current.otRate || state.settings.defaultOtRate || "";
    $("notes").value = state.current.notes;
    renderShifts();
    renderEmployers();
    renderRecent();
    updateTotal();
    $("home-banner").classList.toggle("hidden", state.bannerDismissed || window.navigator.standalone === true);
  }

  function renderPreview(invoice) {
    var summary = Invoice.summarizeInvoice(invoice);
    var from = invoice.from || {};
    var to = invoice.to || {};
    var rows = summary.lines
      .map(function (line) {
        return (
          "<tr><td>" +
          escapeHtml(line.label) +
          '</td><td class="num">' +
          line.hours.toFixed(2) +
          '</td><td class="num">' +
          escapeHtml(Invoice.formatMoney(line.rate, summary.currency)) +
          '</td><td class="num">' +
          escapeHtml(Invoice.formatMoney(line.amount, summary.currency)) +
          "</td></tr>"
        );
      })
      .join("");

    var taxRow =
      summary.taxRate > 0
        ? "<div>Tax (" +
          summary.taxRate +
          "%): " +
          escapeHtml(Invoice.formatMoney(summary.tax, summary.currency)) +
          "</div>"
        : "";

    var payTo = from.paymentEmail || from.email;
    var pay = payTo
      ? '<div class="pay-box">Please pay by Interac e-Transfer to ' + escapeHtml(payTo) + "</div>"
      : "";

    $("preview-doc").innerHTML =
      '<div class="preview-top"><div><h1>INVOICE</h1></div><div class="muted">#' +
      escapeHtml(invoice.invoiceNumber) +
      "<br>Date: " +
      escapeHtml(Invoice.formatDate(invoice.issuedDate)) +
      "</div></div>" +
      '<div class="cols"><div><h3>FROM</h3><strong>' +
      escapeHtml(from.name || "") +
      "</strong><div class='muted'>" +
      [from.email, from.phone, from.address, from.taxNumber ? "GST/HST " + from.taxNumber : ""]
        .filter(Boolean)
        .map(escapeHtml)
        .join("<br>") +
      "</div></div><div><h3>BILL TO</h3><strong>" +
      escapeHtml(to.name || "") +
      "</strong><div class='muted'>" +
      escapeHtml(to.email || "") +
      "</div></div></div>" +
      '<table class="lines"><thead><tr><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<div class="totals"><div>Subtotal: ' +
      escapeHtml(Invoice.formatMoney(summary.subtotal, summary.currency)) +
      "</div>" +
      taxRow +
      "<div><strong>Total: " +
      escapeHtml(Invoice.formatMoney(summary.total, summary.currency)) +
      "</strong></div></div>" +
      (invoice.notes ? "<p class='muted'>" + escapeHtml(invoice.notes) + "</p>" : "") +
      pay;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rememberEmployer(name) {
    if (!name) return;
    state.employers = [name].concat(
      state.employers.filter(function (item) {
        return item !== name;
      })
    );
  }

  function saveInvoice(invoice) {
    state.lastInvoiceNumber = invoice.invoiceNumber;
    state.invoices = [invoice].concat(
      state.invoices.filter(function (item) {
        return item.invoiceNumber !== invoice.invoiceNumber;
      })
    );
    rememberEmployer(invoice.to && invoice.to.name);
    persist();
  }

  function openSavedInvoice(index) {
    var invoice = state.invoices[index];
    if (!invoice) return;
    state.current.invoiceNumber = invoice.invoiceNumber;
    state.previewInvoice = invoice;
    renderPreview(invoice);
    show("preview");
  }

  async function sharePdf() {
    var invoice = state.previewInvoice;
    if (!invoice) return;
    $("share-error").textContent = "";
    try {
      var blob = InvoicePdf.createPdfBlob(invoice);
      var filename = Invoice.invoiceFilename(invoice);
      var file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return;
      }
      downloadBlob(blob, filename);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      try {
        var fallback = InvoicePdf.createPdfBlob(invoice);
        downloadBlob(fallback, Invoice.invoiceFilename(invoice));
      } catch (inner) {
        $("share-error").textContent = "Could not create the PDF. Try Print, then Save as PDF.";
      }
    }
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function startNew() {
    state.current = emptyDraft();
    state.current.rate = defaultRate();
    state.current.invoiceNumber = Invoice.nextInvoiceNumber(state.lastInvoiceNumber);
    fillEditor();
    show("editor");
  }

  function bind() {
    $("save-settings").addEventListener("click", function () {
      readSettingsForm();
      if (!state.settings.name) {
        $("setup-error").textContent = "Add your name so it can appear on the invoice.";
        return;
      }
      $("setup-error").textContent = "";
      persist();
      startNew();
    });

    $("open-settings").addEventListener("click", function () {
      fillSettingsForm();
      show("setup");
    });

    $("add-shift").addEventListener("click", function () {
      state.current.shifts.push({ date: todayIso(), hours: "8", rate: defaultRate() });
      renderShifts();
      updateTotal();
    });

    ["employer", "employerEmail", "issuedDate", "rate", "otHours", "otRate", "notes"].forEach(function (id) {
      $(id).addEventListener("input", updateTotal);
    });

    $("preview-btn").addEventListener("click", function () {
      var invoice = buildInvoiceFromDraft();
      if (!invoice.to.name) return;
      state.current.invoiceNumber = invoice.invoiceNumber;
      state.previewInvoice = invoice;
      saveInvoice(invoice);
      renderPreview(invoice);
      show("preview");
    });

    $("back-edit").addEventListener("click", function () {
      fillEditor();
      show("editor");
    });

    $("share-btn").addEventListener("click", sharePdf);
    $("print-btn").addEventListener("click", function () {
      window.print();
    });
    $("new-btn").addEventListener("click", startNew);
    $("dismiss-banner").addEventListener("click", function () {
      state.bannerDismissed = true;
      persist();
      $("home-banner").classList.add("hidden");
    });
  }

  load();
  bind();
  if (!state.settings.name) {
    fillSettingsForm();
    show("setup");
  } else {
    startNew();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
