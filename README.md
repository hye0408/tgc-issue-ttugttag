# Jira Issue Generator

짧은 메모와 오류 화면 이미지 파일명을 입력하면 Jira 이슈 초안을 자동 생성하고, 확인 후 Jira Cloud에 바로 등록하는 Streamlit 도구다.

## 주요 기능

- 여러 장의 이미지 업로드 지원
- 짧은 메모 기반 Jira 초안 자동 생성
- 버그 / VOC 자동 분류
- 여러 이슈가 섞여 있으면 분리 생성
- 동일 원인으로 보이는 이슈는 하나로 묶음
- Jira 이슈 생성 후 첨부파일 업로드
- 생성 완료 후 Jira 이슈 키와 URL 표시

## 동작 방식

1. 사용자가 고객사명, 짧은 메모, 이미지 파일을 입력
2. OpenAI API가 메모와 이미지 파일명을 기반으로 이슈 초안 생성
3. 사용자가 초안을 확인
4. Jira REST API로 이슈 생성
5. 업로드된 이미지를 Jira 첨부파일로 추가

## 파일 구성

- `app.py`: Streamlit UI와 전체 실행 흐름
- `config.py`: `.env` 설정 로드 및 검증
- `issue_formatter.py`: OpenAI 초안 생성, 이슈 요약/본문 포맷팅
- `jira_client.py`: Jira 이슈 생성 및 첨부파일 업로드
- `requirements.txt`: 실행 의존성
- `.env`: 로컬 환경 변수

## 설치

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 환경 변수 설정

`.env` 파일을 실제 값으로 수정한다.

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.2

JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=PR
JIRA_ISSUE_TYPE=VOC

JIRA_VOC_TYPE_FIELD_ID=customfield_12345
JIRA_VOC_TYPE=VOC
JIRA_BUG_TYPE=버그
```

### Jira 설정 메모

- `JIRA_ISSUE_TYPE` 는 요구사항에 맞게 `VOC` 로 고정
- `JIRA_VOC_TYPE_FIELD_ID` 는 선택 사항
- `JIRA_VOC_TYPE_FIELD_ID` 를 넣으면 버그 / VOC 구분값을 Jira 커스텀 필드에도 함께 기록
- 커스텀 필드 값이 단순 문자열이 아니라면 `JIRA_VOC_TYPE` 또는 `JIRA_BUG_TYPE` 에 JSON 문자열도 가능

예:

```env
JIRA_VOC_TYPE={"id":"10100"}
JIRA_BUG_TYPE={"id":"10101"}
```

## 실행

```bash
streamlit run app.py
```

브라우저에서 열리는 화면에서 아래 순서로 사용한다.

1. 고객사명 입력
2. 짧은 메모 입력
3. 오류 화면 이미지 업로드
4. `이슈 초안 생성` 클릭
5. 생성된 초안 확인
6. `Jira 이슈 생성` 클릭

## 구현 메모

- 1차 버전은 이미지 내용 분석을 하지 않는다.
- 업로드된 이미지 파일명만 OpenAI 프롬프트와 Jira 본문에 포함한다.
- 추후 `issue_formatter.py` 의 `ImageContextProvider` 를 확장하면 이미지 분석 로직을 붙일 수 있다.
- Jira Cloud REST API v3 기준으로 이슈 생성과 첨부파일 업로드를 처리한다.
- 첨부파일 업로드 시 `X-Atlassian-Token: no-check` 헤더를 사용한다.

## 주의사항

- Jira 설명 필드는 ADF(Atlassian Document Format)로 전송한다.
- 현재 입력값이 바뀌면 초안을 다시 생성한 뒤 Jira 업로드를 진행해야 한다.
- OpenAI API 키, Jira API 토큰, 프로젝트 권한이 올바르지 않으면 생성이 실패할 수 있다.

## Netlify 배포용 정적 화면

현재 저장소에는 Netlify에 바로 올릴 수 있는 정적 화면도 함께 포함되어 있다.

- `netlify-site/index.html`, `netlify-site/styles.css`, `netlify-site/script.js`: 실제 화면 원본 파일
- `netlify-site/`: Netlify 업로드 또는 GitHub 연동 시 실제 배포 대상으로 쓰는 폴더
- `netlify.toml`: Netlify가 `netlify-site` 폴더만 배포하도록 지정하는 설정
- 루트 `index.html`: 로컬에서 열었을 때 `netlify-site/`로 보내는 리다이렉트 페이지

### Netlify 직접 업로드

1. `netlify-site` 안 파일을 수정
2. Netlify Drop 또는 Deploys 화면으로 이동
3. `netlify-site` 폴더를 그대로 드래그 앤 드롭

### Netlify GitHub 연동

1. 이 저장소를 GitHub에 push
2. `.env`는 절대 커밋하지 않음
3. Netlify에서 GitHub 저장소 연결
4. 배포 설정에서 Publish directory를 `netlify-site`로 지정
5. 또는 이 저장소의 `netlify.toml`을 그대로 사용

이제는 별도 동기화 스크립트가 필요 없다. `netlify-site/` 안 파일을 직접 수정한 뒤 바로 commit/push 하면 된다.

### 중요

- GitHub에 올릴 때는 `.env`를 커밋하지 않는다.
- 실제 OpenAI 키와 Jira 토큰은 Netlify UI의 환경 변수 또는 Netlify Functions 쪽에 넣는 방식으로 분리하는 것이 안전하다.
- 실제 동작은 Netlify Functions에서 처리한다. 정적 파일만 업로드하면 `이슈 초안 생성`, `Jira 이슈 생성` 버튼이 동작하지 않는다.

## Netlify Functions 환경 변수

배포 후 실제 초안 생성과 Jira 등록을 쓰려면 Netlify Site settings 에 아래 환경 변수를 넣어야 한다.

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5

JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=NMRS
JIRA_ISSUE_TYPE=10399

JIRA_CUSTOMER_FIELD_ID=customfield_10375
JIRA_VOC_TYPE_FIELD_ID=customfield_10462
JIRA_VOC_TYPE_DEFECT_OPTION_ID=10346
JIRA_VOC_TYPE_IMPROVEMENT_OPTION_ID=10349
JIRA_VOC_TYPE_TECH_SUPPORT_OPTION_ID=10347
JIRA_VOC_TYPE_INQUIRY_OPTION_ID=10348

DEFAULT_TEST_URL=https://exp277-cms.recruiter.co.kr
DEFAULT_TEST_ID=your id
DEFAULT_TEST_PASSWORD=your pw
```

### Jira 필드 매핑

- 이슈 타입은 항상 `VOC(10399)` 로 생성
- 고객사명은 필수이며 `customfield_10375` 로 전송
- `VOC Type(customfield_10462)` 도 필수이며 아래 옵션 ID 로 자동 세팅
- `DEFECT` -> `10346`
- `IMPROVEMENT` -> `10349`
- `TECH_SUPPORT` -> `10347`
- `INQUIRY` -> `10348`

### 동작 방식

- `이슈 초안 생성` 버튼: Netlify Function 이 OpenAI API 를 호출해서 초안을 생성
- `Jira 이슈 생성` 버튼: 사용자가 수정한 초안을 Netlify Function 이 받아 Jira REST API 로 이슈 생성
- 업로드한 이미지 파일은 생성된 각 이슈에 첨부파일로 업로드

### 로컬 확인 메모

- 지금처럼 단순 정적 서버로 열면 화면 미리보기는 가능하지만 Netlify Function 은 실행되지 않는다.
- 로컬에서 Functions 까지 함께 테스트하려면 Netlify CLI 의 `netlify dev` 환경이 필요하다.
