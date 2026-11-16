// PREVIEW ONLY: four searches answered from passages copied out of the library on 2026-11-16, so the page can be
// tried before the server's /search exists. Delete this file (and its script tag) when the real search is built.
(function () {
  var S = [
    { q: 'Be killing sin or it will be killing you', note: 'Word for word in 3 books, earliest first.', hits: [
      { ref: 'P63000017', author: 'John Owen', dates: '1616–1683', title: 'Of the Mortification of Sin in Believers', year: 1656, link: 'https://ccel.org/ccel/owen/mort', cut_start: 1, cut_end: 1,
        text: 'Do you mortify; do you make it your daily work; be always at it whilst you live; cease not a day from this work; [[be killing sin or it will be killing you]]. Your being dead with Christ virtually, your being quickened with him, will not excuse you from this work.' },
      { ref: 'P182300014', author: 'John Owen', dates: '1616–1683', title: 'Of the Mortification of Sin in Believers', year: 1668, page: 'p. 11', link: 'https://quod.lib.umich.edu/e/eebo/A53715.0001.001', cut_start: 1, cut_end: 1,
        text: '*Do you mortifie*; do you make it your daily work, be alwayes at it whilest you live, cease not a day from this work; [[be killing Sin, or it will be killing you]]; your being *dead* with *Christ virtually,* your being *quickened* with him, will not excuse you from this work.' },
      { ref: 'P329900058', author: 'John Owen', dates: '1616–1683', title: 'The Works of John Owen, ed. Goold, vol. 6', year: 1850, scan: 1, link: 'https://archive.org/details/worksofjohnowe185006owen?q=%22So%20the%20apostle%20Col%20iii%22', cut_start: 1, cut_end: 1,
        text: 'Do you mortify ; do you make it your daily work ; be always at it whilst you live; cease not a day from this work; [[be killing sin or it will be killing you]]. Your being dead with Christ virtually, your being quickened with him, will not excuse j\'ou from this work.' }
    ] },
    { q: 'How can I know I’m truly saved?', hits: [
      { ref: 'P321400020', author: 'R. A. Torrey', dates: '1856–1928', title: 'How to Succeed in the Christian Life', year: 1906, page: 'pp. 27–28', link: 'https://www.gutenberg.org/ebooks/55743', cut_end: 1,
        text: 'If we wish to get assurance of salvation we must first get saved. [[The reason why many have not the assurance that they are saved is because they are not saved.]] They ought not to have assurance. What they need first is salvation.' },
      { ref: 'P41000175', author: 'Charles Spurgeon', dates: '1834–1892', title: 'Sermons, vol. 18', year: 1872, link: 'https://ccel.org/ccel/spurgeon/sermons18', cut_end: 1,
        text: '[[There is nothing in this world about which a man may be so sure as about his own salvation]], because other things come to us by the evidence of our own fallible senses, or by the testimony of men who may be mistaken; but the fact that the believer is saved is sealed to us by the testimony of God himself, who cannot lie.' },
      { ref: 'P26500789', author: 'James P. Boyce', dates: '1827–1888', title: 'Abstract of Systematic Theology', year: 1887, link: 'https://ccel.org/ccel/boyce/theology', cut_end: 1,
        text: 'The grounds upon which a man can be assured of salvation are (a) The divine truth of the promises of salvation. (b) The inward evidence of those graces unto which those promises are made. (c) [[The testimony of the Spirit of adoption]], Rom. 8:15, 16, witnessing with our spirits that we are the children of God.' },
      { ref: 'P10001617', author: 'Robert Lewis Dabney', dates: '1820–1898', title: 'Syllabus and Notes of the Course of Systematic and Polemic Theology', year: 1878, page: 'p. 702', scan: 1, link: 'https://archive.org/details/syllabusnotesofc00dabn/page/702/mode/1up', cut_start: 1, cut_end: 1,
        text: 'the Word nowhere says that A. B. shall be saved ; but that " whosoever believeth shall be saved." [[How then is A. B. to know scripturally, that he is actually saved ?]] Only by the rational deduction from the pair of premises, of which one is given by the Word, and the other by his regenerated consciousness' },
      { ref: 'P691600088', author: 'Catherine Booth', title: 'Papers on Aggressive Christianity', year: 1891, page: 'p. 75', scan: 1, link: 'https://archive.org/details/papersonaggressi00boot?q=%22salvation%20Thy%20faith%20hath%20saved%22', cut_end: 1,
        text: '"By faith are ye saved," and [[when you are saved by faith then conciousness attests the fact]]. Your own spirit attests the fact, and God\'s Spirit attests the fact, and you know it beyond controversy.' }
    ] },
    { q: 'Our heart is restless until it rests in Thee', hits: [
      { ref: 'P15100021', author: 'Augustine', dates: '354–430', title: 'Confessions, Pusey’s translation', year: 1838, link: 'https://ccel.org/ccel/augustine/confess', cut_end: 1,
        text: 'Thou awakest us to delight in Thy praise; for [[Thou madest us for Thyself, and our heart is restless, until it repose in Thee]]. Grant me, Lord, to know and understand which is first, to call on Thee or to praise Thee?' },
      { ref: 'P76600020', author: 'Augustine', dates: '354–430', title: 'The Confessions, in Schaff’s Nicene and Post-Nicene Fathers', year: 1886, page: 'p. 45', link: 'https://ccel.org/ccel/schaff/npnf101.vi.html', cut_end: 1,
        text: 'Thou movest us to delight in praising Thee; for [[Thou hast formed us for Thyself, and our hearts are restless till they find rest in Thee]]. Lord, teach me to know and understand which of these should be first, to call on Thee, or to praise Thee.' },
      { ref: 'P725600122', author: 'Philip Schaff', dates: '1819–1893', title: 'Saint Augustin, Melanchthon, Neander', year: 1886, scan: 1, link: 'https://archive.org/details/saintaugustinmel00schauoft?q=%22Cor%20nostrum%20inquietum%20est%20donee%22', cut_end: 1,
        text: 'The following are among his most striking and suggestive thoughts : Cor nostrum inquietum est donee requiescat in Te. [[Our heart is restless until it rests in Thee.]] Novum Testamentum in Vetere latet, Vetus in Novo patet.' }
    ] },
    { q: 'Spurgeon on prayer meetings', hits: [
      { ref: 'P39800830', author: 'Charles Spurgeon', dates: '1834–1892', title: 'Sermons, vol. 6', year: 1860, link: 'https://ccel.org/ccel/spurgeon/sermons06', cut_end: 1,
        text: '[[I care not if the place is crowded at your other services, the Church is not prosperous if the prayer-meetings be thin.]] It signifies nothing if that Church has sent up a hundred, or five hundred, or a thousand pounds to the Missionary Society--write "Ichabod" on her walls, unless the brethren meet together for prayer.' },
      { ref: 'P738400056', author: 'Charles Spurgeon', dates: '1834–1892', title: 'The Greatest Fight in the World', year: 1891, link: 'https://www.romans45.org/spurgeon/misc/gfw.htm', cut_start: 1, cut_end: 1,
        text: 'If you pray yourself, you will want them to pray with you; and when they begin to pray with you, and for you, and for the work of the Lord, they will want more prayer themselves, and the appetite will grow. [[Believe me, if a church does not pray, it is dead.]] Instead of putting united prayer last, put it first.' },
      { ref: 'P481700004', author: 'Charles Spurgeon', dates: '1834–1892', title: 'Only a Prayer-Meeting', year: 1901, scan: 1, link: 'https://archive.org/details/onlyprayermeetin0000chsp?q=%22fills%20my%20heart%20with%20gladness%22', cut_start: 1, cut_end: 1,
        text: 'How could we look for a Pentecost if we never met with one accord, in one place, to wait upon the Lord? Brethren, [[we shall never see much change for the better in our churches in general till the prayermeeting occupies a higher place in the esteem of Christians.]]' }
    ] }
  ];
  function words(s) { return (s.toLowerCase().match(/[a-z]+/g) || []).filter(function (w) { return w.length > 2; }); }
  window.LK_PREVIEW = function (q) {
    var mine = words(q), best = null, top = 0;
    S.forEach(function (s) {
      var n = words(s.q).filter(function (w) { return mine.indexOf(w) >= 0; }).length;
      if (n > top) { top = n; best = s; }
    });
    if (best && top >= Math.min(2, mine.length)) return best;
    return { hits: [], message: 'This preview only knows these searches:', try: S.map(function (s) { return s.q; }) };
  };
})();
