// Small interactions. Nothing moves unless you scroll or click.

(function () {
  var nav = document.querySelector('.topbar');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 4); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Viewport toggle on the open prototype.
  var open = document.querySelector('.app-open');
  if (open) {
    open.querySelectorAll('[data-set]').forEach(function (button) {
      button.addEventListener('click', function () {
        open.dataset.viewport = button.dataset.set;
        open.querySelectorAll('[data-set]').forEach(function (b) { b.classList.toggle('on', b === button); });
      });
    });
  }

  // Version picker: five headlines, each from a different person through their own agent.
  var versions = [
    { text: 'Insurance that keeps up with you.', who: 'Maya, marketing lead', why: 'Leads with motion. It matches the brand film we are cutting.' },
    { text: 'Your bike, covered in two minutes.', who: 'Jonas, copywriter', why: 'Speed is the thing people asked about most in the survey.' },
    { text: 'Ride. We handle the rest.', who: 'Priya, growth', why: 'Short enough to reuse in every ad size without cutting it.' },
    { text: 'Cover for every ride, not only the stolen ones.', who: 'Tom, brand', why: 'Theft is a minority of claims. This says we do more than that.' },
    { text: 'Peace of mind, by the kilometre.', who: 'Lena, product marketing', why: 'It names the pay-as-you-ride pricing, which is what makes us different.' }
  ];
  var headline = document.getElementById('headline');
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var pick = document.getElementById('pick');
  if (headline && prev && next && pick) {
    var current = 0;
    var picked = -1;
    function render() {
      var v = versions[current];
      headline.classList.add('swap');
      window.setTimeout(function () {
        headline.textContent = v.text;
        headline.classList.remove('swap');
      }, 120);
      document.getElementById('version-n').textContent = current + 1;
      document.getElementById('version-who').textContent = v.who;
      document.getElementById('version-why').textContent = v.why;
      var isPicked = picked === current;
      pick.classList.toggle('picked', isPicked);
      pick.textContent = isPicked ? 'Your pick' : 'Pick this one';
    }
    prev.addEventListener('click', function () { current = (current + versions.length - 1) % versions.length; render(); });
    next.addEventListener('click', function () { current = (current + 1) % versions.length; render(); });
    pick.addEventListener('click', function () { picked = picked === current ? -1 : current; render(); });
  }
})();
