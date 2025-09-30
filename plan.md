## 최종 목표 달성을 위한 실행 계획

### **1단계: Supabase를 이용한 백엔드 준비**

> **목표**: 앱의 데이터를 저장하고 불러올 수 있는 온라인 데이터베이스를 만듭니다.

1.  **Supabase 프로젝트 생성**: [Supabase.com](https://supabase.com)에 가입하고, 무료 플랜으로 새 프로젝트를 하나 만듭니다.
2.  **데이터베이스 테이블 설계**: Supabase 프로젝트의 'Table Editor'에서 아래와 같이 두 개의 테이블을 만듭니다.
    * **`settlements` 테이블**: 정산표 자체의 데이터를 저장합니다.
        * `id` (숫자, Primary Key): 정산표 고유 번호
        * `created_at` (타임스탬프): 생성일
        * `data` (JSON): **가장 중요한 부분.** `participants`, `expenses`, `deductions` state를 통째로 이 JSON 필드에 저장할 것입니다.
    * **`comments` 테이블**: 댓글을 저장합니다.
        * `id` (숫자, Primary Key): 댓글 고유 번호
        * `created_at` (타임스탬프): 작성일
        * `content` (텍스트): 댓글 내용
        * `settlement_id` (숫자, Foreign Key): 어떤 정산표에 달린 댓글인지 `settlements` 테이블의 `id`와 연결합니다.
3.  **API 키 확인**: Supabase 프로젝트 설정에서 'API' 메뉴로 들어가, 나중에 앱과 연동하는 데 필요한 **Project URL**과 **anon public Key**를 복사해 둡니다.

---
### **2단계: React 앱과 Supabase 연동**

> **목표**: `ExpenseTable.jsx` 컴포넌트가 Supabase 데이터베이스에서 데이터를 읽고, 변경될 때마다 자동으로 저장하도록 만듭니다.

1.  **Supabase 클라이언트 설정**: `src` 폴더에 `supabaseClient.js` 파일을 만들고, 1단계에서 얻은 API 키를 이용해 Supabase 접속을 설정하는 코드를 작성합니다.
2.  **데이터 불러오기 (`useEffect`)**: 앱이 처음 실행될 때, `useEffect` 훅을 사용하여 Supabase의 `settlements` 테이블에서 데이터를 1건 조회합니다. 불러온 `data` (JSON)를 `setParticipants`, `setExpenses`, `setDeductions`를 이용해 앱의 상태에 채워 넣습니다.
3.  **데이터 자동 저장하기 (`useEffect`)**: `participants`, `expenses`, `deductions` state가 변경될 때마다 실행되는 또 다른 `useEffect` 훅을 만듭니다. 이 훅 안에서 `supabase.from('settlements').update({ data: ... })`와 같은 코드를 실행하여 변경된 내용을 데이터베이스에 자동으로 업데이트합니다.
    * (심화) 매번 키를 입력할 때마다 저장하면 비효율적이므로, '디바운싱(Debouncing)' 기술을 적용하여 사용자의 입력이 끝난 후 잠시 뒤에 한 번만 저장하도록 코드를 개선합니다.

---
### **3단계: 댓글 기능 구현**

> **목표**: 앱 하단에 누구나 댓글을 보고 작성할 수 있는 영역을 만듭니다.

1.  **댓글 컴포넌트 생성**: `src/components` 폴더에 `CommentSection.jsx`라는 새 컴포넌트를 만듭니다. 이 컴포넌트는 댓글 목록과 댓글 입력창 UI를 가집니다.
2.  **댓글 불러오기 및 실시간 업데이트**: `CommentSection.jsx` 안에서 `useEffect`를 사용해 현재 정산표에 해당하는 모든 댓글을 `comments` 테이블에서 불러옵니다. 여기에 Supabase의 '실시간 구독(Real-time Subscription)' 기능을 추가하면, 다른 사람이 새 댓글을 달았을 때 페이지 새로고침 없이도 내 화면에 댓글이 바로 나타나게 할 수 있습니다.
3.  **댓글 작성하기**: 사용자가 입력창에 글을 쓰고 '작성' 버튼을 누르면, `supabase.from('comments').insert({ ... })` 코드를 실행하여 새 댓글을 데이터베이스에 추가합니다.

---
### **4. 웹 배포 및 공유**

> **목표**: 완성된 앱을 실제 인터넷 주소(URL)로 만들어 친구들과 공유합니다.

1.  **프로젝트 빌드**: 터미널에서 `npm run build` 명령어를 실행하여 배포용 최적화 파일을 생성합니다.
2.  **GitHub 연동**: 프로젝트 전체를 GitHub 저장소(Repository)에 업로드합니다.
3.  **Vercel 또는 Netlify 배포**:
    * [Vercel.com](https://vercel.com)에 가입하고 GitHub 계정을 연동합니다.
    * 방금 만든 GitHub 저장소를 Vercel로 가져오면, 몇 번의 클릭만으로 자동으로 빌드 및 배포가 완료되고 고유한 웹사이트 주소가 생성됩니다.
    * **(중요)** Vercel 프로젝트 설정의 'Environment Variables' 메뉴에 Supabase의 API 키를 등록합니다. 이렇게 해야 키를 안전하게 보호하면서 앱이 데이터베이스에 접속할 수 있습니다.