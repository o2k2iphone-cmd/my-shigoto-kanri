# MY仕事管理

日本語の業務管理PWAです。**Microsoft 365のアプリ登録やAPI権限なしで単体動作**します。PC・iPadで登録・編集、iPhoneで一覧確認しやすい構成です。`index.html` を入口とするHTML / CSS / JavaScriptの静的アプリです。**Node.js・Python・npm・追加ソフト・ビルドは不要**です。GitHub Pagesにそのままアップロードして利用できます。データは各ブラウザのIndexedDBに保存します。

## すぐに使う

### PC・iPad・iPhoneで使う

1. 次の手順でGitHub Pagesへ公開します。
2. 公開されたHTTPSのURLを各端末のブラウザで開きます。会社PC側で起動コマンドを実行する必要はありません。
3. 「新規登録」から情報を登録します。初回は空のデータで始まります。
4. 必要に応じてホーム画面に追加します。アプリ自体にMicrosoftのログインはありません。

**端末間の自動同期はありません。** 同じ公開URLでもPC・iPad・iPhoneの保存データは別です。移行・共有にはJSONバックアップと復元を使います。従来のNode.js用 `起動.cmd` と開発スクリプトは取り除きました。

## GitHub Pagesへの公開

この成果物はまだGitHubへアップロードしていません。公開作業は次の手順で行えます。

1. GitHubで新しいリポジトリ（例：`my-work-manager`）を作成します。
2. 次の**公開用ファイルの構成を保ったまま** `main` ブランチへアップロード・コミットします。`index.html` がリポジトリの直下にある状態にします。ブラウザの **Add file → Upload files** でアップロードできます。`src` 内の各サブフォルダーも保持してください。
3. リポジトリの **Settings → Pages** を開きます。
4. **Build and deployment → Source → Deploy from a branch** を選択します。
5. Branchを **main**、フォルダーを **/(root)** にしてSaveします。
6. 公開完了後、表示される `https://ユーザー名.github.io/my-work-manager/` を開きます。
7. その他 → 設定に **「オフラインの準備ができました」** と表示されたら、ホーム画面に追加できます。

公開に必要なファイルは次のとおりです。生成・変換・依存パッケージのインストールはありません。

```text
index.html
styles.css
manifest.webmanifest
sw.js
.nojekyll
assets/     フォルダー内の全アイコン
src/        サブフォルダーを含む全JavaScript
```

README・動作確認記録・`tests/` は任意です。ブラウザでテストも行う場合は `tests/` を一緒にアップロードします。GitHubのファイル選択画面で `.nojekyll` が表示されない場合は、Add file → Create new fileで名前を `.nojekyll`、内容を空にしてコミットしてください。

相対パスとハッシュによるページ移動を採用しているため、リポジトリ名を変更してもコード内の公開パス変更は不要です。`.nojekyll` も同梱しています。カスタムドメインでも同じ構成で使えます。GitHub Pagesの利用可否はアカウント・リポジトリのプランに依存します。

リポジトリにはアプリのコードを置きます。**実務データやバックアップJSONをアップロードする必要はありません**。業務情報は利用するブラウザ内に保存されます。`backups/` と検証用出力 `qa-artifacts/` はGitの対象から除外しています。

手順の根拠：[GitHub公式・公開元の設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## ローカル確認（Node.js・Python不要）

公開前にWindows PCだけで確認したい場合は、**Windows標準のWindows PowerShellと.NET**で一時的にHTTP配信できます。追加インストール・管理者権限・実行ポリシーの変更は不要です。これは確認時だけの手順で、GitHub Pagesでは実行しません。

1. エクスプローラーで `index.html` があるフォルダーを開きます。
2. アドレスバーに `powershell` と入力してEnterを押します。そのフォルダーでWindows PowerShellが開きます。
3. 以下をまとめてコピーしてPowerShellへ貼り付け、Enterを押します。
4. ブラウザで **http://localhost:4173/** を開きます。ウィンドウは開いたままにしてください。
5. 終了時はPowerShellで `Ctrl+C` を押します。

```powershell
$previewRoot = (Get-Location).Path
$previewPort = 4173
$previewPrefix = [IO.Path]::GetFullPath($previewRoot).TrimEnd([char[]]@('\', '/')) + [IO.Path]::DirectorySeparatorChar
$previewTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
}
if (-not (Test-Path -LiteralPath (Join-Path $previewRoot 'index.html'))) {
  throw 'index.htmlのあるフォルダーで実行してください。'
}
$previewListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $previewPort)
$previewListener.Start()
Write-Host "ブラウザで http://localhost:$previewPort/ を開いてください。終了はCtrl+Cです。"
try {
  while ($true) {
    if (-not $previewListener.Pending()) { Start-Sleep -Milliseconds 100; continue }
    $previewClient = $previewListener.AcceptTcpClient()
    try {
      $previewStream = $previewClient.GetStream()
      $previewStream.ReadTimeout = 5000
      $previewStream.WriteTimeout = 5000
      $previewReader = [IO.StreamReader]::new($previewStream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $previewLine = $previewReader.ReadLine()
      if (-not $previewLine) { continue }
      $previewParts = $previewLine.Split(' ')
      if ($previewParts.Length -lt 3) { continue }
      do { $previewHeader = $previewReader.ReadLine() } while ($previewHeader)
      $previewMethod = $previewParts[0]
      $previewRelative = [Uri]::UnescapeDataString(($previewParts[1] -split '[?#]', 2)[0]).TrimStart('/')
      if (-not $previewRelative) { $previewRelative = 'index.html' }
      $previewFile = [IO.Path]::GetFullPath((Join-Path $previewRoot $previewRelative))
      if (Test-Path -LiteralPath $previewFile -PathType Container) { $previewFile = Join-Path $previewFile 'index.html' }
      $previewExtension = [IO.Path]::GetExtension($previewFile).ToLowerInvariant()
      $previewStatus = '404 Not Found'
      $previewContentType = 'text/plain; charset=utf-8'
      $previewBytes = [byte[]]@()
      if ($previewMethod -notin @('GET', 'HEAD')) { $previewStatus = '405 Method Not Allowed' }
      elseif ($previewFile.StartsWith($previewPrefix, [StringComparison]::OrdinalIgnoreCase) -and
              $previewTypes.ContainsKey($previewExtension) -and
              (Test-Path -LiteralPath $previewFile -PathType Leaf)) {
        $previewBytes = [IO.File]::ReadAllBytes($previewFile)
        $previewContentType = $previewTypes[$previewExtension]
        $previewStatus = '200 OK'
      }
      $previewResponse = "HTTP/1.1 $previewStatus`r`nContent-Type: $previewContentType`r`nContent-Length: $($previewBytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $previewResponseBytes = [Text.Encoding]::ASCII.GetBytes($previewResponse)
      $previewStream.Write($previewResponseBytes, 0, $previewResponseBytes.Length)
      if ($previewMethod -ne 'HEAD' -and $previewBytes.Length) { $previewStream.Write($previewBytes, 0, $previewBytes.Length) }
      $previewStream.Flush()
    } catch { Write-Warning '確認用の接続を終了しました。必要ならブラウザを再読み込みしてください。' }
    finally { $previewClient.Close() }
  }
} finally { $previewListener.Stop() }
```

ポートが使用中なら、先頭の `$previewPort = 4173` を `4174` 等に変え、ブラウザのURLも同じ番号にします。localhostの配信はこのPC専用で、社内ネットワークへ公開しません。会社の設定でPowerShellが制限されている場合は、GitHub Pagesの確認用リポジトリへアップロードしてHTTPSで確認してください。

`index.html` のダブルクリック（`file://`）は完全な動作確認に使えません。ブラウザのES Modules・Service Workerの制約があるため、**localhostのHTTPまたは公開先のHTTPS**で開いてください。localhostからGitHub Pagesへのデータ移行はJSONで行います。

## ホーム画面・PWA

- **iPhone / iPad**：公開URLをSafariで開き、共有メニュー → ホーム画面に追加 → 追加。
- **PC**：Edge・Chrome等のアドレスバーまたはメニューからアプリとしてインストール。
- 最初はオンラインで開きます。Service Workerが画面・スタイル・全モジュール・アイコンをまとめて保存した後は、オフラインでも閲覧・登録・編集できます。
- Microsoft側のTeamsリンクはオンライン時に開きます。
- manifest、192px / 512pxアイコン、maskableアイコン、Apple用180pxアイコンを同梱。
- 対応ブラウザのインストール案内は「その他 → 設定」にあります。

**更新時**：`sw.js` の `VERSION` を変更して公開します。アプリは未保存編集を守るため強制更新しません。「アプリの更新があります」と表示されたら、保存してから同じアプリのタブ・PWA画面をすべて閉じて開き直してください。Service Workerの更新でIndexedDBの業務データは消しません。

PWAの仕様参考：[MDN・PWAのインストール要件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[MDN・インストール方法](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing)

## 画面と使い方

### 1. 管理

一覧は必ず **期限付き作業 → メモ → あとで確認 → アーカイブ保管** の順です。1件1行で、タイトルは【】形式から始めます。長いタイトルは1行に省略し、詳細で全文を読めます。

- **期限付き作業**：期限必須。時刻の初期値は18:00（設定で変更）。近い期限から並び、期限超過は上部に赤く表示。チェックすると完了日を保持してアーカイブへ移動。
- **メモ / あとで確認**：期限なしで保存できます。期限を設定するとカレンダーにも表示。
- **アーカイブ保管**：手動保管と完了した作業を同じ一覧で検索。完了日を詳細で確認できます。完了した作業は「未完了に戻す」で元の種類へ戻せます。
- **詳細**：タイトル、種類、期限日・時刻、本文、Teamsリンク、アラームを確認。編集・完了・削除もここから行います。
- **検索**：タイトル、全文、期限（`2026-10-03` / `10月3日`）、種別、Teamsリンクを対象に検索。人名・店舗名・部署名・商品名・案件名をタイトルや本文に書いておけば検索できます。空白で複数の語を入れるとすべての語を含む情報を表示。全角英数字も検索できます。種類の絞り込みを併用できます。
- 登録日は内部保持のみで、一覧・詳細に表示しません。優先度はありません。

Teamsの本文は手動でコピーし、タイトル・メモ本文に貼り付けます。TeamsリンクはTeamsの「リンクをコピー」から貼り付けます。現バージョンはTeamsへのメッセージ取得・送信・認証要求を行いません。

### Plannerから登録

管理画面の **「Plannerから登録」** から、Planner経由の情報も通常の管理データとして登録できます。Microsoft Graphへの接続は行いません。

1. Teamsのメッセージの「…」から「Plannerタスクを作成」を使い、Plannerにタスクを残します。
2. Plannerのタスク名・メモをコピーします。期限と元Teamsリンクも確認しておきます。
3. MY仕事管理の「Plannerから登録」を開き、「まとめて貼り付け」へ貼り付けて **「空欄に取り込む」** を押します。対応ブラウザでは **「クリップボードから取り込む」** でも入力できます。読み取りが制限された場合は手動で貼り付けます。
4. タイトル・期限・メモ・Teamsリンク・種類を確認して保存します。各項目へ直接入力しても登録できます。期限付き作業だけは期限必須です。メモ・あとで確認・アーカイブ保管は期限なしでも登録できます。

コピーする本文の例：

```text
資料提出
期限：2026-10-03 18:00
新宿店の企画資料を確認して提出
https://teams.microsoft.com/l/message/元のメッセージのリンク
```

- 先頭の内容行をタイトルにし、**貼り付けた全文をメモに保持**します。`タイトル：` / `タスク名：` の行がある場合はその内容をタイトルにします。
- `期限：` / `期限日：` の行だけを期限として読み取ります。年を含む `2026-10-03`、`2026/10/3`、`2026年10月3日` と、任意の `18:00` に対応。本文に出てくる日付だけから期限を推測しません。
- 年のない日付や不正な日付は、画面でお知らせします。期限欄で指定してください。時刻がないときは設定の初期値を使います。
- 本文中のHTTPSのTeamsリンクを補います。Planner自身のリンクや他サイトのリンクをTeamsリンクとして取り込みません。
- **入力済みの項目は上書きしません。** 内容を差し替える場合は該当欄を空にして取り込むか、直接編集します。種類は自分で選びます。
- アラーム・完了状態は任意の折りたたみ欄にあります。登録後は通常の一覧・詳細・編集・検索・カレンダー・完了・保管・バックアップで扱えます。

Plannerを経由しても、この版では情報の受け渡しはコピー＆ペーストです。**Plannerにも作業を残したい場合に向いています。** MY仕事管理だけに残すなら、この画面へTeams本文を直接貼り付ければ、Plannerで作成する手間を省けます。MY仕事管理での編集・完了はPlanner側に反映しません。

登録経路は `source: "planner"`、`extensions.planner.importMethod: "manual"` として保持します。手動登録ではPlanner task IDは未設定です。既存のバックアップ形式・保存先・データバージョンは変えていません。

### アラーム

初期候補は **前日（期限時刻と同じ時刻） / 当日1時間前（期限日時の1時間前）** の2段階で、初期状態はOFFです。ON/OFFと日時をそれぞれ変更できます。「期限から候補日時を再設定」で再計算できます。期限が00:00〜00:59の場合、1時間前は前日の夜になります。期限なしのメモ・あとで確認でも日時を手動で指定できます。

アプリを開いている間は30秒ごと、アプリに戻ったときは直ちに確認します。時刻に達した未確認のアラームを画面上部に表示し、「確認済み」にすると消えます。保管中・完了済みの情報には鳴りません。音・OS通知・iPhoneプッシュ通知はありません。アプリを閉じている間には通知せず、次に開いたときに表示します。

### 2. 予定

自分の予定は月カレンダーです。期限付き作業・期限付きメモ・期限付きあとで確認を表示し、日付を選ぶとその日の一覧が出ます。完了済み・保管済みは表示しません。PC・iPadでは短いタイトル、iPhoneでは小さな色付き印で予定のある日を表示します。月移動・今日への移動・選択日に登録する操作ができます。

他メンバーの予定は **SV部（50名）/ GN SV（20名）/ その他（20名）** に分けています。表示日を変更でき、初期値は当日です。`名前：予定の1行目` を表示し、名前の行から全文を確認・編集できます。予定は日付ごとに保存されるため、翌日の登録で前日の情報は上書きされません。

### 3. その他

- **Teams送信予約**：送信先グループ名・送信予定日時・本文・状態（未送信/送信済み）・任意のTeamsチャットリンクを保存。遠い将来の日付も登録できます。未送信/送信済み/すべてで絞り込み、編集・削除できます。
- 時刻を過ぎた未送信予約があると **「送信予定があります」** を各ページの上部に表示。詳細 → 本文をコピー → Teamsで手動送信 → 送信済みにする、の順で使用します。**送信済みにする操作だけではTeamsへ送信されません**。
- **メンバー管理**：追加、所属グループ変更、名前・日付ごとの予定編集、削除。グループ人数上限は保存時・復元時に検証します。
- **設定**：新規登録時の期限時刻、アプリ内アラーム全体のON/OFF、カレンダー週の開始曜日。
- **バックアップ/復元**：次の項目を参照。

PC・iPadは左側、幅700px以下では下部に管理・予定・その他のナビゲーションを置いています。iPhoneでも新規登録・編集は可能です。詳細画面はキーボード操作・スクロール・画面幅に対応します。

## 保存・バックアップ・復元

### 端末内保存

- 第一候補は **IndexedDB**（DB名 `my-shigoto-kanri-v1`、`documents` ストアの `state`）。各操作は1つのトランザクションで検証・保存します。保存成功後に画面を更新します。
- 初回にIndexedDBが使えなければ **LocalStorage** へ切り替え、画面で通知。選ばれた保存先を記憶し、再起動で別の保存先に切り替わることを避けます。既にIndexedDBを利用していた場合は、開けないときに空の代替DBへ切り替えずエラーを表示します。
- 同じサイトの別タブ間は保存を通知して一覧を更新。編集中の情報が別タブで変更された場合は古い編集の上書きを拒否します。
- 端末・ブラウザ・サイトのURL（オリジン）が異なるとデータは別です。localhostから公開URLへの移行もJSONで行います。
- バックアップファイルは本文・メンバー予定を含みます。保管先は利用者が選びます。通常のJSONで、暗号化はしていません。
- ブラウザのサイトデータ削除、プライベートモード、端末故障によってデータが失われる場合があります。定期的に書き出してください。

### 書き出し

「その他 → バックアップ書き出し」で、管理情報・全メンバーの日付別予定・全送信予約・設定・Microsoft連携用拡張領域を一緒にJSON保存します。最大10MB。前回の書き出し日時も画面に表示します。OSの保存画面・ダウンロード先で保存完了を確認してください。

### 復元・別端末への移行

1. 移行元でJSONを保存します。
2. 移行先のアプリで「その他 → バックアップから復元」を選びます。
3. ファイル形式・バージョン・日付・必須項目・ID重複・人数上限などを検証します。
4. 件数が表示されます。必要なら「現在のバックアップを保存」を押します。
5. 「現在のデータを置き換えることを確認しました」にチェックし、復元します。

復元は**全置き換え**です。自動マージ・自動同期はありません。不正なファイルでは保存処理を行いません。削除操作にも確認を表示しますが、ごみ箱はありません。削除したデータの復旧はバックアップから行います。

## ファイル構成

```text
index.html                      日本語のエントリー画面・PWAメタ情報
styles.css                      配色・レスポンシブ・詳細ダイアログ
manifest.webmanifest            PWA manifest
sw.js                           アプリ資材のオフラインキャッシュ
assets/                         SVG・PNG・Apple・maskableアイコン
src/
  app.js                        画面遷移とUIイベントの調整
  domain/
    model.js                    データモデル・検証・検索・期限計算
    actions.js                  登録・完了・メンバー・予約などの更新操作
  storage/
    repository.js               抽象Repository・IndexedDB・LocalStorage
    backup.js                   JSON書き出し・復元の検証
  integrations/
    teams.js                    手動Teams provider・メッセージ変換
    planner.js                  手動Planner provider・コピー解析・将来のtask/details変換
    outlook.js                  手動Outlook provider・共通カレンダー変換
    onedrive.js                 将来のOneDrive Repositoryの実装場所
  notifications/alarms.js       アラーム・送信時刻の判定
  ui/
    layout.js                   サイド/下部ナビゲーション
    manage.js                   4種類の1行一覧・検索
    item-detail.js              詳細・登録編集フォーム
    planner-import.js           Plannerから登録・空欄取り込み・クリップボード補助
    schedule.js                 カレンダー・メンバー予定一覧
    members.js                  メンバー詳細・編集
    reservations.js             送信予約一覧・詳細・編集
    other.js                    メンバー管理・設定・バックアップUI
    alerts.js                   アラーム・送信予定のお知らせ
    dialog.js                   ダイアログ・未保存確認・保存エラー
    helpers.js                  安全な文字表示・アイコン
  pwa.js                        インストール案内・SW登録
  webmcp.js                     対応ブラウザ向け検索・登録フォーム開始
tests/                          任意のブラウザ用テスト（公開時は省略可能）
  index.html                    確認結果画面
  run.js / harness.js            実行・結果表示・検証補助
  domain.test.js                データ・保存・バックアップ等の確認
  planner.test.js               Planner貼り付け・4種類・将来のAPI入力変換
  static.test.js                相対参照・配信形式・PWA資材確認
.nojekyll                       GitHub Pages用
README.md                       使い方・公開・ローカル確認・将来の連携
動作確認.md                      確認した範囲の記録
```

## データ設計

全体は `schemaVersion: 1`、`items`、`members`、`reservations`、`settings`、`updatedAt` を持ちます。バックアップは `app`、`backupVersion`、`exportedAt`、`data` で包みます。バージョンが違うバックアップは拒否し、将来は `backup.js` に明示的な移行処理を追加します。

| 管理情報の項目 | 内容 |
| --- | --- |
| `id` | UUIDによる一意ID |
| `type` | `task / memo / review / archive` |
| `title`, `body` | タイトル・全文 |
| `dueDate`, `dueTime` | `YYYY-MM-DD`、`HH:mm`（未設定はnull） |
| `alarms[]` | ID・候補名・ON/OFF・ローカル日時・確認日時 |
| `teamsLink` | 元Teamsリンク（HTTPS） |
| `completed`, `completedAt` | 完了状態・完了日時（ISO形式） |
| `archived`, `originalType` | 保管状態・保管前の種類 |
| `source` | `manual`、将来の`teams`等 |
| `extensions` | Teams message/chat/tenant ID、Outlook ID、同期情報等の拡張領域 |
| `createdAt`, `updatedAt` | 内部の作成・更新日時 |

メンバーは `id / name / group / schedules / extensions / updatedAt` を持ち、`schedules` は `{ "2026-09-29": "当日の全文" }` の日付別辞書です。予約は `id / groupName / scheduledAt / body / teamsLink / status / sentAt / extensions / createdAt / updatedAt` を持ちます。

期限・予約・アラームの日時は**端末のローカル時間**として扱います。日本国内での利用を想定しています。作成・完了などの記録はISOの絶対日時です。海外の端末も含む同期へ拡張する際は、期限にIANAタイムゾーン（例：Asia/Tokyo）を追加して移行してください。

## 将来Microsoft Graph APIへ連携する際の差し替えポイント

この版にはMicrosoft OAuth・Graph SDK・Graph通信はありません。UIと保存層・連携層を分離しており、会社の許可後に下記の実装を追加できます。Microsoftの認証・権限・テナントポリシーは、その時点で会社管理者と確認してください。

| 拡張 | 実装場所 / 契約 |
| --- | --- |
| Teamsから直接登録・本文自動取得 | `integrations/teams.js` に認証済みのTeams providerを追加。Teams側拡張（メッセージ操作/アプリ等）からの入力を `itemFromTeamsMessage()` に渡す。`plainText` の先頭行→タイトル、全文→本文、`webUrl`→元リンク、ID→`extensions.teams` を変換 |
| 自分のPlannerタスクの自動取得 | `integrations/planner.js` の `ManualPlannerProvider` と同じ `getMyTasks() / getTaskDetails(taskId)` を持つGraph providerを追加。取得したtaskとdetailsを `itemFromPlannerTask(task, details, options)` へ渡し、通常の `saveItem()` とRepositoryで保存。元task IDで既存情報を照合し、手動編集の上書きルールと重複防止を実装 |
| Teams長期予約の自動送信 | `ManualTeamsProvider.sendMessage()` を実装するproviderへ差し替え。ブラウザを閉じても実行するには、認証管理・永続キュー・重複送信防止を備えたサーバー側スケジューラーを別途用意。現行の送信予定判定と予約モデルを再利用 |
| Outlook予定の取得・作成・修正 | `integrations/outlook.js` のproviderへ認証とAPI操作を追加。取得結果を共通`CalendarEvent`（id/title/date/time/type/source/startsAt等）に正規化して `calendarEvents(items, externalEvents)` に統合。現在は `app.js` で手動providerを生成 |
| 他メンバー予定の取得 | Outlook providerの `getSchedules()` をGraph側の機能に接続し、メンバー`extensions`にユーザーID等を保持。日付別手動予定との優先ルールを決める |
| OneDrive App Folder同期 | `integrations/onedrive.js` の `OneDriveRepository` に `load() / update(mutator) / replace(state)` を実装。`storage/repository.js` の `openRepository()` で選択。スキーマ検証・バックアップ形式・UIは再利用 |

保存層の `update(mutator)` は、**最新状態を読み込み → 同期的な更新関数を適用 → 全体検証 → 永続化成功後に結果を返す** 契約です。OneDrive版は単純なファイル上書きではなく、ETag等による競合検知・ID単位のマージ・削除履歴・オフラインキュー・再試行を追加してください。UI操作をネットワーク保存に直結させず、IndexedDBをローカルキャッシュとして残す構成も可能です。

Microsoftへの接続時は `capabilities` で使用可能な機能を判断し、許可されていない機能でも現在の手動管理を維持できます。現在の「送信済みにする」は利用者の記録操作です。自動送信版はAPIの成功確認後に状態を変更する実装が必要です。

Plannerの変換境界では、taskのタイトル・UTC期限・完了状態と、detailsの説明本文を通常の管理モデルへ変換します。元のtask / plan / bucket ID、task / detailsのETag、取り込み方法・日時を `extensions.planner` に保持します。Teamsリンクを添付参照から取得する場合はprovider側で正規化し、`options.teamsLink` に渡してください。参考：[Microsoft公式・plannerTask](https://learn.microsoft.com/en-us/graph/api/resources/plannertask?view=graph-rest-1.0)、[Microsoft公式・taskの詳細取得](https://learn.microsoft.com/en-us/graph/api/plannertaskdetails-get?view=graph-rest-1.0)。

## 動作確認・開発

ブラウザで **http://localhost:4173/tests/** を開くと自動確認が実行されます。公開先に `tests/` もアップロードした場合は `https://ユーザー名.github.io/リポジトリ名/tests/` でも実行できます。Node.js・Python・テスト用パッケージは不要です。テスト画面はアプリの業務データを書き換えません。IndexedDBのテストは独立した一時DBを作成し、終了時に削除します。

全18件のブラウザテストで、期限必須、完了・戻す、日付、検索、アラーム、カレンダー、3グループの上限、予約、バックアップ、競合、Teams入力、IndexedDB保存、Plannerのコピー解析・4種類の保存・将来のAPI入力変換を確認します。HTML/manifestの相対参照、SWの全32件の資材、JavaScriptの配信形式とモジュールの読み込みも確認します。

ブラウザ確認では、登録・再読み込み後の保持・検索・完了・未完了戻し・メンバー予定・予約・JSON書き出し/復元・スマートフォン/タブレット幅を確認します。実機Safariでのホーム画面追加は利用する端末で確認してください。

アイコンは既に同梱してあります。アプリの起動・テスト・公開にNode.jsやPythonは使いません。
