import { defaultPreferences } from "./preferences";
import {
  backupFileName,
  createEditorBackup,
  documentFromTextFile,
  modeForFileName,
  parseEditorBackup,
  serializeEditorBackup,
  textFileForDocument,
} from "./editor-files";

describe("編輯器本機檔案", () => {
  it("依副檔名選擇模式並拿掉 BOM", () => {
    expect(modeForFileName("novel.MD")).toBe("markdown");
    expect(modeForFileName("settings.yml")).toBe("yaml");
    expect(modeForFileName("unknown.data")).toBe("plain");

    const doc = documentFromTextFile("我的文章.md", "\uFEFF# 標題");
    expect(doc).toMatchObject({ title: "我的文章", content: "# 標題", mode: "markdown" });
  });

  it("用文件模式決定匯出的檔名與 MIME", () => {
    const doc = documentFromTextFile("bad:name.html", "<p>內容</p>");
    const file = textFileForDocument(doc);
    expect(file.name).toBe("bad_name.html");
    expect(file.type).toBe("text/html;charset=utf-8");
    expect(file.content).toBe("<p>內容</p>");
  });

  it("完整備份可以往返並保留目前文件", () => {
    const doc = documentFromTextFile("文章.md", "內容");
    const now = new Date("2026-10-24T12:00:00.000Z");
    const backup = createEditorBackup([doc], defaultPreferences, doc.id, now);
    const restored = parseEditorBackup(serializeEditorBackup(backup));
    expect(restored.documents).toEqual([doc]);
    expect(restored.activeDocumentId).toBe(doc.id);
    expect(restored.exportedAt).toBe(now.toISOString());
    expect(backupFileName(now)).toBe("toolbox-editor-backup-2026-10-24.json");
  });

  it("拒絕一般 JSON、未知版本與損壞的文件", () => {
    expect(() => parseEditorBackup("not json")).toThrow("有效的 JSON");
    expect(() => parseEditorBackup('{"hello":"world"}')).toThrow("完整備份");

    const doc = documentFromTextFile("文章.txt", "內容");
    const backup = createEditorBackup([doc], defaultPreferences, doc.id);
    expect(() => parseEditorBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow("備份版本");
    expect(() => parseEditorBackup(JSON.stringify({ ...backup, documents: [{ title: "少資料" }] }))).toThrow("必要資料");
  });
});
