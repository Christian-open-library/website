// Adds a "Copy the address" button next to the connector address. Without
// JavaScript the address is still selectable text, so nothing depends on this.
(function () {
  var boxes = document.querySelectorAll('.address');
  boxes.forEach(function (box) {
    var code = box.querySelector('code');
    if (!code || !navigator.clipboard) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy the address';
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(code.textContent.trim()).then(function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy the address'; }, 2500);
      }, function () {
        btn.textContent = 'Press and hold the address to copy it';
      });
    });
    box.appendChild(btn);
  });
})();
