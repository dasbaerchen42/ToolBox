// 轉圖前把「跨行的底色、底線」切成一行一段。
//
// html2canvas 畫行內元素的底色、底線時,只拿整個元素的外框(getBoundingClientRect):
// 一段底色折成兩行,就畫成一塊從第一行頂到第二行底、左右撐滿的大矩形,
// 而且它畫在段落本身的字後面——同一段裡、接在底色後面的字整個被蓋掉。
// 底線也一樣,第二行的底線會一路畫到第一行的寬度。
//
// 解法:截圖前在複製的文件裡,把這種元素照實際換行的位置切開,每一行各自一個同樣的元素。
// 底色用了 box-decoration-break: clone,每一行本來就各自有左右內距與圓角,
// 切開之後排版一模一樣,只是每一塊的外框剛好就是那一行。

/** 這個行內元素有沒有要畫的底色、框線或底線(有的話跨行就會畫錯) */
function isDecorated(style: CSSStyleDeclaration): boolean {
  if (style.display !== "inline") return false;
  const bg = style.backgroundColor;
  if (bg && bg !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(bg)) return true;
  if (style.backgroundImage && style.backgroundImage !== "none") return true;
  if (style.textDecorationLine && style.textDecorationLine !== "none") return true;
  if (style.boxShadow && style.boxShadow !== "none") return true;
  return ["Top", "Right", "Bottom", "Left"].some(
    (side) =>
      style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" &&
      parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0
  );
}

type Point = { node: Node; offset: number };

/**
 * 元素裡每一行開頭的位置(第一行除外)。一個字一個字量:
 * 這個字的頂端已經低於上一個字的中線,就是換到下一行了。
 */
function lineStarts(el: HTMLElement, doc: Document): Point[] {
  const starts: Point[] = [];
  const range = doc.createRange();
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let prevMid: number | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    let offset = 0;
    // 照「字」走,不要把 emoji 之類的代理對拆成兩半
    for (const char of text) {
      const end = offset + char.length;
      range.setStart(node, offset);
      range.setEnd(node, end);
      const rect = Array.from(range.getClientRects()).find((r) => r.width > 0 || r.height > 0);
      if (rect) {
        if (prevMid !== null && rect.top > prevMid) starts.push({ node, offset });
        prevMid = (rect.top + rect.bottom) / 2;
      }
      offset = end;
    }
  }
  return starts;
}

/**
 * 切點盡量往外提:切在某個子元素的第一個字前面時,改成切在那個子元素前面,
 * 才不會在上一行留下一個空的 <b></b>(或空的遮罩)。
 */
function liftPoint(point: Point, el: HTMLElement): Point {
  let { node, offset } = point;
  while (offset === 0 && node !== el && node.parentNode) {
    const parent: Node = node.parentNode;
    offset = Array.prototype.indexOf.call(parent.childNodes, node);
    node = parent;
  }
  return { node, offset };
}

/** 把一個跨行的元素切成一行一個;回傳切出幾段 */
function splitElement(el: HTMLElement, doc: Document): number {
  const starts = lineStarts(el, doc)
    .map((point) => liftPoint(point, el))
    .filter((point) => !(point.node === el && point.offset === 0));
  // 從最後一刀切回來,前面記下的位置才不會因為切過而跑掉
  for (const point of starts.reverse()) {
    const range = doc.createRange();
    range.setStart(point.node, point.offset);
    range.setEnd(el, el.childNodes.length);
    const rest = range.extractContents();
    const piece = el.cloneNode(false) as HTMLElement;
    piece.appendChild(rest);
    el.after(piece);
  }
  return starts.length + 1;
}

/**
 * 把 root 裡所有「跨行、又有底色或底線」的行內元素切成一行一段。
 * 要在字型載好、排版定下來之後才叫,量到的換行才是最後截圖的換行。
 */
export function splitDecoratedLines(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;
  // 外層先切(querySelectorAll 是文件順序):外層切成一行一段之後,
  // 包在裡面的元素也跟著被切開,自然都只剩一行
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (el.getClientRects().length < 2) continue;
    if (!isDecorated(view.getComputedStyle(el))) continue;
    splitElement(el, doc);
  }
}
