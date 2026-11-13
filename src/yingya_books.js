/* ============================================================================
 * 英雅文斋 (Yingya Reader) · 公版英文原典馆藏与本地 TXT/Markdown 分页解析引擎
 * 收录 1910 年以前公版经典英文原著选读，并支持用户导入本地 .txt / .md 书籍离线精读
 * ============================================================================ */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function tokenizeTextToHtml(text) {
    const src = String(text || '');
    const re = /[A-Za-z]+(?:['’][A-Za-z]+)?(?:-[A-Za-z]+)*/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) out += escapeHtml(src.slice(last, m.index));
      const word = m[0];
      const clean = word.replace(/’/g, "'").toLowerCase();
      out += '<span class="w" data-clean="' + escapeHtml(clean).replace(/"/g, '&quot;') + '">' + escapeHtml(word) + '</span>';
      last = re.lastIndex;
    }
    if (last < src.length) out += escapeHtml(src.slice(last));
    return out;
  }

  function paginateRawText(rawText, options) {
    const opts = options || {};
    const targetWords = opts.targetWordsPerPage || 160;
    const minWordsFlush = opts.minWordsFlush || 95;
    const norm = String(rawText || '').replace(/\r\n?/g, '\n').trim();
    if (!norm) return [];

    const rawBlocks = norm.split(/\n\s*\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    const pages = [];
    let curParas = [];
    let curWords = 0;
    let pgNum = 1;

    function flush() {
      if (!curParas.length) return;
      for (let idx = 0; idx < curParas.length; idx++) {
        curParas[idx].id = (curParas[idx].is_heading ? 'h-' : 'p-') + pgNum + '-' + idx;
      }
      pages.push({ page: pgNum, paras: curParas });
      pgNum++;
      curParas = [];
      curWords = 0;
    }

    for (let i = 0; i < rawBlocks.length; i++) {
      let block = rawBlocks[i];
      if (/^---\s*PAGE\s*BREAK\s*---$/i.test(block)) {
        flush();
        continue;
      }
      const isMdHeading = /^#{1,6}\s+/.test(block) || (/^(chapter|act|part|book|scene|essay|letter)\b/i.test(block) && block.length < 96);
      if (isMdHeading) {
        block = block.replace(/^#{1,6}\s+/, '').trim();
        if (curParas.length && curWords >= minWordsFlush) flush();
        curParas.push({ is_heading: true, html: tokenizeTextToHtml(block) });
        continue;
      }
      const cleanBlock = block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      const wc = cleanBlock.split(/\s+/).length;
      if (curParas.length && !curParas[curParas.length - 1].is_heading && (curWords + wc > targetWords && curWords >= minWordsFlush)) {
        flush();
      }
      curParas.push({ is_heading: false, html: tokenizeTextToHtml(cleanBlock) });
      curWords += wc;
    }
    flush();
    if (pages.length) pages._crossPageNormalized = true;
    return pages;
  }

  // 1. Pride and Prejudice (Jane Austen, 1813) — Public Domain Excerpt
  const PRIDE_RAW = [
    '# Chapter I · Longbourn & Netherfield',
    'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
    '"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"',
    'Mr. Bennet replied that he had not.',
    '"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."',
    'Mr. Bennet made no answer.',
    '"Do you not want to know who has taken it?" cried his wife impatiently.',
    '"You want to tell me, and I have no objection to hearing it."',
    'This was invitation enough.',
    '---PAGE BREAK---',
    '"Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week."',
    '"What is his name?" "Bingley." "Is he married or single?"',
    '"Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year. What a fine thing for our girls!"',
    '"How so? How can it affect them?"',
    '"My dear Mr. Bennet," replied his wife, "how can you be so tiresome! You must know that I am thinking of his marrying one of them."',
    '"Is that his design in settling here?"',
    '"Design! Nonsense, how can you talk so! But it is very likely that he may fall in love with one of them, and therefore you must visit him as soon as he comes."',
    '---PAGE BREAK---',
    '# Chapter II · The Morning Visit',
    'Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it.',
    'Observing his second daughter employed in trimming a hat, he suddenly addressed her with, "I hope Mr. Bingley will like it, Lizzy."',
    '"We are not in a way to know what Mr. Bingley likes," said her mother resentfully, "since we are not to visit him."',
    '"But you forget, mamma," said Elizabeth, "that we shall meet him at the assemblies, and that Mrs. Long promised to introduce him."',
    '"I do not believe Mrs. Long will do any such thing. She has two nieces of her own. She is a selfish, hypocritical woman, and I have no opinion of her."',
    '"No more have I," said Mr. Bennet; "and I am glad to find that you do not depend on her serving you."',
    'The astonishment of the ladies was just what he wished; that of Mrs. Bennet perhaps surpassing the rest; though, when the first tumult of joy was over, she began to declare that it was what she had expected all the while.'
  ].join('\n\n');

  // 2. The Adventures of Sherlock Holmes (Arthur Conan Doyle, 1892) — Public Domain Excerpt
  const HOLMES_RAW = [
    '# Part I · Baker Street Observation',
    'To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex.',
    'It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind. He was, I take it, the most perfect reasoning and observing machine that the world has seen, but as a lover he would have placed himself in a false position.',
    'Grit in a sensitive instrument, or a crack in one of his own high-power lenses, would not be more disturbing than a strong emotion in a nature such as his. And yet there was but one woman to him, and that woman was the late Irene Adler, of dubious and questionable memory.',
    '---PAGE BREAK---',
    '# Part II · Seeing and Observing',
    'One night—it was on the twentieth of March, 1888—I was returning from a journey to a patient, when my way led me through Baker Street. His rooms were brilliantly lit, and, even as I looked up, I saw his tall, spare figure pass twice in a dark silhouette against the blind.',
    'With hardly a word spoken, but with a kindly eye, he waved me to an armchair and indicated a corner beside the fire. Then he stood before the hearth and looked me over in his singular introspective fashion.',
    '"It is simplicity itself," said he; "my eyes tell me that on the inside of your left shoe, just where the firelight strikes it, the leather is scored by six almost parallel cuts, scraped round the edges of the sole to remove crusted mud."',
    '"You see, but you do not observe. The distinction is clear. For example, you have frequently seen the steps which lead up from the hall to this room. Now, I know that there are seventeen steps, because I have both seen and observed."',
    '---PAGE BREAK---',
    '# Part III · Data Before Theory',
    'He threw over a sheet of thick, pink-tinted note-paper which had been lying open upon the table. "It came by the last post," said he. "Read it aloud."',
    '"This is indeed a mystery," I remarked. "What do you imagine that it means?"',
    '"I have no data yet. It is a capital mistake to theorize before one has data. Insensibly one begins to twist facts to suit theories, instead of theories to suit facts."',
    '"The man who wrote it was presumably well to do," I remarked, endeavouring to imitate my companion. "Such paper could not be bought under half a crown a packet. It is peculiarly strong and stiff."',
    '"Peculiar—that is the very word," said Holmes. "Hold it up to the light. The paper was made in Bohemia, and the man who wrote the note is a German. It only remains to discover what is wanted by this visitor who prefers wearing a mask to showing his face."'
  ].join('\n\n');

  // 3. Classic English Essays & Epigrams (Francis Bacon 1625 & Oscar Wilde 1895) — Public Domain
  const ESSAYS_RAW = [
    '# Essay I · Of Studies (Francis Bacon, 1625)',
    'Studies serve for delight, for ornament, and for ability. Their chief use for delight, is in privateness and retiring; for ornament, is in discourse; and for ability, is in the judgment and disposition of business.',
    'To spend too much time in studies is sloth; to use them too much for ornament, is affectation; to make judgment wholly by their rules, is the humour of a scholar. They perfect nature, and are perfected by experience.',
    'Crafty men contemn studies, simple men admire them, and wise men use them; for they teach not their own use; but that is a wisdom without them, and above them, won by observation.',
    'Read not to contradict and confute; nor to believe and take for granted; nor to find talk and discourse; but to weigh and consider.',
    'Some books are to be tasted, others to be swallowed, and some few to be chewed and digested; that is, some books are to be read only in parts; others to be read, but not curiously; and some few to be read wholly, and with diligence and attention.',
    'Reading maketh a full man; conference a ready man; and writing an exact man. Histories make men wise; poets witty; the mathematics subtile; natural philosophy deep; moral grave; logic and rhetoric able to contend.',
    '---PAGE BREAK---',
    '# Act I · Half-Moon Street Banter (Oscar Wilde, 1895)',
    'Morning-room in Algernon Moncrieff\'s flat in Half-Moon Street. The room is luxuriously and artistically furnished. The sound of a piano is heard in the adjoining room. Lane is arranging afternoon tea on the table.',
    'ALGERNON: Did you hear what I was playing, Lane?',
    'LANE: I didn\'t think it polite to listen, sir.',
    'ALGERNON: I\'m sorry for that, for your sake. I don\'t play accurately—any one can play accurately—but I play with wonderful expression. As far as the piano is concerned, sentiment is my forte. I keep science for Life.',
    'JACK: When one is in town one amuses oneself. When one is in the country one amuses other people. It is excessively boring.',
    'ALGERNON: I really don\'t see anything romantic in proposing. It is very romantic to be in love. But there is nothing romantic about a definite proposal. Why, one may be accepted. Then the excitement is all over. The very essence of romance is uncertainty.'
  ].join('\n\n');

  global.yingyaEscapeHtml = escapeHtml;
  global.yingyaTokenizeTextToHtml = tokenizeTextToHtml;
  global.yingyaPaginateRawText = paginateRawText;

  global.BOOK_PAGES_PRIDE = paginateRawText(PRIDE_RAW, { targetWordsPerPage: 165, minWordsFlush: 80 });
  global.BOOK_PAGES_HOLMES = paginateRawText(HOLMES_RAW, { targetWordsPerPage: 165, minWordsFlush: 80 });
  global.BOOK_PAGES_ESSAYS = paginateRawText(ESSAYS_RAW, { targetWordsPerPage: 165, minWordsFlush: 80 });
  global.BOOK_PAGES = global.BOOK_PAGES_PRIDE;
})(window);
