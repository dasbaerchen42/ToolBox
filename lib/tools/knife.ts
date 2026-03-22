import JSZip from "jszip";

export type KnifeSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export function sanitizeBasename(name: string) {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const safe = withoutExt.replace(/[^0-9A-Za-z\u4e00-\u9fff_\- ]+/g, "_").trim();
  return safe || "parts";
}

export function splitByRegexParagraphs(text: string, pattern: string) {
  const rx = new RegExp(pattern);
  const lines = text.split(/\r?\n/);

  const result: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    if (rx.test(line)) {
      if (buffer.length > 0) {
        result.push(buffer.join("\n"));
        buffer = [];
      }
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    result.push(buffer.join("\n"));
  }

  return result.filter((item) => item.trim().length > 0);
}

export function splitTextAndCount(params: {
  text: string;
  targetChars: number;
  tolerance: number;
  paraPattern: string;
  hardBreakLong: boolean;
  chapterPrefix: string;
}) {
  const { text, targetChars, tolerance, paraPattern, hardBreakLong, chapterPrefix } = params;

  const upper = Math.floor(targetChars * (1 + tolerance));
  const paragraphs = splitByRegexParagraphs(text, paraPattern);

  const results: KnifeSection[] = [];
  let bucket: string[] = [];
  let bucketLength = 0;

  paragraphs.forEach((para) => {
    const paraLength = para.length;

    if (paraLength > targetChars && hardBreakLong) {
      if (bucket.length > 0) {
        results.push({
          id: crypto.randomUUID(),
          title: `${chapterPrefix}${results.length + 1}`,
          paragraphs: [...bucket],
        });
        bucket = [];
        bucketLength = 0;
      }

      for (let start = 0; start < paraLength; start += targetChars) {
        results.push({
          id: crypto.randomUUID(),
          title: `${chapterPrefix}${results.length + 1}`,
          paragraphs: [para.slice(start, start + targetChars)],
        });
      }
      return;
    }

    const projected = bucketLength === 0 ? paraLength : bucketLength + 2 + paraLength;

    if (bucket.length === 0 || projected <= upper) {
      bucket.push(para);
      bucketLength = projected;
    } else {
      results.push({
        id: crypto.randomUUID(),
        title: `${chapterPrefix}${results.length + 1}`,
        paragraphs: [...bucket],
      });

      bucket = [para];
      bucketLength = paraLength;
    }
  });

  if (bucket.length > 0) {
    results.push({
      id: crypto.randomUUID(),
      title: `${chapterPrefix}${results.length + 1}`,
      paragraphs: [...bucket],
    });
  }

  return {
    sections: results,
    paragraphCount: paragraphs.length,
  };
}

export function joinParagraphs(paragraphs: string[]) {
  return paragraphs.join("\n\n");
}

export function getPreviewStart(text: string, length = 40) {
  return text.slice(0, length);
}

export function getPreviewEnd(text: string, length = 40) {
  return text.slice(-length);
}

export async function buildKnifeZip(params: {
  sections: KnifeSection[];
  basename: string;
}) {
  const zip = new JSZip();
  const safeBase = sanitizeBasename(params.basename);

  params.sections.forEach((section, index) => {
    const content = joinParagraphs(section.paragraphs);
    const filename = `${safeBase}_${String(index + 1).padStart(3, "0")}.txt`;
    zip.file(filename, content);
  });

  return zip.generateAsync({ type: "blob" });
}