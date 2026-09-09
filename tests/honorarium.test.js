const { test } = require("node:test");
const assert = require("node:assert/strict");
const Invoice = require("../invoice.js");
const Storage = require("../storage.js");
const Config = require("../config.js");

function honorariumInvoice(overrides) {
  return Object.assign(
    {
      type: "honorarium",
      invoiceNumber: "2026-010",
      issuedDate: "2026-08-27",
      currency: "CAD",
      from: {
        name: "Karan Narang, Artist Two",
        artists: ["Karan Narang", "Artist Two"],
        paymentEmail: "pay@example.com",
      },
      to: { name: "Diwali Fest", address: "admin@diwalifest.ca" },
      honorarium: {
        event: "Colour Fest 2026",
        eventDate: "2026-07-18",
        amount: 125,
        taxIncluded: true,
      },
      notes: "Due Friday, August 28",
    },
    overrides || {}
  );
}

test("hours invoices still aggregate regular hours", () => {
  const summary = Invoice.summarizeInvoice({
    type: "hours",
    shifts: [
      { date: "2026-08-01", hours: 8, rate: 65 },
      { date: "2026-08-03", hours: 8, rate: 65 },
    ],
  });
  assert.equal(summary.type, "hours");
  assert.equal(summary.lines[0].hours, 16);
  assert.equal(summary.taxIncluded, false);
});

test("summarizes a free-form honorarium as one tax-included line", () => {
  const summary = Invoice.summarizeInvoice(honorariumInvoice());
  assert.equal(summary.type, "honorarium");
  assert.equal(summary.total, 125);
  assert.equal(summary.taxIncluded, true);
  assert.equal(summary.lines.length, 1);
  assert.equal(summary.lines[0].label, "Colour Fest 2026 (July 18, 2026)");
  assert.equal(summary.workPeriod, "July 18, 2026");
  assert.deepEqual(summary.artists, ["Karan Narang", "Artist Two"]);
});

test("honorarium FROM keeps multiple artist names", () => {
  const names = Invoice.artistNames(honorariumInvoice());
  assert.deepEqual(names, ["Karan Narang", "Artist Two"]);
});

test("honorarium label falls back when event name is missing", () => {
  assert.equal(
    Invoice.formatHonorariumLabel({ event: "", eventDate: "2026-07-18" }),
    "Artist honorarium (July 18, 2026)"
  );
});

test("honorarium with five artists stays one invoice total", () => {
  const summary = Invoice.summarizeInvoice(
    honorariumInvoice({
      from: {
        name: "A, B, C, D, E",
        artists: ["A", "B", "C", "D", "E"],
      },
      honorarium: { event: "Colour Fest 2026", eventDate: "2026-07-18", amount: 125 },
    })
  );
  assert.equal(summary.artists.length, 5);
  assert.equal(summary.total, 125);
  assert.equal(summary.lines.length, 1);
});

test("hours invoices ignore honorarium amount", () => {
  const summary = Invoice.summarizeInvoice({
    type: "hours",
    shifts: [{ date: "2026-08-01", hours: 8, rate: 50 }],
    honorarium: { event: "Colour Fest", amount: 125 },
  });
  assert.equal(summary.type, "hours");
  assert.equal(summary.total, 400);
});

test("paymentInstruction can use a non-Anudeep email", () => {
  assert.equal(
    Config.paymentInstruction("pay@example.com"),
    "Cheque or e-transfer to pay@example.com"
  );
  assert.match(Config.paymentInstruction(), /anudeepnirval@hotmail.com/);
});

test("storage keeps artists and honorarium preference apart from Anudeep profile", () => {
  const saved = Storage.serializeState({
    lastInvoiceNumber: "2026-010",
    employers: ["Shoppers"],
    organizers: ["Diwali Fest"],
    artists: ["Karan Narang", "Artist Two"],
    invoices: [],
    profile: { name: "Anudeep Nirval", email: "a@x.com", phone: "1", paymentEmail: "a@x.com" },
    preferences: {
      defaultRate: "65",
      invoiceType: "honorarium",
      honorariumPaymentEmail: "pay@example.com",
    },
  });
  const loaded = Storage.deserializeState(saved);
  assert.equal(loaded.profile.name, "Anudeep Nirval");
  assert.deepEqual(loaded.artists, ["Karan Narang", "Artist Two"]);
  assert.deepEqual(loaded.organizers, ["Diwali Fest"]);
  assert.equal(loaded.preferences.invoiceType, "honorarium");
  assert.equal(loaded.preferences.honorariumPaymentEmail, "pay@example.com");
  assert.equal(loaded.preferences.defaultRate, "65");
});

test("old saved state without honorarium fields still loads as hours", () => {
  const loaded = Storage.deserializeState({
    lastInvoiceNumber: "2026-001",
    employers: ["Costco"],
    invoices: [],
    profile: { name: "Anudeep Nirval" },
    preferences: { defaultRate: "54" },
  });
  assert.equal(loaded.preferences.invoiceType, "hours");
  assert.deepEqual(loaded.artists, []);
  assert.deepEqual(loaded.organizers, []);
  assert.equal(loaded.preferences.showDailyHours, true);
});

test("daily hours option lists each worked day without changing the total", () => {
  const invoice = {
    type: "hours",
    showDailyHours: true,
    shifts: [
      { date: "2026-08-10", hours: 8, rate: 65 },
      { date: "2026-08-11", hours: 6.5, rate: 65 },
    ],
  };
  const rolled = Invoice.summarizeInvoice(Object.assign({}, invoice, { showDailyHours: false }));
  const daily = Invoice.summarizeInvoice(invoice);
  assert.equal(daily.lines.length, 2);
  assert.equal(daily.lines[0].label, "August 10, 2026");
  assert.equal(daily.lines[0].hours, 8);
  assert.equal(daily.lines[1].hours, 6.5);
  assert.equal(daily.total, rolled.total);
  assert.equal(daily.total, 942.5);
});

test("turning daily hours off keeps a single Regular Hours line", () => {
  const summary = Invoice.summarizeInvoice({
    type: "hours",
    showDailyHours: false,
    shifts: [
      { date: "2026-08-10", hours: 8, rate: 65 },
      { date: "2026-08-11", hours: 8, rate: 65 },
    ],
  });
  assert.equal(summary.lines.length, 1);
  assert.equal(summary.lines[0].label, "Regular Hours");
  assert.equal(summary.lines[0].hours, 16);
});

test("storage remembers the daily hours preference when turned off", () => {
  const saved = Storage.serializeState({
    preferences: { showDailyHours: false },
    profile: {},
  });
  const loaded = Storage.deserializeState(saved);
  assert.equal(loaded.preferences.showDailyHours, false);
});
