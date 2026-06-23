import OpenAI from "openai";

import {
  DRAFT_SCHEMA,
  buildSystemPrompt,
  corsHeaders,
  ensureOpenAiSettings,
  getSettings,
  jsonResponse,
  normalizeCustomerName,
  sanitizeIssue,
  toClientIssue,
  uniqueItems,
  withCors,
} from "./_lib/issue-utils.mjs";

export const config = {
  path: "/api/generate-draft",
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
    ensureOpenAiSettings(settings);

    const payload = await request.json();
    const customerName = normalizeCustomerName(payload.customerName || "");
    const menuPath = String(payload.menuPath || "").trim();
    const memo = String(payload.memo || "").trim();
    const uploadedImageFilenames = uniqueItems(
      Array.isArray(payload.uploadedImageFilenames)
        ? payload.uploadedImageFilenames.map((item) => String(item).trim())
        : [],
    );

    if (!memo) {
      return withCors(jsonResponse(400, { error: "현상을 입력해 주세요." }));
    }

    const client = new OpenAI({ apiKey: settings.openaiApiKey });
    const response = await client.responses.create({
      model: settings.openaiModel,
      temperature: 0.2,
      max_output_tokens: 2400,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt() }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  customer_name: customerName,
                  menu_path_hint: menuPath,
                  memo,
                  uploaded_image_filenames: uploadedImageFilenames,
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: DRAFT_SCHEMA.name,
          schema: DRAFT_SCHEMA.schema,
          strict: true,
        },
      },
    });

    const parsed = JSON.parse(response.output_text || "{}");
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    if (issues.length === 0) {
      return withCors(
        jsonResponse(422, {
          error: "이슈 초안을 생성하지 못했다. 현상을 조금 더 구체적으로 입력해 주세요.",
        }),
      );
    }

    const clientIssues = issues.map((issue, index) =>
      toClientIssue(
        sanitizeIssue(
          {
            kind: issue.issue_kind,
            summary: buildSummary(issue.issue_kind, issue.menu_path, issue.summary),
            customerName,
            menuPath: issue.menu_path,
            currentLabel:
              issue.issue_kind === "VOC" ? "현재 상황 (AS-IS)" : "실제 결과",
            desiredLabel:
              issue.issue_kind === "VOC" ? "요청 사항 (TO-BE)" : "기대 결과",
            reproductionSteps: issue.reproduction_steps,
            currentItems: issue.current_state,
            desiredItems: issue.desired_state,
            frequency: issue.frequency,
            notes: issue.notes,
            relevantImageFilenames: issue.relevant_image_filenames,
          },
          uploadedImageFilenames,
        ),
        settings,
        index,
      ),
    );

    return withCors(
      jsonResponse(200, {
        customerName,
        issues: clientIssues,
      }),
    );
  } catch (error) {
    return withCors(
      jsonResponse(500, {
        error:
          error instanceof Error
            ? error.message
            : "초안 생성 중 알 수 없는 오류가 발생했다.",
      }),
    );
  }
}

function buildSummary(issueKind, menuPath, detailSummary) {
  const prefix = issueKind === "VOC" ? "[VOC][PR] 에이전트" : "[PR] 에이전트";
  const resolvedMenuPath = menuPath?.trim() || "메뉴 위치 추가 확인 필요";
  const resolvedSummary = detailSummary?.trim() || "추가 확인 필요";
  return `${prefix} > ${resolvedMenuPath} > ${resolvedSummary}`;
}

