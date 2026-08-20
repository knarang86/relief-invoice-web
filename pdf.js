(function (root) {
  "use strict";

  function getJsPDF() {
    if (root.jspdf && root.jspdf.jsPDF) return root.jspdf.jsPDF;
    if (root.jsPDF) return root.jsPDF;
    throw new Error("PDF library failed to load.");
  }

  function paymentInstruction(from) {
    if (root.InvoiceConfig && root.InvoiceConfig.paymentInstruction) {
      return root.InvoiceConfig.paymentInstruction();
    }
    var payTo = (from && (from.paymentEmail || from.email)) || "";
    return payTo ? "Cheque or e-transfer to " + payTo : "";
  }

  function drawInvoice(doc, invoice) {
    var summary = root.Invoice.summarizeInvoice(invoice);
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 20;
    var right = pageWidth - margin;
    var center = pageWidth / 2;
    var y = 24;
    var from = invoice.from || {};
    var to = invoice.to || {};
    var i;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE", center, y, { align: "center" });
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("From: " + (from.name || ""), margin, y);
    y += 6;
    if (from.email) {
      doc.text("Email: " + from.email, margin, y);
      y += 6;
    }
    if (from.phone) {
      doc.text("Phone: " + from.phone, margin, y);
      y += 6;
    }

    y += 4;
    doc.text("To: " + (to.name || ""), margin, y);
    y += 6;
    if (to.address) {
      var addressLines = doc.splitTextToSize(String(to.address), pageWidth - margin * 2);
      doc.text(addressLines, margin, y);
      y += addressLines.length * 5 + 2;
    }

    y += 6;
    doc.text("Date Issued: " + root.Invoice.formatDate(invoice.issuedDate), margin, y);
    y += 6;
    if (summary.workPeriod) {
      doc.text("Work Period: " + summary.workPeriod, margin, y);
      y += 6;
    }
    var payLine = paymentInstruction(from);
    if (payLine) {
      doc.text("Payment Method: " + payLine, margin, y);
      y += 10;
    }

    var colHours = 120;
    var colRate = 150;
    var tableTop = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Description", margin, y);
    doc.text("Hours", colHours, y, { align: "right" });
    doc.text("Rate", colRate, y, { align: "right" });
    doc.text("Amount", right, y, { align: "right" });
    y += 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, y, right, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (summary.lines.length === 0) {
      doc.text("No hours entered", margin, y);
      y += 8;
    }

    for (i = 0; i < summary.lines.length; i += 1) {
      var item = summary.lines[i];
      doc.text(item.label, margin, y);
      doc.text(item.hours.toFixed(2), colHours, y, { align: "right" });
      doc.text(root.Invoice.formatMoney(item.rate, summary.currency) + "/hr", colRate, y, {
        align: "right",
      });
      doc.text(root.Invoice.formatMoney(item.amount, summary.currency), right, y, { align: "right" });
      y += 7;
    }

    y += 2;
    doc.line(margin, y, right, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("Total Due", margin, y);
    doc.text(root.Invoice.formatMoney(summary.total, summary.currency), right, y, { align: "right" });
    y += 12;

    if (invoice.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Notes", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      var notes = doc.splitTextToSize(String(invoice.notes), pageWidth - margin * 2);
      doc.text(notes, margin, y);
      y += notes.length * 5;
    }

    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, tableTop - 6, right - margin, y - tableTop + 10);
  }

  function createPdfBlob(invoice) {
    var JsPDF = getJsPDF();
    var doc = new JsPDF({ unit: "mm", format: "letter" });
    drawInvoice(doc, invoice);
    return doc.output("blob");
  }

  root.InvoicePdf = {
    createPdfBlob: createPdfBlob,
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this);
