// polyfills.js
// هدفه يمنع "الشاشة البيضا" على موبايلات/متصفحات قديمة بسبب نقص دعم بعض الدوال.

(function () {
  // String.prototype.replaceAll (موجود في المتصفحات الحديثة، لكن قديمًا غير موجود)
  if (!String.prototype.replaceAll) {
    // eslint-disable-next-line no-extend-native
    String.prototype.replaceAll = function (search, replacement) {
      const str = String(this);
      if (search instanceof RegExp) {
        return str.replace(search, replacement);
      }
      return str.split(String(search)).join(String(replacement));
    };
  }

  // Element.closest (قد يختفي في WebView قديم)
  if (typeof Element !== "undefined" && !Element.prototype.closest) {
    Element.prototype.closest = function (s) {
      let el = this;
      do {
        if (el.matches && el.matches(s)) return el;
        el = el.parentElement || el.parentNode;
      } while (el !== null && el.nodeType === 1);
      return null;
    };
  }

  // Element.matches
  if (typeof Element !== "undefined" && !Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.msMatchesSelector ||
      Element.prototype.webkitMatchesSelector;
  }

  // URLSearchParams (قد يختفي في متصفحات قديمة)
  if (typeof URLSearchParams === "undefined") {
    window.URLSearchParams = function () {
      return { get: function () { return null; } };
    };
  }
})();
