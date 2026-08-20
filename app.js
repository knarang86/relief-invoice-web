(function () {
  "use strict";

  var Config = window.InvoiceConfig;
  var Storage = window.InvoiceStorage;

  var state = {
    lastInvoiceNumber: "",
    employers: [],
    invoices: [],
    preferences: { defaultRate: "", defaultOtRate: "" },
    bannerDismissed: false,
    current: emptyDraft(),
  };

  function emptyDraft() {
    return {
      invoiceNumber: "",
      issuedDate: todayIso(),
      employer: "",
      employerAddress: "",
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
      var raw = localStorage.getItem(Config.STORAGE_KEY);
      if (!raw) {
        var legacy = localStorage.getItem("relief-invoice-v1");
        if (legacy) {
          var old = JSON.parse(legacy);
          state = Storage.deserializeState({
            lastInvoiceNumber: old.lastInvoiceNumber,
            employers: old.employers,
            invoices: migrateInvoices(old.invoices),
            preferences: {
              defaultRate: (old.settings && old.settings.defaultRate) || "",
              defaultOtRate: (old.settings && old.settings.defaultOtRate) || "",
            },
            bannerDismissed: old.bannerDismissed,
          });
          persist();
          return;
        }
        return;
      }
      state = Object.assign(state, Storage.deserializeState(JSON.parse(raw)));
    } catch (err) {
      /* ignore corrupt storage */
    }
  }

  function migrateInvoices(invoices) {
    if (!Array.isArray(invoices)) return [];
    return invoices.map(function (invoice) {
      if (invoice.to && invoice.to.email && !invoice.to.address) {
        invoice.to.address = invoice.to.email;
        delete invoice.to.email;
      }
      return invoice;
    });
  }

  function persist() {
    localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(Storage.serializeState(state)));
  }

  function show(id) {
    ["setup", "editor", "preview"].forEach(function (name) {
      $(name).classList.toggle("hidden", name !== id);
    });
    window.scrollTo(0, 0);
  }

  function fillSettingsForm() {
    $("s-rate").value = state.preferences.defaultRate || "";
    $("s-otRate").value = state.preferences.defaultOtRate || "";
  }

  function readSettingsForm() {
    state.preferences = {
      defaultRate: $("s-rate").value.trim(),
      defaultOtRate: $("s-otRate").value.trim(),
    };
  }

  function defaultRate() {
    return state.preferences.defaultRate || "";
  }

  function senderProfile() {
    return Object.assign({}, Config.PROFILE);
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
    state.current.employerAddress = $("employerAddress").value.trim();
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
      from: senderProfile(),
      to: {
        name: state.current.employer,
        address: state.current.employerAddress,
      },
      shifts: shifts,
      overtime: overtime,
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
    $("employerAddress").value = state.current.employerAddress;
    $("issuedDate").value = state.current.issuedDate || todayIso();
    $("rate").value = state.current.rate || defaultRate();
    $("otHours").value = state.current.otHours;
    $("otRate").value = state.current.otRate || state.preferences.defaultOtRate || "";
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
          "/hr" +
          '</td><td class="num">' +
          escapeHtml(Invoice.formatMoney(line.amount, summary.currency)) +
          "</td></tr>"
        );
      })
      .join("");

    var meta =
      "<p><strong>From:</strong> " +
      escapeHtml(from.name || "") +
      "</p>" +
      (from.email ? "<p><strong>Email:</strong> " + escapeHtml(from.email) + "</p>" : "") +
      (from.phone ? "<p><strong>Phone:</strong> " + escapeHtml(from.phone) + "</p>" : "") +
      "<p><strong>To:</strong> " +
      escapeHtml(to.name || "") +
      "</p>" +
      (to.address ? "<p>" + escapeHtml(to.address) + "</p>" : "") +
      "<p><strong>Date Issued:</strong> " +
      escapeHtml(Invoice.formatDate(invoice.issuedDate)) +
      "</p>" +
      (summary.workPeriod ? "<p><strong>Work Period:</strong> " + escapeHtml(summary.workPeriod) + "</p>" : "") +
      "<p><strong>Payment Method:</strong> " +
      escapeHtml(Config.paymentInstruction()) +
      "</p>";

    $("preview-doc").innerHTML =
      '<h1 class="preview-title">INVOICE</h1>' +
      '<div class="preview-meta">' +
      meta +
      "</div>" +
      '<table class="lines"><thead><tr><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>' +
      rows +
      '<tr class="total-row"><td>Total Due</td><td></td><td></td><td class="num">' +
      escapeHtml(Invoice.formatMoney(summary.total, summary.currency)) +
      "</td></tr></tbody></table>" +
      (invoice.notes ? "<p class='muted' style='margin-top:12px'>" + escapeHtml(invoice.notes) + "</p>" : "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function saveInvoice(invoice) {
    state.lastInvoiceNumber = invoice.invoiceNumber;
    state.invoices = Storage.upsertInvoice(state.invoices, invoice);
    state.employers = Storage.rememberEmployer(state.employers, invoice.to && invoice.to.name);
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
      $("setup-error").textContent = "";
      persist();
      show("editor");
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

    ["employer", "employerAddress", "issuedDate", "rate", "otHours", "otRate", "notes"].forEach(function (id) {
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
  startNew();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
