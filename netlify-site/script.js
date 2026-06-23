const customerNameInput = document.querySelector("#customerName");
const menuPathInput = document.querySelector("#menuPath");
const issueMemoInput = document.querySelector("#issueMemo");
const issueFilesInput = document.querySelector("#issueFiles");
const fileCount = document.querySelector("#fileCount");
const fileHint = document.querySelector("#fileHint");
const fileTags = document.querySelector("#fileTags");
const workspace = document.querySelector("#workspace");
const generateDraftButton = document.querySelector("#generateDraftButton");
const createJiraButton = document.querySelector("#createJiraButton");
const inlineMessage = document.querySelector("#inlineMessage");
const previewPanel = document.querySelector("#previewPanel");
const previewCustomer = document.querySelector("#previewCustomer");
const previewCount = document.querySelector("#previewCount");
const previewBody = document.querySelector("#previewBody");
const issueCardTemplate = document.querySelector("#issueCardTemplate");
const API_PATHS = {
  generateDraft: "/api/generate-draft",
  createJira: "/api/create-jira",
};

const BUG_KEYWORDS = [
  "오류",
  "에러",
  "실패",
  "안 보",
  "안보",
  "미동작",
  "안됨",
  "안 됨",
  "빈 화면",
  "깨짐",
  "누락",
  "버튼",
  "권한",
  "멈춤",
  "로딩",
];

const VOC_KEYWORDS = [
  "개선",
  "요청",
  "추가",
  "수정",
  "변경",
  "불편",
  "문구",
  "UX",
  "UI",
  "기능",
  "필요",
];

const INQUIRY_KEYWORDS = [
  "문의",
  "확인 부탁",
  "확인요청",
  "무엇",
  "어떻게",
  "왜",
  "가능 여부",
  "가능한지",
];

const TECH_SUPPORT_KEYWORDS = [
  "기술지원",
  "설정",
  "세팅",
  "연동 지원",
  "도움 필요",
  "가이드",
  "사용 방법",
  "지원 필요",
];

function normalizeCustomerName(value) {
  return value.trim().toUpperCase() || "추가 확인 필요";
}

function normalizeMenuPath(value) {
  return value.trim() || "메뉴 위치 추가 확인 필요";
}

function getUploadedFiles() {
  return Array.from(issueFilesInput.files || []);
}

function renderFileTags() {
  const files = getUploadedFiles();
  fileTags.innerHTML = "";

  if (files.length === 0) {
    fileCount.textContent = "0 files";
    fileHint.textContent = "업로드된 파일이 아직 없습니다";
    return;
  }

  fileCount.textContent = `${files.length} files`;
  fileHint.textContent = "파일명은 초안 생성과 첨부 목록에 함께 반영된다.";

  files.forEach((file) => {
    const tag = document.createElement("span");
    tag.className = "tag mono";
    tag.textContent = file.name;
    fileTags.appendChild(tag);
  });
}

function splitIntoTopics(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fragments = lines.flatMap((line) =>
    line
      .split(/[.!?]+/)
      .map((fragment) => fragment.trim())
      .filter(Boolean),
  );

  return fragments.length > 0 ? fragments : [text.trim()].filter(Boolean);
}

function classifyTopic(topic) {
  const lower = topic.toLowerCase();
  const isBug = BUG_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
  const isVoc = VOC_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));

  if (isBug && !isVoc) {
    return "BUG";
  }

  if (isVoc && !isBug) {
    return "VOC";
  }

  if (isBug && isVoc) {
    return topic.includes("개선") || topic.includes("요청") ? "VOC" : "BUG";
  }

  return "BUG";
}

function summarizeTopic(topic) {
  const compact = topic.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "추가 확인 필요";
  }

  if (compact.length <= 58) {
    return compact;
  }

  return `${compact.slice(0, 55)}...`;
}

function dedupe(items) {
  return [...new Set(items.filter(Boolean))];
}

function resolveVocTypeLabel(vocType) {
  const labels = {
    DEFECT: "버그",
    IMPROVEMENT: "개선의견",
    INQUIRY: "문의",
    TECH_SUPPORT: "기술지원",
  };

  return labels[vocType] || "버그";
}

function inferVocTypeFromTopic(topic) {
  const lower = topic.toLowerCase();

  if (BUG_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    return "DEFECT";
  }

  if (TECH_SUPPORT_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    return "TECH_SUPPORT";
  }

  if (INQUIRY_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    return "INQUIRY";
  }

  if (VOC_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    return "IMPROVEMENT";
  }

  return "DEFECT";
}

function isDefectVocType(vocType) {
  return vocType === "DEFECT";
}

function renderIssueCard(issue) {
  const fragment = issueCardTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".issue-card");

  const kindPill = fragment.querySelector(".kind-pill");
  const issueIndex = fragment.querySelector(".issue-card__index");
  const vocTypeSelect = fragment.querySelector(".voc-type-select");
  const issueSummary = fragment.querySelector(".summary-input");
  const environmentCustomer = fragment.querySelector(".environment-customer");
  const reproductionInput = fragment.querySelector(".reproduction-input");
  const actualTitle = fragment.querySelector(".actual-title");
  const actualInput = fragment.querySelector(".actual-input");
  const desiredTitle = fragment.querySelector(".desired-title");
  const desiredInput = fragment.querySelector(".desired-input");
  const frequencyBlock = fragment.querySelector(".frequency-block");
  const frequencyValue = fragment.querySelector(".frequency-select");
  const noteInput = fragment.querySelector(".note-input");

  article.dataset.issueId = issue.id || `issue-${issue.index}`;
  article.dataset.kind = issue.kind;
  article.dataset.vocType = issue.vocType || (issue.kind === "BUG" ? "DEFECT" : "IMPROVEMENT");
  kindPill.dataset.kind = issue.kind;
  issueIndex.textContent = `ISSUE ${issue.index ?? 1}`;
  vocTypeSelect.value = article.dataset.vocType;
  issueSummary.value = issue.summary;
  environmentCustomer.value = issue.customerName;
  fragment.querySelector(".environment-url").value = issue.environmentUrl || "";
  fragment.querySelector(".environment-id").value = issue.environmentId || "";
  fragment.querySelector(".environment-password").value = issue.environmentPassword || "";
  actualTitle.textContent = issue.currentLabel;
  desiredTitle.textContent = issue.desiredLabel;
  reproductionInput.value = issue.reproductionSteps.join("\n");
  actualInput.value = issue.currentItems.join("\n");
  desiredInput.value = issue.desiredItems.join("\n");

  if (issue.kind === "BUG") {
    frequencyValue.value = issue.frequency || "추가 확인 필요";
  }

  noteInput.value = issue.notes.join("\n");

  vocTypeSelect.addEventListener("change", () => {
    applyIssueCategoryUI(article);
  });

  applyIssueCategoryUI(article);

  return fragment;
}

function applyIssueCategoryUI(card) {
  const vocType = card.querySelector(".voc-type-select")?.value || "DEFECT";
  const isBug = isDefectVocType(vocType);
  const kindPill = card.querySelector(".kind-pill");
  const actualTitle = card.querySelector(".actual-title");
  const desiredTitle = card.querySelector(".desired-title");
  const frequencyBlock = card.querySelector(".frequency-block");

  card.dataset.vocType = vocType;
  card.dataset.kind = isBug ? "BUG" : "VOC";

  kindPill.dataset.kind = isBug ? "BUG" : "VOC";
  kindPill.textContent = resolveVocTypeLabel(vocType);
  actualTitle.textContent = isBug ? "실제 결과" : "현재 상황 (AS-IS)";
  desiredTitle.textContent = isBug ? "기대 결과" : "요청 사항 (TO-BE)";
  frequencyBlock.classList.toggle("is-hidden-section", !isBug);
}

function setPreviewVisible(visible) {
  previewPanel.classList.toggle("is-hidden", !visible);
  workspace.classList.toggle("workspace-collapsed", !visible);
}

function renderPreview(state, announceMessage) {
  previewCustomer.textContent = state.customerName;
  previewCount.textContent = `${state.issues.length}건`;
  previewBody.innerHTML = "";
  setPreviewVisible(true);

  state.issues.forEach((issue) => {
    previewBody.appendChild(renderIssueCard(issue));
  });

  inlineMessage.textContent = announceMessage;
}

function setBusy(button, busyText) {
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.disabled = true;
  button.textContent = busyText;
}

function clearBusy(button) {
  button.disabled = false;
  button.textContent = button.dataset.originalText || button.textContent;
}

function collectEditedIssues() {
  return Array.from(previewBody.querySelectorAll(".issue-card")).map((card, index) => ({
    id: card.dataset.issueId || `issue-${index + 1}`,
    kind: card.dataset.kind || "BUG",
    vocType: card.dataset.vocType || "DEFECT",
    summary: card.querySelector(".summary-input")?.value.trim() || "추가 확인 필요",
    customerName:
      card.querySelector(".environment-customer")?.value.trim() || "추가 확인 필요",
    environmentUrl: card.querySelector(".environment-url")?.value.trim() || "",
    environmentId: card.querySelector(".environment-id")?.value.trim() || "",
    environmentPassword: card.querySelector(".environment-password")?.value.trim() || "",
    currentLabel: card.querySelector(".actual-title")?.textContent.trim() || "실제 결과",
    desiredLabel: card.querySelector(".desired-title")?.textContent.trim() || "기대 결과",
    reproductionSteps: textareaLines(card.querySelector(".reproduction-input")),
    currentItems: textareaLines(card.querySelector(".actual-input")),
    desiredItems: textareaLines(card.querySelector(".desired-input")),
    frequency:
      card.querySelector(".frequency-select")?.value || "추가 확인 필요",
    notes: textareaLines(card.querySelector(".note-input")),
  }));
}

function textareaLines(element) {
  return (element?.value || "")
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requestDraftGeneration() {
  const payload = {
    customerName: customerNameInput.value,
    menuPath: menuPathInput.value,
    memo: issueMemoInput.value,
    uploadedImageFilenames: getUploadedFiles().map((file) => file.name),
  };

  const response = await fetch(API_PATHS.generateDraft, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "이슈 초안 생성에 실패했다.");
  }

  return data;
}

async function submitJiraIssues() {
  const issues = collectEditedIssues();
  if (issues.length === 0) {
    throw new Error("먼저 이슈 초안을 생성해 주세요.");
  }

  if (!customerNameInput.value.trim()) {
    throw new Error("고객사명은 필수 입력값이다.");
  }

  const formData = new FormData();
  formData.append("issues", JSON.stringify({ issues }));
  getUploadedFiles().forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(API_PATHS.createJira, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Jira 이슈 생성에 실패했다.");
  }

  return data;
}

function renderResultLinks(results) {
  const items = results
    .map((result) => {
      const warningText = result.attachmentWarning
        ? `<br /><span class="result-warning">${escapeHtml(result.attachmentWarning)}</span>`
        : "";
      return `<div class="result-item"><a href="${result.url}" target="_blank" rel="noreferrer">${escapeHtml(result.key)}</a>${warningText}</div>`;
    })
    .join("");

  inlineMessage.innerHTML = `${results.length}건의 Jira 이슈 생성 완료.${items}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

issueFilesInput.addEventListener("change", () => {
  renderFileTags();
  setPreviewVisible(false);
  inlineMessage.textContent = "첨부 파일이 변경되었다. 이슈 초안을 다시 생성해 주세요.";
});

[customerNameInput, menuPathInput, issueMemoInput].forEach((input) => {
  input.addEventListener("input", () => {
    setPreviewVisible(false);
    inlineMessage.textContent = "입력값이 변경되었다. 이슈 초안을 다시 생성해 주세요.";
  });
});

generateDraftButton.addEventListener("click", () => {
  const customerName = customerNameInput.value.trim();
  const memo = issueMemoInput.value.trim();
  if (!customerName) {
    inlineMessage.textContent = "고객사명은 필수 입력값이다.";
    customerNameInput.focus();
    return;
  }

  if (!memo) {
    inlineMessage.textContent = "현상을 먼저 입력해야 이슈 초안을 생성할 수 있다.";
    issueMemoInput.focus();
    return;
  }

  setBusy(generateDraftButton, "초안 생성 중...");
  requestDraftGeneration()
    .then((data) => {
      renderPreview(
        {
          customerName: data.customerName || normalizeCustomerName(customerNameInput.value),
          issues: (data.issues || []).map((issue, index) => ({
            ...issue,
            index: index + 1,
          })),
        },
        "이슈 초안 생성 완료. 우측 초안에서 문구를 직접 수정한 뒤 Jira 생성 버튼을 눌러 주세요.",
      );
    })
    .catch((error) => {
      const fallbackState = buildFallbackIssues();
      if (fallbackState.issues.length > 0) {
        renderPreview(
          fallbackState,
          `서버 초안 생성에 실패해 로컬 임시 초안으로 표시했다. ${error.message}`,
        );
      } else {
        inlineMessage.textContent = error.message;
      }
    })
    .finally(() => {
      clearBusy(generateDraftButton);
    });
});

createJiraButton.addEventListener("click", () => {
  setBusy(createJiraButton, "Jira 생성 중...");
  submitJiraIssues()
    .then((data) => {
      renderResultLinks(data.results || []);
    })
    .catch((error) => {
      inlineMessage.textContent = error.message;
    })
    .finally(() => {
      clearBusy(createJiraButton);
    });
});

renderFileTags();
setPreviewVisible(false);
inlineMessage.textContent = "현상 입력 후 이슈 초안 생성 버튼을 누르면 초안이 표시됩니다.";

function buildFallbackIssues() {
  const memo = issueMemoInput.value.trim();
  const customerName = normalizeCustomerName(customerNameInput.value);
  const menuPath = normalizeMenuPath(menuPathInput.value);
  const files = getUploadedFiles().map((file) => file.name);

  if (!memo) {
    return {
      customerName,
      issues: [],
    };
  }

  const topics = splitIntoTopics(memo);
  const grouped = {
    DEFECT: [],
    IMPROVEMENT: [],
    INQUIRY: [],
    TECH_SUPPORT: [],
  };

  topics.forEach((topic) => {
    grouped[inferVocTypeFromTopic(topic)].push(topic);
  });

  const issues = Object.entries(grouped)
    .filter(([, topicList]) => topicList.length > 0)
    .map(([vocType, topicList], index) => {
      const primary = topicList[0];
      const isBug = isDefectVocType(vocType);
      const kind = isBug ? "BUG" : "VOC";
      const summaryPrefix = isBug ? "[PR] 에이전트" : "[VOC][PR] 에이전트";
      const currentLabel = isBug ? "실제 결과" : "현재 상황 (AS-IS)";
      const desiredLabel = isBug ? "기대 결과" : "요청 사항 (TO-BE)";

      return {
        id: `fallback-${index + 1}`,
        kind,
        vocType,
        vocTypeLabel: resolveVocTypeLabel(vocType),
        index: index + 1,
        summary: `${summaryPrefix} > ${menuPath} > ${summarizeTopic(primary)}`,
        customerName,
        environmentUrl: "https://exp277-cms.recruiter.co.kr",
        environmentId: "your id",
        environmentPassword: "your pw",
        currentLabel,
        desiredLabel,
        reproductionSteps: [
          `${menuPath} 진입`,
          kind === "VOC" ? "현재 사용 흐름 진행" : "문제 상황 재현 시도",
          "화면 상태 및 결과 확인",
        ],
        currentItems: dedupe([
          ...topicList.map((topic) => topic.replace(/\s+/g, " ").trim()),
          files.length > 0 ? `첨부 이미지 파일명: ${files.join(", ")}` : "첨부 이미지 파일 없음",
        ]),
        desiredItems:
          kind === "VOC"
            ? ["사용 흐름 개선 필요", "사용자 관점의 편의성 향상 필요"]
            : ["정상 동작 기준으로 결과 노출 필요", "사용자가 기대한 화면 흐름 유지 필요"],
        frequency: kind === "BUG" ? "추가 확인 필요" : "추가 확인 필요",
        notes: dedupe([
          menuPath === "메뉴 위치 추가 확인 필요" ? "메뉴 위치 추가 확인 필요" : "",
          kind === "BUG" ? "재현 빈도 추가 확인 필요" : "정책 또는 UX 논의 필요 여부 추가 확인 필요",
        ]),
      };
    });

  return {
    customerName,
    issues,
  };
}
