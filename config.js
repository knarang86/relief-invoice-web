(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.InvoiceConfig = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PROFILE = {
    name: "Anudeep Nirval",
    email: "anudeepnirval@hotmail.com",
    phone: "778-991-883",
    paymentEmail: "anudeepnirval@hotmail.com",
  };

  return {
    PROFILE: PROFILE,
    RECENT_INVOICE_LIMIT: 12,
    EMPLOYER_CHIP_LIMIT: 8,
    STORAGE_KEY: "relief-invoice-v2",
    paymentInstruction: function () {
      return "Cheque or e-transfer to " + PROFILE.paymentEmail;
    },
  };
});
