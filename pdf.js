(function (root) {
  "use strict";

  function getJsPDF() {
    if (root.jspdf && root.jspdf.jsPDF) return root.jspdf.jsPDF;
    if (root.jsPDF) return root.jsPDF;
    throw new Error("PDF library failed to load.");
  }

  function drawInvoice(doc, invoice) {
    var summary = root.Invoice.summarizeInvoice(invoice);
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 18;
    var right = pageWidth - margin;
    var y = 22;
    var from = invoice.from || {};
    var to = invoice.to || {};
    var i;

    function line(x1, y1, x2, y2) {
      doc.setDrawColor(28, 42, 42);
      doc.setLineWidth(0.2);
      doc.line(x1, y1, x2, y2);
    }

    doc.setFillColor(15, 107, 98);
    doc.rect(0, 0, pageWidth, 8, "F");

    doc.setTextColor(15, 107, 98);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("INVOICE", margin, y);

    doc.setFontSize(11);
    doc.setTextColor(28, 42, 42);
    doc.text("Invoice #" + (invoice.invoiceNumber || ""), right, y, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 96, 96);
    doc.text("Date: " + root.Invoice.formatDate(invoice.issuedDate), right, y, { align: "right" });

    y += 12;
    line(margin, y, right, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 107, 98);
    doc.text("FROM", margin, y);
    doc.text("BILL TO", 110, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 42, 42);
    doc.text(from.name || "", margin, y);
    doc.text(to.name || "", 110, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    var fromLines = [from.email, from.phone, from.address, from.taxNumber ? "GST/HST " + from.taxNumber : ""]
      .filter(Boolean);
    var toLines = [to.email, to.address].filter(Boolean);
    var blockLines = Math.max(fromLines.length, toLines.length, 1);
    for (i = 0; i < blockLines; i += 1) {
      if (fromLines[i]) doc.text(String(fromLines[i]), margin, y);
      if (toLines[i]) doc.text(String(toLines[i]), 110, y);
      y += 5;
    }

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 107, 98);
    doc.text("DESCRIPTION", margin, y);
    doc.text("HOURS", 118, y, { align: "right" });
    doc.text("RATE", 148, y, { align: "right" });
    doc.text("AMOUNT", right, y, { align: "right" });
    y += 3;
    line(margin, y, right, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(28, 42, 42);

    if (summary.lines.length === 0) {
      doc.text("No hours entered", margin, y);
      y += 8;
    }

    for (i = 0; i < summary.lines.length; i += 1) {
      var item = summary.lines[i];
      doc.text(item.label, margin, y);
      doc.text(item.hours.toFixed(2), 118, y, { align: "right" });
      doc.text(root.Invoice.formatMoney(item.rate, summary.currency), 148, y, { align: "right" });
      doc.text(root.Invoice.formatMoney(item.amount, summary.currency), right, y, { align: "right" });
      y += 7;
    }

    y += 2;
    line(110, y, right, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal", 118, y);
    doc.text(root.Invoice.formatMoney(summary.subtotal, summary.currency), right, y, { align: "right" });
    y += 7;

    if (summary.taxRate > 0) {
      doc.text("Tax (" + summary.taxRate + "%)", 118, y);
      doc.text(root.Invoice.formatMoney(summary.tax, summary.currency), right, y, { align: "right" });
      y += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total", 118, y);
    doc.text(root.Invoice.formatMoney(summary.total, summary.currency), right, y, { align: "right" });
    y += 12;

    if (invoice.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 107, 98);
      doc.text("NOTES", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(28, 42, 42);
      var notes = doc.splitTextToSize(String(invoice.notes), pageWidth - margin * 2);
      doc.text(notes, margin, y);
      y += notes.length * 5 + 6;
    }

    var payTo = from.paymentEmail || from.email;
    if (payTo) {
      doc.setFillColor(241, 247, 246);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(28, 42, 42);
      doc.text("Please pay by Interac e-Transfer to " + payTo, margin + 4, y + 10);
    }

    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text("Thank you", margin, 285);
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
