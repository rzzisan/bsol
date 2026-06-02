export async function fetchEditorDraft(pageId: string, token: string, apiBaseUrl: string) {
  const response = await fetch(
    `${apiBaseUrl}/api/landing/editor/${pageId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error("Failed to fetch draft");
  return response.json();
}

export async function saveEditorDraft(
  pageId: string,
  data: {
    components_json: string;
    styles_json: string;
    html_output: string;
    css_output: string;
  },
  token: string,
  apiBaseUrl: string
) {
  const response = await fetch(
    `${apiBaseUrl}/api/landing/editor/${pageId}/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) throw new Error("Failed to save draft");
  return response.json();
}

export async function publishEditorPage(pageId: string, token: string, apiBaseUrl: string) {
  const response = await fetch(
    `${apiBaseUrl}/api/landing/editor/${pageId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) throw new Error("Failed to publish page");
  return response.json();
}

export async function getVersionHistory(pageId: string, token: string, apiBaseUrl: string) {
  const response = await fetch(
    `${apiBaseUrl}/api/landing/editor/${pageId}/versions`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error("Failed to fetch versions");
  return response.json();
}

export async function rollbackToVersion(
  pageId: string,
  versionNumber: number,
  token: string,
  apiBaseUrl: string
) {
  const response = await fetch(
    `${apiBaseUrl}/api/landing/editor/${pageId}/rollback/${versionNumber}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) throw new Error("Failed to rollback to version");
  return response.json();
}

export async function getElements(apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/api/landing/elements`);

  if (!response.ok) throw new Error("Failed to fetch elements");
  return response.json();
}

export async function getElement(key: string, apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/api/landing/elements/${key}`);

  if (!response.ok) throw new Error("Failed to fetch element");
  return response.json();
}
