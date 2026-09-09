(function (root) {
  "use strict";

  var TEAL = [15, 107, 98];
  var INK = [28, 42, 42];
  var MUTED = [90, 96, 96];
  var TEAL_SOFT = [231, 243, 241];

  function getJsPDF() {
    if (root.jspdf && root.jspdf.jsPDF) return root.jspdf.jsPDF;
    if (root.jsPDF) return root.jsPDF;
    throw new Error("PDF library failed to load.");
  }

  function paymentInstruction(from, invoice) {
    var payTo = from && (from.paymentEmail || from.email);
    if (invoice && invoice.type === "honorarium") {
      return payTo ? "Cheque or e-transfer to " + payTo : "";
    }
    if (root.InvoiceConfig && root.InvoiceConfig.paymentInstruction) {
      return root.InvoiceConfig.paymentInstruction(payTo);
    }
    return payTo ? "Cheque or e-transfer to " + payTo : "";
  }

  function drawLine(doc, x1, y1, x2, y2, color) {
    var c = color || INK;
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(0.2);
    doc.line(x1, y1, x2, y2);
  }

  function ensureSpace(doc, y, needed, pageWidth) {
    var pageHeight = doc.internal.pageSize.getHeight();
    if (y + needed < pageHeight - 18) return y;
    doc.addPage();
    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.rect(0, 0, pageWidth, 8, "F");
    return 22;
  }

  function drawInvoice(doc, invoice) {
    var summary = root.Invoice.summarizeInvoice(invoice);
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 18;
    var right = pageWidth - margin;
    var billToX = 110;
    var y = 22;
    var from = invoice.from || {};
    var to = invoice.to || {};
    var i;

    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.rect(0, 0, pageWidth, 8, "F");

    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("INVOICE", margin, y);

    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Invoice #" + (invoice.invoiceNumber || ""), right, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Date Issued: " + root.Invoice.formatDate(invoice.issuedDate), right, y, { align: "right" });

    y += 10;
    drawLine(doc, margin, y, right, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.text("FROM", margin, y);
    doc.text("BILL TO", billToX, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    var fromNameWidth = billToX - margin - 6;
    var toNameWidth = right - billToX;
    var fromNameLines = doc.splitTextToSize(from.name || "", fromNameWidth);
    var toNameLines = doc.splitTextToSize(to.name || "", toNameWidth);
    var nameLines = Math.max(fromNameLines.length, toNameLines.length, 1);
    for (i = 0; i < nameLines; i += 1) {
      if (fromNameLines[i]) doc.text(String(fromNameLines[i]), margin, y);
      if (toNameLines[i]) doc.text(String(toNameLines[i]), billToX, y);
      y += 6;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    var fromLines = [from.email, from.phone].filter(Boolean);
    var toLines = to.address ? doc.splitTextToSize(String(to.address), right - billToX) : [];
    var blockLines = Math.max(fromLines.length, toLines.length, 1);
    for (i = 0; i < blockLines; i += 1) {
      if (fromLines[i]) doc.text(String(fromLines[i]), margin, y);
      if (toLines[i]) doc.text(String(toLines[i]), billToX, y);
      y += 5;
    }

    if (summary.workPeriod) {
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      var periodLabel = summary.type === "honorarium" ? "Event date: " : "Work Period: ";
      doc.text(periodLabel + summary.workPeriod, margin, y);
      y += 8;
    } else {
      y += 4;
    }

    var isHonorarium = summary.type === "honorarium";
    var hoursX = 148;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    if (isHonorarium) {
      doc.text("DESCRIPTION", margin, y);
    } else {
      doc.text(summary.showDailyHours ? "DATE" : "DESCRIPTION", margin, y);
      doc.text("HOURS", hoursX, y, { align: "right" });
    }
    doc.text("AMOUNT", right, y, { align: "right" });
    y += 3;
    drawLine(doc, margin, y, right, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);

    if (summary.lines.length === 0) {
      doc.text(isHonorarium ? "No honorarium entered" : "No hours entered", margin, y);
      y += 8;
    }

    for (i = 0; i < summary.lines.length; i += 1) {
      var item = summary.lines[i];
      var labelLines = doc.splitTextToSize(item.label, isHonorarium ? 140 : 110);
      y = ensureSpace(doc, y, Math.max(7, labelLines.length * 5 + 2), pageWidth);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(labelLines, margin, y);
      if (!isHonorarium) {
        doc.text(root.Invoice.formatHours(item.hours), hoursX, y, { align: "right" });
      }
      doc.text(root.Invoice.formatMoney(item.amount, summary.currency), right, y, { align: "right" });
      y += Math.max(7, labelLines.length * 5 + 2);
    }

    y += 2;
    drawLine(doc, isHonorarium ? 110 : 100, y, right, y);
    y += 8;

    var totalLabel = isHonorarium ? "Total Due" : summary.totalLabel || "Total Due";
    var totalLabelLines = doc.splitTextToSize(totalLabel, pageWidth - margin * 2 - 42);
    y = ensureSpace(doc, y, Math.max(8, totalLabelLines.length * 6 + 2), pageWidth);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(totalLabelLines, margin, y);
    doc.text(root.Invoice.formatMoney(summary.total, summary.currency), right, y, { align: "right" });
    y += Math.max(8, totalLabelLines.length * 6);
    if (isHonorarium || summary.taxIncluded) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("This amount includes taxes.", 118, y);
      y += 10;
    } else {
      y += 6;
    }

    if (invoice.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
      doc.text("NOTES", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      var notes = doc.splitTextToSize(String(invoice.notes), pageWidth - margin * 2);
      doc.text(notes, margin, y);
      y += notes.length * 5 + 8;
    }

    var payLine = paymentInstruction(from, invoice);
    if (payLine) {
      doc.setFillColor(TEAL_SOFT[0], TEAL_SOFT[1], TEAL_SOFT[2]);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text("Payment Method: " + payLine, margin + 4, y + 10);
      y += 20;
    }

    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
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
