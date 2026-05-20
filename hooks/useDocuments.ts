"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, type WritingDoc, createNewDoc } from "@/lib/storage";
import { ACTIVE_DOC_KEY } from "@/lib/preferences";

export function useDocuments() {
  const [docs, setDocs] = useState<WritingDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>("");

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
  }, []);

  useEffect(() => {
    if (docs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    }
  }, [docs]);

  useEffect(() => {
    if (activeDocId) {
      localStorage.setItem(ACTIVE_DOC_KEY, activeDocId);
    }
  }, [activeDocId]);

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

  function updateActiveDoc(fields: Partial<WritingDoc>) {
    setDocs((prev) => {
      const updated = prev.map((doc) =>
        doc.id === activeDocId
          ? { ...doc, ...fields, updatedAt: new Date().toISOString() }
          : doc
      );
      const active = updated.find((d) => d.id === activeDocId);
      const others = updated.filter((d) => d.id !== activeDocId);
      return active ? [active, ...others] : updated;
    });
  }

  function addDoc(doc: WritingDoc) {
    setDocs((prev) => [doc, ...prev]);
    setActiveDocId(doc.id);
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
  };
}
