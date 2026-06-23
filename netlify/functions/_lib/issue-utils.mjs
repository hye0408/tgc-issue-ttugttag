const FALLBACK_TEXT = "추가 확인 필요";
const MENU_PATH_FALLBACK = "메뉴 위치 추가 확인 필요";
const VALID_REPRODUCTION_FREQUENCIES = new Set([
  "항상",
  "간헐적",
  "특정 PC",
  "1회성",
  FALLBACK_TEXT,
]);
export const VOC_TYPE_LABELS = {
  DEFECT: "버그",
  IMPROVEMENT: "개선의견",
  TECH_SUPPORT: "기술지원",
  INQUIRY: "문의",
};

export function getSettings() {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.5",
    jiraUrl: process.env.JIRA_URL?.trim() || "",
    jiraEmail: process.env.JIRA_EMAIL?.trim() || "",
    jiraApiToken: process.env.JIRA_API_TOKEN?.trim() || "",
    jiraProjectKey: process.env.JIRA_PROJECT_KEY?.trim() || "",
    jiraIssueType: process.env.JIRA_ISSUE_TYPE?.trim() || "",
    jiraCustomerFieldId: process.env.JIRA_CUSTOMER_FIELD_ID?.trim() || "",
    jiraVocTypeFieldId: process.env.JIRA_VOC_TYPE_FIELD_ID?.trim() || "",
    jiraVocTypeDefectOptionId:
      process.env.JIRA_VOC_TYPE_DEFECT_OPTION_ID?.trim() || "",
    jiraVocTypeImprovementOptionId:
      process.env.JIRA_VOC_TYPE_IMPROVEMENT_OPTION_ID?.trim() || "",
    jiraVocTypeTechSupportOptionId:
      process.env.JIRA_VOC_TYPE_TECH_SUPPORT_OPTION_ID?.trim() || "",
    jiraVocTypeInquiryOptionId:
      process.env.JIRA_VOC_TYPE_INQUIRY_OPTION_ID?.trim() || "",
    defaultTestUrl:
      process.env.DEFAULT_TEST_URL?.trim() || "https://exp277-cms.recruiter.co.kr",
    defaultTestId: process.env.DEFAULT_TEST_ID?.trim() || "your id",
    defaultTestPassword: process.env.DEFAULT_TEST_PASSWORD?.trim() || "your pw",
  };
}

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`환경 변수 ${name} 이 설정되지 않았다.`);
  }
  return value;
}

export function ensureOpenAiSettings(settings) {
  if (!settings.openaiApiKey) {
    throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았다.");
  }
}

export function ensureJiraSettings(settings) {
  [
    "jiraUrl",
    "jiraEmail",
    "jiraApiToken",
    "jiraProjectKey",
    "jiraIssueType",
    "jiraCustomerFieldId",
    "jiraVocTypeFieldId",
    "jiraVocTypeDefectOptionId",
    "jiraVocTypeImprovementOptionId",
    "jiraVocTypeTechSupportOptionId",
    "jiraVocTypeInquiryOptionId",
  ].forEach((key) => {
    if (!settings[key]) {
      throw new Error(`Jira 환경 변수 ${key} 가 설정되지 않았다.`);
    }
  });
}

export function normalizeCustomerName(value = "") {
  return value.trim().toUpperCase() || FALLBACK_TEXT;
}

export function cleanText(value = "", fallback = FALLBACK_TEXT) {
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || fallback;
}

export function uniqueItems(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export function normalizeLines(value) {
  if (Array.isArray(value)) {
    return sanitizeLines(value);
  }

  return sanitizeLines(String(value).split(/\r?\n+/));
}

export function sanitizeLines(items = []) {
  const cleaned = items
    .map((item) => cleanText(item, ""))
    .filter(Boolean);

  return uniqueItems(cleaned).length > 0 ? uniqueItems(cleaned) : [FALLBACK_TEXT];
}

export function sanitizeIssue(issue, uploadedFilenames = []) {
  const currentItems = sanitizeLines(issue.currentItems || issue.current_state);
  const desiredItems = sanitizeLines(issue.desiredItems || issue.desired_state);
  const reproductionSteps = sanitizeLines(
    issue.reproductionSteps || issue.reproduction_steps,
  );
  const notes = sanitizeLines(issue.notes || issue.other_notes);

  const normalizedKind = issue.kind || issue.issue_kind || "BUG";
  const fallbackKind = normalizedKind === "VOC" ? "VOC" : "BUG";
  const vocType = normalizeVocType(issue.vocType || issue.voc_type, fallbackKind);
  const kind = vocType === "DEFECT" ? "BUG" : "VOC";

  const relevantImageFilenames = uniqueItems(
    (issue.relevantImageFilenames || issue.relevant_image_filenames || [])
      .map((filename) => cleanText(filename, ""))
      .filter(Boolean),
  );

  const imageTargets =
    relevantImageFilenames.length > 0 ? relevantImageFilenames : uploadedFilenames;

  const enrichedNotes = [...notes];
  if (uploadedFilenames.length > 0) {
    appendIfMissing(enrichedNotes, `첨부 이미지 파일명: ${imageTargets.join(", ")}`);
  } else {
    appendIfMissing(enrichedNotes, "첨부 이미지 파일 없음");
  }

  const normalizedFrequency = cleanText(
    issue.frequency || issue.reproduction_frequency || FALLBACK_TEXT,
    FALLBACK_TEXT,
  );

  return {
    kind,
    vocType,
    vocTypeLabel: VOC_TYPE_LABELS[vocType],
    summary: cleanText(issue.summary, FALLBACK_TEXT),
    customerName: normalizeCustomerName(issue.customerName || issue.customer_name),
    menuPath: cleanText(issue.menuPath || issue.menu_path, MENU_PATH_FALLBACK),
    currentLabel:
      cleanText(issue.currentLabel, "") ||
      (kind === "VOC" ? "현재 상황 (AS-IS)" : "실제 결과"),
    desiredLabel:
      cleanText(issue.desiredLabel, "") ||
      (kind === "VOC" ? "요청 사항 (TO-BE)" : "기대 결과"),
    environmentUrl: cleanText(issue.environmentUrl, ""),
    environmentId: cleanText(issue.environmentId, ""),
    environmentPassword: cleanText(issue.environmentPassword, ""),
    reproductionSteps,
    currentItems,
    desiredItems,
    frequency:
      kind === "BUG" && VALID_REPRODUCTION_FREQUENCIES.has(normalizedFrequency)
        ? normalizedFrequency
        : FALLBACK_TEXT,
    notes: enrichedNotes,
    relevantImageFilenames: imageTargets,
  };
}

export function normalizeVocType(value, kind = "VOC") {
  const normalized = cleanText(value, "").toUpperCase();
  if (normalized in VOC_TYPE_LABELS) {
    return normalized;
  }

  return kind === "BUG" ? "DEFECT" : "IMPROVEMENT";
}

export function appendIfMissing(items, item) {
  const cleaned = cleanText(item, "");
  if (cleaned && !items.includes(cleaned)) {
    items.push(cleaned);
  }
}

export function parseNamedOrJson(rawValue, defaultKey) {
  const value = cleanText(rawValue, "");
  if (!value) {
    return null;
  }

  if (value.startsWith("{") || value.startsWith("[")) {
    return JSON.parse(value);
  }

  return { [defaultKey]: value };
}

export function parseIdOrJson(rawValue) {
  const value = cleanText(rawValue, "");
  if (!value) {
    return null;
  }

  if (value.startsWith("{") || value.startsWith("[")) {
    return JSON.parse(value);
  }

  return /^\d+$/.test(value) ? { id: value } : { name: value };
}

export function getVocTypeOptionId(settings, vocType) {
  const mapping = {
    DEFECT: settings.jiraVocTypeDefectOptionId,
    IMPROVEMENT: settings.jiraVocTypeImprovementOptionId,
    TECH_SUPPORT: settings.jiraVocTypeTechSupportOptionId,
    INQUIRY: settings.jiraVocTypeInquiryOptionId,
  };

  const optionId = mapping[vocType];
  if (!optionId) {
    throw new Error(`VOC Type 옵션 ID를 찾지 못했다: ${vocType}`);
  }

  return optionId;
}

export function createTextNode(text) {
  return { type: "text", text: cleanText(text) };
}

export function createParagraph(text) {
  return {
    type: "paragraph",
    content: [createTextNode(text)],
  };
}

export function createHeading(text, level) {
  return {
    type: "heading",
    attrs: { level },
    content: [createTextNode(text)],
  };
}

export function createBulletList(items) {
  return {
    type: "bulletList",
    content: sanitizeLines(items).map((item) => ({
      type: "listItem",
      content: [createParagraph(item)],
    })),
  };
}

export function createOrderedList(items) {
  return {
    type: "orderedList",
    content: sanitizeLines(items).map((item) => ({
      type: "listItem",
      content: [createParagraph(item)],
    })),
  };
}

export function buildIssueAdf(issue, settings) {
  const content = [
    createHeading(issue.kind === "VOC" ? "VOC" : "버그", 2),
    createHeading("요약", 3),
    createParagraph(issue.summary),
    createHeading("테스트 환경", 3),
    createBulletList([
      `고객사명: ${issue.customerName}`,
      `URL: ${cleanText(issue.environmentUrl || settings.defaultTestUrl)}`,
      `ID: ${cleanText(issue.environmentId || settings.defaultTestId)}`,
      `PW: ${cleanText(issue.environmentPassword || settings.defaultTestPassword)}`,
    ]),
    createHeading("재현 절차", 3),
    createOrderedList(issue.reproductionSteps),
  ];

  if (issue.kind === "VOC") {
    content.push(
      createHeading("현재 상황 (AS-IS)", 3),
      createBulletList(issue.currentItems),
      createHeading("요청 사항 (TO-BE)", 3),
      createBulletList(issue.desiredItems),
      createHeading("기타 의견", 3),
      createBulletList(issue.notes),
    );
  } else {
    content.push(
      createHeading("실제 결과", 3),
      createBulletList(issue.currentItems),
      createHeading("기대 결과", 3),
      createBulletList(issue.desiredItems),
      createHeading("재현 빈도", 3),
      createParagraph(issue.frequency || FALLBACK_TEXT),
      createHeading("기타 의견", 3),
      createBulletList(issue.notes),
    );
  }

  return {
    type: "doc",
    version: 1,
    content,
  };
}

export function buildSystemPrompt() {
  return `
너는 Jira 이슈 실무 문서를 작성하는 한국어 어시스턴트다.

반드시 지켜야 할 규칙:
- 사용자 메모와 이미지 파일명만 사용한다.
- 이미지 내용은 절대 추측하지 않는다.
- 제공되지 않은 정보는 임의 생성하지 말고 \`추가 확인 필요\` 또는 \`메뉴 위치 추가 확인 필요\`로 작성한다.
- 장애, 오류, 오동작, 데이터 비정상은 BUG로 분류한다.
- 개선 요청, 기능 요청, UI/UX 의견, 정책/프로세스 의견은 VOC로 분류한다.
- 일반 문의성 요청은 voc_type 을 INQUIRY 로 분류한다.
- 사용 방법 안내, 설정 지원, 기술 지원 성격 요청은 voc_type 을 TECH_SUPPORT 로 분류한다.
- 버그/오류는 voc_type 을 DEFECT 로 분류한다.
- 개선 요청은 voc_type 을 IMPROVEMENT 로 분류한다.
- BUG와 VOC가 함께 있으면 각각 분리한다.
- 여러 독립 이슈가 섞여 있으면 이슈 단위로 분리한다.
- 동일 원인으로 보이는 내용은 하나로 묶는다.
- 사용자의 원문 표현은 최대한 유지하되 비문은 자연스럽게 교정한다.
- 에러 메시지가 있으면 원문 그대로 유지한다.
- summary 는 반드시 한 줄로 작성하고 \`[PR]\`, \`[VOC][PR]\` 접두사는 포함하지 않는다.
- menuPath 는 가능한 상세하게 작성하고, 모르면 \`메뉴 위치 추가 확인 필요\`로 작성한다.
- reproductionSteps, currentItems, desiredItems, notes 는 각각 문자열 배열로 작성한다.
- BUG의 frequency 는 \`항상\`, \`간헐적\`, \`특정 PC\`, \`1회성\`, \`추가 확인 필요\` 중 하나만 사용한다.
- voc_type 은 반드시 \`DEFECT\`, \`IMPROVEMENT\`, \`INQUIRY\`, \`TECH_SUPPORT\` 중 하나를 사용한다.
- relevantImageFilenames 는 반드시 제공된 파일명만 사용한다.
- JSON schema 에 맞는 값만 반환한다.
`.trim();
}

export const DRAFT_SCHEMA = {
  name: "jira_issue_draft_bundle",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      issues: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            issue_kind: { type: "string", enum: ["BUG", "VOC"] },
            voc_type: {
              type: "string",
              enum: ["DEFECT", "IMPROVEMENT", "INQUIRY", "TECH_SUPPORT"],
            },
            menu_path: { type: "string" },
            summary: { type: "string" },
            reproduction_steps: {
              type: "array",
              items: { type: "string" },
            },
            current_state: {
              type: "array",
              items: { type: "string" },
            },
            desired_state: {
              type: "array",
              items: { type: "string" },
            },
            frequency: { type: "string" },
            notes: {
              type: "array",
              items: { type: "string" },
            },
            relevant_image_filenames: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "issue_kind",
            "voc_type",
            "menu_path",
            "summary",
            "reproduction_steps",
            "current_state",
            "desired_state",
            "frequency",
            "notes",
            "relevant_image_filenames",
          ],
        },
      },
    },
    required: ["issues"],
  },
};

export function toClientIssue(issue, settings, index) {
  const sanitized = sanitizeIssue(issue, issue.relevantImageFilenames || []);
  const customerName = sanitizeCustomerNameWithFallback(
    sanitized.customerName,
    issue.customerName,
  );

  return {
    id: `issue-${index + 1}`,
    kind: sanitized.kind,
    vocType: sanitized.vocType,
    vocTypeLabel: sanitized.vocTypeLabel,
    summary: sanitized.summary,
    customerName,
    menuPath: sanitized.menuPath,
    currentLabel: sanitized.currentLabel,
    desiredLabel: sanitized.desiredLabel,
    environmentUrl: sanitized.environmentUrl || settings.defaultTestUrl,
    environmentId: sanitized.environmentId || settings.defaultTestId,
    environmentPassword:
      sanitized.environmentPassword || settings.defaultTestPassword,
    reproductionSteps: sanitized.reproductionSteps,
    currentItems: sanitized.currentItems,
    desiredItems: sanitized.desiredItems,
    frequency: sanitized.frequency,
    notes: sanitized.notes,
    relevantImageFilenames: sanitized.relevantImageFilenames,
  };
}

function sanitizeCustomerNameWithFallback(primary, fallback) {
  return normalizeCustomerName(primary || fallback || FALLBACK_TEXT);
}

export function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export function withCors(response) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders();
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
