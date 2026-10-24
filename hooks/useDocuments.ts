"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, type WritingDoc, createNewDoc } from "@/lib/storage";
import { ACTIVE_DOC_KEY } from "@/lib/preferences";

export function useDocuments() {
  const [docs, setDocs] = useState<WritingDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>("");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem(STORAGE_KEY);
      const savedActiveDocId = localStorage.getItem(ACTIVE_DOC_KEY);

      if (savedDocs) {
        const parsed = JSON.parse(savedDocs) as WritingDoc[];
        const normalizedDocs = parsed.map((doc) => ({
          ...doc,
          mode: doc.mode || "plain",
        }));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
        setDocs(normalizedDocs);

        if (
          savedActiveDocId &&
          normalizedDocs.some((d) => d.id === savedActiveDocId)
        ) {
          setActiveDocId(savedActiveDocId);
        } else if (normalizedDocs.length > 0) {
          setActiveDocId(normalizedDocs[0].id);
        } else {
          const firstDoc = createNewDoc();
          setDocs([firstDoc]);
          setActiveDocId(firstDoc.id);
        }
      } else {
        const firstDoc = createNewDoc();
        setDocs([firstDoc]);
        setActiveDocId(firstDoc.id);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_DOC_KEY);
      const firstDoc = createNewDoc();
      setDocs([firstDoc]);
      setActiveDocId(firstDoc.id);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || docs.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 反映這次同步寫入的結果
      setStorageError(null);
    } catch {
      setStorageError("自動儲存失敗：瀏覽器空間可能已滿，或目前是無痕模式。請立即下載完整備份。");
    }
  }, [docs, loaded]);

  useEffect(() => {
    if (!loaded || !activeDocId) return;
    try {
      localStorage.setItem(ACTIVE_DOC_KEY, activeDocId);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage 失敗必須立刻顯示資料風險
      setStorageError("自動儲存失敗：瀏覽器不允許寫入本機資料。請立即下載完整備份。");
    }
  }, [activeDocId, loaded]);

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? null;

  function handleCreateDoc() {
    const newDoc = createNewDoc();
    setDocs((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
  }

  function handleDeleteDoc(docId: string) {
    const filtered = docs.filter((d) => d.id !== docId);
    if (filtered.length === 0) {
      const newDoc = createNewDoc();
      setDocs([newDoc]);
      setActiveDocId(newDoc.id);
      return;
    }
    setDocs(filtered);
    if (activeDocId === docId) setActiveDocId(filtered[0].id);
  }

  // 只就地更新、不搬動順序:打字時側欄清單才不會跳動(新文件仍照建立時間排最前)
  function updateActiveDoc(fields: Partial<WritingDoc>) {
    setDocs((prev) =>
      prev.map((doc) =>
        doc.id === activeDocId
          ? { ...doc, ...fields, updatedAt: new Date().toISOString() }
          : doc
      )
    );
  }

  function addDoc(doc: WritingDoc) {
    setDocs((prev) => [doc, ...prev]);
    setActiveDocId(doc.id);
  }

  function replaceDocuments(nextDocs: WritingDoc[], nextActiveDocId: string) {
    setDocs(nextDocs);
    setActiveDocId(
      nextDocs.some((doc) => doc.id === nextActiveDocId)
        ? nextActiveDocId
        : nextDocs[0]?.id ?? ""
    );
  }

  return {
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    handleCreateDoc,
    handleDeleteDoc,
    updateActiveDoc,
    addDoc,
    replaceDocuments,
    storageError,
  };
}
