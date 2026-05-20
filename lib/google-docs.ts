export type ExportResult = {
  documentId: string;
  url: string;
  isUpdate: boolean;
};

export type ImportResult = {
  title: string;
  content: string;
  documentId: string;
};

export async function exportDoc(
  accessToken: string,
  title: string,
  content: string,
  existingDocId?: string
): Promise<ExportResult> {
  const safeTitle = title?.trim() || "未命名文件";
  const safeContent = content?.trim() || "（這份文件目前沒有內容）";

  if (existingDocId) {
    const getRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${existingDocId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!getRes.ok) {
      throw new Error(`讀取現有文件失敗：${await getRes.text()}`);
    }

    const docData = await getRes.json();
    const endIndex: number = docData.body?.content?.at(-1)?.endIndex ?? 1;

    const requests: object[] = [];
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: endIndex - 1 },
        },
      });
    }
    requests.push({
      insertText: { location: { index: 1 }, text: safeContent },
    });

    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${existingDocId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      }
    );
    if (!updateRes.ok) {
      throw new Error(`更新文件內容失敗：${await updateRes.text()}`);
    }

    return {
      documentId: existingDocId,
      url: `https://docs.google.com/document/d/${existingDocId}/edit`,
      isUpdate: true,
    };
  }

  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: safeTitle }),
  });
  if (!createRes.ok) {
    throw new Error(`建立文件失敗：${await createRes.text()}`);
  }

  const createdDoc = await createRes.json();
  const documentId = createdDoc.documentId as string;

  const insertRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: safeContent } }],
      }),
    }
  );
  if (!insertRes.ok) {
    throw new Error(`寫入內容失敗：${await insertRes.text()}`);
  }

  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    isUpdate: false,
  };
}

export function extractDocId(input: string): string | null {
  const match = input.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getAllTabs(tabs: TabLike[] = []): TabLike[] {
  const result: TabLike[] = [];
  for (const tab of tabs) {
    result.push(tab);
    if (tab.childTabs?.length) {
      result.push(...getAllTabs(tab.childTabs));
    }
  }
  return result;
}

type StructuralElement = {
  paragraph?: { elements: { textRun?: { content?: string } }[] };
  table?: { tableRows: { tableCells?: { content?: StructuralElement[] }[] }[] };
  tableOfContents?: { content: StructuralElement[] };
};

type TabLike = {
  tabProperties?: { title?: string };
  documentTab?: { body?: { content?: StructuralElement[] } };
  childTabs?: TabLike[];
};

function readStructuralElements(elements: StructuralElement[] = []): string {
  let text = "";
  for (const element of elements) {
    if (element.paragraph?.elements) {
      text += element.paragraph.elements
        .map((el) => el.textRun?.content ?? "")
        .join("");
    }
    if (element.table?.tableRows) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          text += readStructuralElements(cell.content ?? []);
        }
      }
    }
    if (element.tableOfContents?.content) {
      text += readStructuralElements(element.tableOfContents.content);
    }
  }
  return text;
}

export async function importDoc(
  accessToken: string,
  documentId: string
): Promise<ImportResult> {
  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}?includeTabsContent=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`讀取 Google Docs 失敗：${await res.text()}`);
  }

  const docData = await res.json();
  const title: string = docData.title || "匯入的文件";
  let textContent = "";

  if (docData.tabs?.length) {
    const allTabs = getAllTabs(docData.tabs as TabLike[]);
    textContent = allTabs
      .map((tab, index) => {
        const tabTitle = tab.tabProperties?.title ?? `分頁 ${index + 1}`;
        const tabBody = tab.documentTab?.body?.content ?? [];
        const tabText = readStructuralElements(tabBody).trim();
        return `# ${tabTitle}\n\n${tabText}`;
      })
      .join("\n\n---\n\n");
  } else {
    const bodyContent = (docData.body?.content ?? []) as StructuralElement[];
    textContent = readStructuralElements(bodyContent).trim();
  }

  return { title, content: textContent.trim(), documentId };
}
