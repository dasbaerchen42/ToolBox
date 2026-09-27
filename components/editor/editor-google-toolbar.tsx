"use client";

import { ComponentProps } from "react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  type TokenResponse,
} from "@react-oauth/google";
import EditorToolbar from "@/components/editor/editor-toolbar";
import { exportDoc, importDoc, extractDocId } from "@/lib/google-docs";
import { type WritingDoc, createNewDoc } from "@/lib/storage";

type ToolbarTheme = ComponentProps<typeof EditorToolbar>["theme"];

type Props = {
  activeDoc: WritingDoc | null;
  updateActiveDoc: (fields: Partial<WritingDoc>) => void;
  addDoc: (doc: WritingDoc) => void;
  theme: ToolbarTheme;
};

const noop = () => {};

/*
  這裡切成兩層是有原因的,不要合回去:

  Google 的 GSI 腳本一載好,useGoogleLogin 的 effect 就會立刻拿 client_id 去
  initTokenClient,空字串會讓它當場丟錯。那個錯發生在 effect 裡、沒人接,
  React 會把整棵樹卸掉,整頁變成 Next 的「This page couldn't load」。
  (本機測不出來:抓不到 accounts.google.com 時腳本沒載,effect 根本不跑。)

  所以沒有 client id 時,連 provider 帶 hook 一起不要掛——不是傳空字串進去。
*/
export default function EditorGoogleToolbar(props: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <EditorToolbar
        onImport={noop}
        onExport={noop}
        googleEnabled={false}
        theme={props.theme}
      />
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleActions {...props} />
    </GoogleOAuthProvider>
  );
}

function GoogleActions({ activeDoc, updateActiveDoc, addDoc, theme }: Props) {
  const exportToGoogleDocs = useGoogleLogin({
    scope: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        if (!activeDoc) {
          alert("目前沒有可匯出的文件。");
          return;
        }

        const { documentId, url, isUpdate } = await exportDoc(
          tokenResponse.access_token,
          activeDoc.title,
          activeDoc.content,
          activeDoc.googleDocId
        );

        if (!activeDoc.googleDocId) {
          updateActiveDoc({ googleDocId: documentId });
        }

        alert(isUpdate ? "已成功更新 Google Docs！" : "已成功匯出到 Google Docs！");
        window.open(url, "_blank");
      } catch (error) {
        console.error("匯出失敗：", error);
        alert("匯出失敗，請按 F12 查看 Console 錯誤。");
      }
    },
    onError: () => {
      alert("Google 授權失敗。");
    },
  });

  const importFromGoogleDocs = useGoogleLogin({
    scope: [
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ].join(" "),
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        const input = window.prompt("請貼上 Google Docs 文件連結：");
        if (!input) return;

        const documentId = extractDocId(input);
        if (!documentId) {
          alert("看起來不是有效的 Google Docs 連結。");
          return;
        }

        const { title, content, documentId: docId } = await importDoc(
          tokenResponse.access_token,
          documentId
        );

        const importedDoc: WritingDoc = {
          ...createNewDoc(),
          title,
          content,
          mode: "plain",
          googleDocId: docId,
        };

        addDoc(importedDoc);
        alert("已成功從 Google Docs 匯入！");
      } catch (error) {
        console.error("匯入失敗：", error);
        alert("匯入失敗，請按 F12 查看 Console 錯誤。");
      }
    },
    onError: () => {
      alert("Google 授權失敗。");
    },
  });

  return (
    <EditorToolbar
      onImport={importFromGoogleDocs}
      onExport={exportToGoogleDocs}
      googleEnabled
      theme={theme}
    />
  );
}
