import {
  buildIssueAdf,
  corsHeaders,
  ensureJiraSettings,
  getSettings,
  jsonResponse,
  parseNamedOrJson,
  sanitizeIssue,
  withCors,
} from "./_lib/issue-utils.mjs";

export const config = {
  path: "/api/create-jira",
};

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return withCors(jsonResponse(405, { error: "POST 요청만 지원한다." }));
  }

  try {
    const settings = getSettings();
    ensureJiraSettings(settings);

    const formData = await request.formData();
    const issuesPayload = formData.get("issues");
    if (typeof issuesPayload !== "string") {
      return withCors(jsonResponse(400, { error: "이슈 초안 데이터가 비어 있다." }));
    }

    const parsed = JSON.parse(issuesPayload);
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    if (issues.length === 0) {
      return withCors(jsonResponse(400, { error: "생성할 이슈가 없다." }));
    }

    const files = formData
      .getAll("files")
      .filter((item) => item instanceof File);

    const results = [];
    for (const issue of issues) {
      const sanitizedIssue = sanitizeIssue(issue, issue.relevantImageFilenames || []);
      const created = await createJiraIssue(sanitizedIssue, settings);
      let attachmentWarning = "";

      if (files.length > 0) {
        try {
          await uploadAttachments(created.key, files, settings);
        } catch (error) {
          attachmentWarning =
            error instanceof Error
              ? error.message
              : "첨부파일 업로드 중 오류가 발생했다.";
        }
      }

      results.push({
        key: created.key,
        url: created.url,
        summary: sanitizedIssue.summary,
        attachmentWarning,
      });
    }

    return withCors(jsonResponse(200, { results }));
  } catch (error) {
    return withCors(
      jsonResponse(500, {
        error:
          error instanceof Error
            ? error.message
            : "Jira 이슈 생성 중 알 수 없는 오류가 발생했다.",
      }),
    );
  }
}

async function createJiraIssue(issue, settings) {
  const fields = {
    project: { key: settings.jiraProjectKey },
    summary: issue.summary,
    issuetype: parseNamedOrJson(settings.jiraIssueType, "name"),
    description: buildIssueAdf(issue, settings),
  };

  if (settings.jiraVocTypeFieldId) {
    fields[settings.jiraVocTypeFieldId] = parseNamedOrJson(
      issue.kind === "VOC" ? settings.jiraVocTypeValue : settings.jiraBugTypeValue,
      "value",
    );
  }

  const response = await fetch(`${settings.jiraUrl.replace(/\/$/, "")}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth(settings.jiraEmail, settings.jiraApiToken)}`,
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(await formatJiraError("Jira 이슈 생성 실패", response));
  }

  const data = await response.json();
  if (!data.key) {
    throw new Error("Jira 이슈는 생성되었지만 이슈 키를 받지 못했다.");
  }

  return {
    key: data.key,
    url: `${settings.jiraUrl.replace(/\/$/, "")}/browse/${data.key}`,
  };
}

async function uploadAttachments(issueKey, files, settings) {
  const body = new FormData();
  files.forEach((file) => {
    body.append("file", file, file.name);
  });

  const response = await fetch(
    `${settings.jiraUrl.replace(/\/$/, "")}/rest/api/3/issue/${issueKey}/attachments`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basicAuth(settings.jiraEmail, settings.jiraApiToken)}`,
        "X-Atlassian-Token": "no-check",
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(await formatJiraError("첨부파일 업로드 실패", response));
  }
}

function basicAuth(email, token) {
  return Buffer.from(`${email}:${token}`).toString("base64");
}

async function formatJiraError(prefix, response) {
  try {
    const payload = await response.json();
    const messages = Array.isArray(payload.errorMessages) ? payload.errorMessages : [];
    const fieldErrors = payload.errors || {};
    const details = [
      ...messages.map((message) => String(message)),
      ...Object.entries(fieldErrors).map(([field, message]) => `${field}: ${message}`),
    ];

    return `${prefix} (HTTP ${response.status}): ${
      details.length > 0 ? details.join(" / ") : "상세 오류 메시지 없음"
    }`;
  } catch {
    const text = (await response.text()) || "응답 본문 없음";
    return `${prefix} (HTTP ${response.status}): ${text}`;
  }
}

