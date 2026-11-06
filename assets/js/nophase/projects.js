/* Projects index: category filter chips. */
(function () {
  'use strict';
  var buttons = [].slice.call(document.querySelectorAll('.project-filters [data-filter]'));
  var cards = [].slice.call(document.querySelectorAll('#project-grid .project-card'));
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filter');
      buttons.forEach(function (b) { b.classList.toggle('active', b === btn); });
      cards.forEach(function (c) {
        c.hidden = !(f === 'all' || c.getAttribute('data-kind') === f);
      });
    });
  });
})();
