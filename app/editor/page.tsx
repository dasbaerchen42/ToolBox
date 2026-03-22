"use client";

import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";

function EditorPageContent() {
  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/documents.readonly",
    onSuccess: () => {
      console.log("login success");
      alert("Google login success");
    },
    onError: () => {
      console.log("login error");
      alert("Google login error");
    },
  });

  return (
    <main style={{ padding: 24 }}>
      <h1>EDITOR WITH LOGIN HOOK</h1>
      <button onClick={() => login()}>Test Google Login</button>
    </main>
  );
}

export default function EditorPage() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <main style={{ padding: 24 }}>
        <h1>CLIENT ID MISSING</h1>
      </main>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <EditorPageContent />
    </GoogleOAuthProvider>
  );
}
