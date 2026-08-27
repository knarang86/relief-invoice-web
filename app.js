(function () {
  "use strict";

  var Config = window.InvoiceConfig;
  var Storage = window.InvoiceStorage;

  var state = {
    lastInvoiceNumber: "",
    employers: [],
    organizers: [],
    artists: [],
    invoices: [],
    profile: Object.assign({}, Config.PROFILE),
    preferences: { defaultRate: "", defaultOtRate: "", invoiceType: "hours", honorariumPaymentEmail: "" },
    bannerDismissed: false,
    current: emptyDraft(),
  };

  function emptyDraft() {
    return {
      type: "hours",
      invoiceNumber: "",
      issuedDate: todayIso(),
      employer: "",
      employerAddress: "",
      shifts: [{ date: todayIso(), hours: "8", rate: "" }],
      otHours: "",
      otRate: "",
      notes: "",
      honorarium: defaultHonorarium(),
    };
  }

  function defaultHonorarium() {
    return {
      event: "",
      eventDate: todayIso(),
      amount: "",
      organizer: "",
      organizerContact: "",
      artists: [""],
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
            profile: {
              name: (old.settings && old.settings.name) || Config.PROFILE.name,
              email: (old.settings && old.settings.email) || Config.PROFILE.email,
              phone: (old.settings && old.settings.phone) || Config.PROFILE.phone,
              paymentEmail:
                (old.settings && (old.settings.paymentEmail || old.settings.email)) ||
                Config.PROFILE.paymentEmail,
            },
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
    updateViewTabs(id);
    window.scrollTo(0, 0);
  }

  function updateViewTabs(id) {
    var tabs = $("view-tabs");
    if (!tabs) return;
    tabs.classList.toggle("hidden", id === "preview");
    ["editor", "setup"].forEach(function (view) {
      var tab = tabs.querySelector('[data-view="' + view + '"]');
      if (tab) tab.classList.toggle("active", id === view);
    });
  }

  function goToSetup() {
    fillSettingsForm();
    show("setup");
  }

  function goToEditor() {
    readSettingsForm();
    if (state.profile.name) {
      $("setup-error").textContent = "";
      persist();
      if ($("rate") && !$("rate").value.trim()) {
        $("rate").value = defaultRate();
      }
    }
    show("editor");
  }

  function fillSettingsForm() {
    $("s-name").value = state.profile.name || Config.PROFILE.name || "";
    $("s-email").value = state.profile.email || Config.PROFILE.email || "";
    $("s-phone").value = state.profile.phone || Config.PROFILE.phone || "";
    $("s-payEmail").value = state.profile.paymentEmail || state.profile.email || Config.PROFILE.paymentEmail || "";
    $("s-rate").value = state.preferences.defaultRate || "";
    $("s-otRate").value = state.preferences.defaultOtRate || "";
  }

  function readSettingsForm() {
    state.profile = {
      name: $("s-name").value.trim() || Config.PROFILE.name,
      email: $("s-email").value.trim() || Config.PROFILE.email,
      phone: $("s-phone").value.trim() || Config.PROFILE.phone,
      paymentEmail: $("s-payEmail").value.trim() || $("s-email").value.trim() || Config.PROFILE.paymentEmail,
    };
    state.preferences = {
      defaultRate: $("s-rate").value.trim(),
      defaultOtRate: $("s-otRate").value.trim(),
      invoiceType: state.preferences.invoiceType === "honorarium" ? "honorarium" : "hours",
      honorariumPaymentEmail: state.preferences.honorariumPaymentEmail || "",
    };
  }

  function honorariumDraft() {
    if (!state.current.honorarium) state.current.honorarium = defaultHonorarium();
    if (!Array.isArray(state.current.honorarium.artists) || !state.current.honorarium.artists.length) {
      state.current.honorarium.artists = [""];
    }
    return state.current.honorarium;
  }

  function setInvoiceType(type) {
    var next = type === "honorarium" ? "honorarium" : "hours";
    state.current.type = next;
    state.preferences.invoiceType = next;
    $("hours-flow").classList.toggle("hidden", next !== "hours");
    $("honorarium-flow").classList.toggle("hidden", next !== "honorarium");
    $("type-hours").classList.toggle("active", next === "hours");
    $("type-honorarium").classList.toggle("active", next === "honorarium");
  }

  function currentType() {
    return state.current.type === "honorarium" ? "honorarium" : "hours";
  }

  function defaultRate() {
    return state.preferences.defaultRate || "";
  }

  function senderProfile() {
    return Object.assign({}, Config.PROFILE, state.profile || {});
  }

  function nextShiftDate() {
    var shifts = state.current.shifts;
    var lastShift = shifts[shifts.length - 1];
    var lastDate = lastShift && lastShift.date ? String(lastShift.date) : todayIso();
    var parts = lastDate.split("-");
    if (parts.length !== 3) return todayIso();
    var next = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + 1, 12, 0, 0);
    var m = String(next.getMonth() + 1).padStart(2, "0");
    var day = String(next.getDate()).padStart(2, "0");
    return next.getFullYear() + "-" + m + "-" + day;
  }

  function renderShifts() {
    var box = $("shifts");
    box.innerHTML = "";
    state.current.shifts.forEach(function (shift, index) {
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<div class="shift-date"><span class="field-label">Date</span><input type="date" data-field="date" value="' +
        (shift.date || "") +
        '"></div>' +
        '<div class="shift-hours"><span class="field-label">Hours</span><input inputmode="decimal" data-field="hours" value="' +
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

  function renderArtists() {
    var box = $("artists");
    var draft = honorariumDraft();
    box.innerHTML = "";
    draft.artists.forEach(function (name, index) {
      var row = document.createElement("div");
      row.className = "row artist-row";
      row.innerHTML =
        '<div class="artist-name"><span class="field-label">Artist</span><input data-field="name" value="' +
        escapeHtml(name || "") +
        '" placeholder="Name on the invoice"></div>' +
        '<button type="button" class="remove" aria-label="Remove artist">✕</button>';
      row.querySelector("input").addEventListener("input", function () {
        honorariumDraft().artists[index] = this.value;
        updateTotal();
      });
      row.querySelector(".remove").addEventListener("click", function () {
        if (honorariumDraft().artists.length === 1) {
          honorariumDraft().artists[0] = "";
        } else {
          honorariumDraft().artists.splice(index, 1);
        }
        renderArtists();
        updateTotal();
      });
      box.appendChild(row);
    });
  }

  function renderNameChips(boxId, names, onPick) {
    var box = $(boxId);
    box.innerHTML = "";
    (names || []).forEach(function (name) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = name;
      chip.addEventListener("click", function () {
        onPick(name);
      });
      box.appendChild(chip);
    });
  }

  function addArtistName(name) {
    if (!name) return;
    var artists = honorariumDraft().artists;
    var emptyIndex = -1;
    var i;
    for (i = 0; i < artists.length; i += 1) {
      if (artists[i] === name) return;
      if (emptyIndex < 0 && !String(artists[i] || "").trim()) emptyIndex = i;
    }
    if (emptyIndex >= 0) artists[emptyIndex] = name;
    else artists.push(name);
    renderArtists();
    updateTotal();
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

  function renderOrganizers() {
    renderNameChips("organizers", state.organizers, function (name) {
      $("h-organizer").value = name;
      honorariumDraft().organizer = name;
      updateTotal();
    });
  }

  function renderArtistChips() {
    renderNameChips("artist-chips", state.artists, addArtistName);
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
    state.current.notes = $("notes").value.trim();
    if (currentType() === "honorarium") {
      var draft = honorariumDraft();
      draft.event = $("h-event").value.trim();
      draft.eventDate = $("h-eventDate").value || todayIso();
      draft.amount = $("h-amount").value.trim();
      draft.organizer = $("h-organizer").value.trim();
      draft.organizerContact = $("h-organizerContact").value.trim();
      state.current.issuedDate = $("h-issuedDate").value || todayIso();
      state.preferences.honorariumPaymentEmail = $("h-payEmail").value.trim();
      return;
    }
    state.current.employer = $("employer").value.trim();
    state.current.employerAddress = $("employerAddress").value.trim();
    state.current.issuedDate = $("issuedDate").value || todayIso();
    state.current.otHours = $("otHours").value.trim();
    state.current.otRate = $("otRate").value.trim();
    state.current.rate = $("rate").value.trim();
  }

  function honorariumArtists() {
    return honorariumDraft()
      .artists.map(function (name) {
        return String(name || "").trim();
      })
      .filter(Boolean);
  }

  function buildInvoiceFromDraft() {
    collectDraft();
    if (currentType() === "honorarium") {
      var draft = honorariumDraft();
      var artists = honorariumArtists();
      var payEmail = state.preferences.honorariumPaymentEmail || "";
      return {
        type: "honorarium",
        invoiceNumber: state.current.invoiceNumber || Invoice.nextInvoiceNumber(state.lastInvoiceNumber),
        issuedDate: state.current.issuedDate,
        currency: "CAD",
        from: {
          name: artists.join(", "),
          artists: artists,
          email: payEmail,
          paymentEmail: payEmail,
        },
        to: {
          name: draft.organizer,
          address: draft.organizerContact,
        },
        honorarium: {
          event: draft.event,
          eventDate: draft.eventDate,
          amount: Number(draft.amount || 0),
          taxIncluded: true,
        },
        notes: state.current.notes,
      };
    }
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
      type: "hours",
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
    var blocked;
    if (currentType() === "honorarium") {
      blocked =
        !invoice.to.name || !honorariumArtists().length || Number(honorariumDraft().amount || 0) <= 0;
    } else {
      blocked = !state.current.employer || summary.lines.length === 0;
    }
    $("preview-btn").classList.toggle("is-disabled", blocked);
    $("preview-btn").setAttribute("aria-disabled", blocked ? "true" : "false");
  }

  function fillEditor() {
    setInvoiceType(state.current.type || state.preferences.invoiceType || "hours");
    $("employer").value = state.current.employer;
    $("employerAddress").value = state.current.employerAddress;
    $("issuedDate").value = state.current.issuedDate || todayIso();
    $("rate").value = state.current.rate || defaultRate();
    $("otHours").value = state.current.otHours;
    $("otRate").value = state.current.otRate || state.preferences.defaultOtRate || "";
    $("notes").value = state.current.notes;
    var draft = honorariumDraft();
    $("h-event").value = draft.event || "";
    $("h-eventDate").value = draft.eventDate || todayIso();
    $("h-amount").value = draft.amount || "";
    $("h-organizer").value = draft.organizer || "";
    $("h-organizerContact").value = draft.organizerContact || "";
    $("h-issuedDate").value = state.current.issuedDate || todayIso();
    $("h-payEmail").value = state.preferences.honorariumPaymentEmail || "";
    renderShifts();
    renderArtists();
    renderEmployers();
    renderOrganizers();
    renderArtistChips();
    renderRecent();
    updateTotal();
    $("home-banner").classList.toggle("hidden", state.bannerDismissed || window.navigator.standalone === true);
  }

  function renderPreview(invoice) {
    var summary = Invoice.summarizeInvoice(invoice);
    var from = invoice.from || {};
    var to = invoice.to || {};
    var isHonorarium = summary.type === "honorarium";
    var rows = summary.lines
      .map(function (line) {
        if (isHonorarium) {
          return (
            "<tr><td>" +
            escapeHtml(line.label) +
            '</td><td class="num">' +
            escapeHtml(Invoice.formatMoney(line.amount, summary.currency)) +
            "</td></tr>"
          );
        }
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

    var fromDetails = [from.email, from.phone].filter(Boolean).map(escapeHtml).join("<br>");
    var period = "";
    if (summary.workPeriod) {
      period =
        '<p class="preview-work-period">' +
        (isHonorarium ? "Event date: " : "Work Period: ") +
        escapeHtml(summary.workPeriod) +
        "</p>";
    }

    var tableHead = isHonorarium
      ? '<table class="lines"><thead><tr><th>Description</th><th class="num">Amount</th></tr></thead><tbody>'
      : '<table class="lines"><thead><tr><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>';

    var taxNote = isHonorarium || summary.taxIncluded ? '<p class="tax-note">This amount includes taxes.</p>' : "";
    var payTo = isHonorarium ? from.paymentEmail || from.email : senderProfile().paymentEmail || Config.PROFILE.paymentEmail;
    var payBox = Config.paymentInstruction(payTo)
      ? '<div class="pay-box">Payment Method: ' + escapeHtml(Config.paymentInstruction(payTo)) + "</div>"
      : "";

    $("preview-doc").innerHTML =
      '<div class="preview-bar"></div>' +
      '<div class="preview-top">' +
      "<div><h1>INVOICE</h1></div>" +
      '<div class="preview-id muted">#' +
      escapeHtml(invoice.invoiceNumber) +
      "<br>Date Issued: " +
      escapeHtml(Invoice.formatDate(invoice.issuedDate)) +
      "</div></div>" +
      '<div class="cols"><div><h3>FROM</h3><strong>' +
      escapeHtml(from.name || "") +
      "</strong><div class='muted'>" +
      fromDetails +
      "</div></div><div><h3>BILL TO</h3><strong>" +
      escapeHtml(to.name || "") +
      "</strong><div class='muted'>" +
      escapeHtml(to.address || "") +
      "</div></div></div>" +
      period +
      tableHead +
      rows +
      "</tbody></table>" +
      '<div class="totals"><div class="total-due"><strong>Total Due</strong><strong>' +
      escapeHtml(Invoice.formatMoney(summary.total, summary.currency)) +
      "</strong></div>" +
      taxNote +
      "</div>" +
      (invoice.notes ? "<p class='preview-notes'><strong>Notes</strong><br>" + escapeHtml(invoice.notes) + "</p>" : "") +
      payBox;
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
    if (invoice.type === "honorarium") {
      (invoice.from && invoice.from.artists ? invoice.from.artists : []).forEach(function (name) {
        state.artists = Storage.rememberArtist(state.artists, name, Config.ARTIST_CHIP_LIMIT);
      });
      state.organizers = Storage.rememberEmployer(state.organizers, invoice.to && invoice.to.name);
    } else {
      state.employers = Storage.rememberEmployer(state.employers, invoice.to && invoice.to.name);
    }
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
    var type = state.preferences.invoiceType === "honorarium" ? "honorarium" : "hours";
    state.current = emptyDraft();
    state.current.type = type;
    state.current.rate = defaultRate();
    state.current.invoiceNumber = Invoice.nextInvoiceNumber(state.lastInvoiceNumber);
    fillEditor();
    show("editor");
  }

  function bind() {
    $("save-settings").addEventListener("click", function () {
      readSettingsForm();
      if (!state.profile.name) {
        $("setup-error").textContent = "Add your name so it appears on the invoice.";
        return;
      }
      $("setup-error").textContent = "";
      persist();
      goToEditor();
    });

    $("tab-invoice").addEventListener("click", goToEditor);
    $("tab-details").addEventListener("click", goToSetup);

    $("type-hours").addEventListener("click", function () {
      setInvoiceType("hours");
      updateTotal();
      persist();
    });
    $("type-honorarium").addEventListener("click", function () {
      setInvoiceType("honorarium");
      updateTotal();
      persist();
    });

    $("add-shift").addEventListener("click", function () {
      state.current.shifts.push({ date: nextShiftDate(), hours: "8", rate: defaultRate() });
      renderShifts();
      updateTotal();
    });

    $("add-artist").addEventListener("click", function () {
      honorariumDraft().artists.push("");
      renderArtists();
      updateTotal();
    });

    function onEditorFieldEvent(event) {
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") updateTotal();
    }
    $("editor").addEventListener("input", onEditorFieldEvent);
    $("editor").addEventListener("change", onEditorFieldEvent);
    $("editor").addEventListener("focusout", onEditorFieldEvent);

    $("preview-btn").addEventListener("click", function () {
      var invoice = buildInvoiceFromDraft();
      var summary = Invoice.summarizeInvoice(invoice);
      if (currentType() === "honorarium") {
        if (!honorariumArtists().length || !invoice.to.name || Number(honorariumDraft().amount || 0) <= 0) {
          return;
        }
      } else if (!invoice.to.name || summary.lines.length === 0) {
        return;
      }
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
