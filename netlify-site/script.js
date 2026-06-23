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

function buildMockIssues() {
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
    BUG: [],
    VOC: [],
  };

  topics.forEach((topic) => {
    grouped[classifyTopic(topic)].push(topic);
  });

  const issues = Object.entries(grouped)
    .filter(([, topicList]) => topicList.length > 0)
    .map(([kind, topicList], index) => {
      const primary = topicList[0];
      const summaryPrefix = kind === "VOC" ? "[VOC][PR] 에이전트" : "[PR] 에이전트";
      const currentLabel = kind === "VOC" ? "현재 상황 (AS-IS)" : "실제 결과";
      const desiredLabel = kind === "VOC" ? "요청 사항 (TO-BE)" : "기대 결과";

      return {
        kind,
        index: index + 1,
        summary: `${summaryPrefix} > ${menuPath} > ${summarizeTopic(primary)}`,
        customerName,
        reproductionSteps: [
          `${menuPath} 진입`,
          kind === "VOC" ? "현재 사용 흐름 진행" : "문제 상황 재현 시도",
          "화면 상태 및 결과 확인",
        ],
        currentLabel,
        currentItems: dedupe([
          ...topicList.map((topic) => topic.replace(/\s+/g, " ").trim()),
          files.length > 0 ? `첨부 이미지 파일명: ${files.join(", ")}` : "첨부 이미지 파일 없음",
        ]),
        desiredLabel,
        desiredItems:
          kind === "VOC"
            ? ["사용 흐름 개선 필요", "사용자 관점의 편의성 향상 필요"]
            : ["정상 동작 기준으로 결과 노출 필요", "사용자가 기대한 화면 흐름 유지 필요"],
        frequency: kind === "BUG" ? "추가 확인 필요" : "",
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

function renderIssueCard(issue) {
  const fragment = issueCardTemplate.content.cloneNode(true);

  const kindPill = fragment.querySelector(".kind-pill");
  const issueIndex = fragment.querySelector(".issue-card__index");
  const issueSummary = fragment.querySelector(".issue-card__summary");
  const environmentCustomer = fragment.querySelector(".environment-customer");
  const reproductionList = fragment.querySelector(".reproduction-list");
  const actualTitle = fragment.querySelector(".actual-title");
  const actualList = fragment.querySelector(".actual-list");
  const desiredTitle = fragment.querySelector(".desired-title");
  const desiredList = fragment.querySelector(".desired-list");
  const frequencyBlock = fragment.querySelector(".frequency-block");
  const frequencyValue = fragment.querySelector(".frequency-value");
  const noteList = fragment.querySelector(".note-list");

  kindPill.dataset.kind = issue.kind;
  kindPill.textContent = issue.kind === "BUG" ? "버그" : "VOC";
  issueIndex.textContent = `ISSUE ${issue.index}`;
  issueSummary.textContent = issue.summary;
  environmentCustomer.textContent = `고객사명: ${issue.customerName}`;
  actualTitle.textContent = issue.currentLabel;
  desiredTitle.textContent = issue.desiredLabel;

  issue.reproductionSteps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    reproductionList.appendChild(item);
  });

  issue.currentItems.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    actualList.appendChild(item);
  });

  issue.desiredItems.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    desiredList.appendChild(item);
  });

  if (issue.kind === "BUG") {
    frequencyValue.textContent = issue.frequency || "추가 확인 필요";
  } else {
    frequencyBlock.remove();
  }

  issue.notes.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    noteList.appendChild(item);
  });

  return fragment;
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
  const memo = issueMemoInput.value.trim();
  if (!memo) {
    inlineMessage.textContent = "현상을 먼저 입력해야 이슈 초안을 생성할 수 있다.";
    issueMemoInput.focus();
    return;
  }

  renderPreview(
    buildMockIssues(),
    "이슈 초안 생성 완료. 실제 연동 단계에서는 이 지점에서 OpenAI와 Jira API를 호출하면 된다.",
  );
});

createJiraButton.addEventListener("click", () => {
  inlineMessage.textContent =
    "현재는 화면 시안 단계다. 실제 배포 버전에서는 Netlify Functions가 OpenAI/Jira API를 안전하게 호출하도록 연결할 수 있다.";
});

renderFileTags();
setPreviewVisible(false);
inlineMessage.textContent = "현상 입력 후 이슈 초안 생성 버튼을 누르면 초안이 표시됩니다.";
