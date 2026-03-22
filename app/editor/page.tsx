"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

function EditorPageContent() {
  return (
    <main style={{ padding: 24 }}>
      <h1>EDITOR WITH PROVIDER</h1>
      <p>Google provider is mounted.</p>
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
