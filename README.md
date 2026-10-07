# MY仕事管理

日本語の業務管理PWAです。**Microsoft 365のアプリ登録やAPI権限なしで単体動作**します。PC・iPadで登録・編集、iPhoneで一覧確認しやすい構成です。`index.html` を入口とするHTML / CSS / JavaScriptの静的アプリです。**Node.js・Python・npm・追加ソフト・ビルドは不要**です。GitHub Pagesにそのままアップロードして利用できます。データは各ブラウザのIndexedDBに保存します。

## すぐに使う

### PC・iPad・iPhoneで使う

1. 次の手順でGitHub Pagesへ公開します。
2. 公開されたHTTPSのURLを各端末のブラウザで開きます。会社PC側で起動コマンドを実行する必要はありません。
3. Power Automateで生成したJSONは、初回に「To Do / Planner取込」でフォルダーを設定し、通常は管理画面の「フォルダから一括取込」で取り込みます。手動登録は「新規登録」を使います。初回は空のデータで始まります。
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

**更新時**：`sw.js` の `VERSION` を変更して公開します。アプリは未保存編集を守るため強制更新しません。画面下部に更新案内が出たら、編集中の内容を保存して **アプリを更新** を押します。旧版の画面では更新ボタンがないため、その場合は同じアプリのタブ・PWA画面をすべて閉じて開き直してください。`Ctrl + Shift + R` だけでは待機中のService Workerが切り替わらない場合があります。Service Workerの更新でIndexedDBの業務データは消しません。

PWAの仕様参考：[MDN・PWAのインストール要件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[MDN・インストール方法](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing)

## 画面と使い方

### 1. 管理

一覧は必ず **期限付き作業 → メモ → あとで確認 → アーカイブ保管** の順です。1件1行で、タイトルは【】形式から始めます。長いタイトルは1行に省略し、詳細で全文を読めます。

- **期限付き作業**：期限必須。手動登録の時刻初期値は18:00（設定で変更）。期限超過は上部に赤く表示。チェックすると完了日を保持してアーカイブへ移動。To Do / Planner JSON取込分は、当日「本日期日」、日本時間の翌日0:00から「期限超過」と表示します。どちらも赤い注意喚起の背景と左ラインを表示し、上部の「期限超過」件数には翌日以降だけを含めます。
- **メモ / あとで確認**：期限なしで保存できます。期限を設定するとカレンダーにも表示。
- **アーカイブ保管**：手動保管と完了した作業を同じ一覧で検索。完了日を詳細で確認できます。完了した作業は「未完了に戻す」で元の種類へ戻せます。
- **詳細**：タイトル、種類、期限日・時刻、本文、Teamsリンク、アラームを確認。編集・完了・削除もここから行います。
- **検索**：タイトル、全文、期限（`2026-10-03` / `10月3日`）、種別、Teamsリンク、現在の「本日期日」「期限超過」状態を対象に検索。人名・店舗名・部署名・商品名・案件名をタイトルや本文に書いておけば検索できます。空白で複数の語を入れるとすべての語を含む情報を表示。全角英数字も検索できます。種類の絞り込みを併用できます。
- 登録日は内部保持のみで、一覧・詳細に表示しません。優先度はありません。

Teamsの本文は手動でコピーし、タイトル・メモ本文に貼り付けます。TeamsリンクはTeamsの「リンクをコピー」から貼り付けます。現バージョンはTeamsへのメッセージ取得・送信・認証要求を行いません。

### To Do / Planner取込（Power AutomateのJSON）

既存の **Teams → Planner → Microsoft To Do → Power Automate → OneDrive** で作られたJSONを、管理画面の **「To Do / Planner取込」** から取り込みます。Graph API・Entra認証は追加していません。

**Windowsの初回設定（対応するEdge / Chrome）**

1. OneDriveの同期完了を確認し、管理 → To Do / Planner取込 → **取込フォルダーを設定** を押します。
2. ローカルのOneDrive同期フォルダー `MY仕事管理/ToDo取込` を選び、読取を許可します。Web上のOneDriveのURLを指定する機能ではありません。
3. **フォルダーから一括取込** を押します。初回に時差表記のない日時があれば、Microsoft To Doの実際の期限日とプレビューを照合してUTC相当か日本時間かを選び、「この内容で取り込む」を押します。選んだ解釈は保存します。

**通常運用**：管理画面右上の **フォルダから一括取込** を1回押すと、設定済みフォルダー直下のJSONを読み、未登録だけを保存して結果を表示します。時差表記のない期限日時は、保存済み設定にかかわらず **UTC相当 → 日本時間へ変換** を使用します。詳細画面に保存した日時解釈は上書きしません。未設定・権限切れ・フォルダー消失・非対応ブラウザでは、案内付きの **To Do / Planner取込** 画面を開きます。権限切れの場合も、直接取込は保存を開始せず、詳細画面で再許可・再設定してから利用します。

フォルダーハンドルは、このブラウザ専用のIndexedDBに保存します。ブラウザ再起動後に再許可が必要なら、ボタン操作に続くブラウザの案内に従います。権限拒否・移動・消失の場合は **取込フォルダーを再設定** を使います。永続保存できない場合は画面に通知し、そのセッションのみ利用できます。API非対応や会社のポリシーで利用できない場合は **JSONファイルを選択** を使います。

**iPhone / iPad**：Safariの管理 → To Do / Planner取込 → **JSONファイルを選択** → 「ブラウズ」からOneDriveを選び、`MY仕事管理/ToDo取込` 内のJSONを選択 → **この内容で取り込む**。OneDriveがファイル提供元として表示される範囲で対応します。表示されなければ「ファイル」アプリで利用可能な場所へ保存して選択します。複数選択できない提供元では数回に分けます。PCでもこの複数ファイル方式を使えます。

- 期限あり → **期限付き作業**。`dueDate` がない・空・null → **あとで確認**へ自動登録。期限なしを作業にしたり、未登録のまま残したりはしません。
- `title` → タイトル、`body` → 改行を含む原文の本文、本文内のTeams URL → `teamsLink`。JSONの `id` で重複判定します。必要項目は `title / body / id` です。不正なdueDateはエラーにします。
- 1回200JSON・1ファイル1MBまで。フォルダーに200件を超えるJSONがある場合は処理を開始せず、ファイル選択で分割する案内を表示します。壊れたJSON・読取失敗・必要項目不足はファイル単位で記録し、他の正常ファイルは取り込みます。
- 結果は「新規登録」「うち、あとで確認として登録」「重複スキップ」「エラー」とファイル別詳細で表示します。
- 元JSONの変更・移動・削除、常時監視、OneDriveへの直接アクセスは行いません。クラウド上だけのファイルは、オンラインでOneDriveを同期してから選択してください。

`dueDate` に `Z` または時差があれば、Asia/Tokyoへ変換します。`2026-10-04T15:00:00` のように時差表記がなければ、To Doの画面と照合して解釈を選びます。UTC相当ならこの例は10月5日00:00、日本時間なら10月4日15:00です。JSONだけで元の時刻の解釈を確定できないため、勝手に決めません。日本時間として保持する例外運用は「To Do / Planner取込」のラジオボタンで指定します。個別JSON選択、フォルダー変更、権限再設定もこの詳細画面を使用します。詳細画面内の「フォルダーから一括取込」は、そこで選択した日時解釈に従います。

**取込データは日付単位の期限判定**です。期限日10月7日なら、当日は赤い背景・左赤線に「本日期日」、日本時間の10月8日0:00から「期限超過」と表示します。上部の期限超過件数には翌日以降だけを含めます。期限日前は通常表示。手動登録・手動貼り付けの時刻単位判定、アラーム日時、一覧・検索・並び順も従来どおりです。

取込元情報は `extensions.microsoftTodo` に保持します。`externalId / sourceFileName / sourceDueDate / importedAt / completedAt / deleteRequestedAt` を備え、バックアップにも残します。旧版のファイル名が未保存の場合、同じJSONを再取込すると重複をスキップしながら実際のファイル名だけを補完します。タイトルや本文を上書きしません。

JSONがない場合は、取込画面の下部にある **JSONがない場合は手動貼り付け** から従来の補助フォームを使えます。これにはTo Do IDの重複判定はありません。アプリで編集・完了してもTeams・Planner・To Doへは反映されません。

フォルダーAPIの仕様参考：[Chrome公式・File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)。読取権限と選択ハンドルの保持を利用しています。

### 元JSONの削除候補を書き出す

**その他 → 元JSONの整理 → JSON削除対象を書き出す** で、Power Automate用のJSON配列をダウンロードします。

- アプリで手動削除したTo Do取込データ：業務情報を削除し、ID・元ファイル名・削除依頼日時・完了日時を `jsonDeletionHistory` に保持。元JSONは直ちに候補になります。
- 完了したTo Do取込データ：完了日時から **180×24時間** 経過後に候補になります。業務情報はアーカイブに残します。未完了へ戻した情報や、単に保管した未完了情報は候補にしません。
- 通常の手動登録情報は対象外です。書き出しだけではOneDriveから何も削除しません。Power Automate側のフローは今回含みません。

配列の各行は `id / fileName / deleteRequestedAt / completedAt / reason`。`reason` は `manual-delete` または `completed-over-180-days`、該当しない日時はnullです。旧データで元ファイル名が不明の場合は `fileName: null` とし、件数と補完方法を画面に表示します。存在しないファイル名を推測しません。空の候補も `[]` として書き出せます。

### アラーム

初期候補は **前日（期限時刻と同じ時刻） / 当日1時間前（期限日時の1時間前）** の2段階で、初期状態はOFFです。ON/OFFと日時をそれぞれ変更できます。「期限から候補日時を再設定」で再計算できます。期限が00:00〜00:59の場合、1時間前は前日の夜になります。期限なしのメモ・あとで確認でも日時を手動で指定できます。

アプリを開いている間は30秒ごと、アプリに戻ったときは直ちに確認します。時刻に達した未確認のアラームを画面上部に表示し、「確認済み」にすると消えます。保管中・完了済みの情報には鳴りません。音・OS通知・iPhoneプッシュ通知はありません。アプリを閉じている間には通知せず、次に開いたときに表示します。

### 2. 予定

自分の予定は月カレンダーです。期限付き作業・期限付きメモ・期限付きあとで確認を表示し、日付を選ぶとその日の一覧が出ます。完了済み・保管済みは表示しません。PC・iPadでは短いタイトル、iPhoneでは小さな色付き印で予定のある日を表示します。月移動・今日への移動・選択日に登録する操作ができます。


Teams送信予約は予定画面のカレンダー下にあります。管理画面とその他画面には送信予定の通知・件数・確認ボタンを表示しません。予約データと登録・編集・送信済み管理は保持します。

- **Teams送信予約**：送信先グループ名・送信予定日時・本文・状態（未送信/送信済み）・任意のTeamsチャットリンクを保存。遠い将来の日付も登録できます。未送信/送信済み/すべてで絞り込み、編集・削除できます。
- 時刻を過ぎた未送信予約があると **「送信予定があります」** を予定画面の上部に表示。詳細 → 本文をコピー → Teamsで手動送信 → 送信済みにする、の順で使用します。**送信済みにする操作だけではTeamsへ送信されません**。

### Teams送信予約のJSON書き出し（Power Automate用）

自動送信フローを作るための予約JSONを、1予約につき1ファイルで出力できます。今回はJSON書き出しまでで、Power Automateフローの作成・Teamsへの自動送信・送信結果の自動取込は行いません。

**Windows Edge / Chromeの初回設定**

1. WindowsのOneDrive同期フォルダーに `MY仕事管理/Teams送信予約` を作成します。
2. アプリの **予定 → Teams送信予約 → 保存フォルダー設定 → 保存フォルダーを選択** を押します。
3. 上記の「Teams送信予約」フォルダーそのものを選び、ブラウザの書込許可を確認します。アプリから任意のOneDriveパスを探したり、クラウドへ直接接続したりはしません。
4. ハンドルは予約出力専用IndexedDB（`my-shigoto-reservation-export-folder-v1`）に保存します。To Do取込のDB・読取許可・保存済み設定は変更しません。ハンドル・OS権限はバックアップに含みません。ブラウザ再起動後に再許可が必要になる場合があります。

**書き出し・更新**

- 予約を登録・編集して保存したら、一覧の **予約JSONを書き出す** を押します。画面の絞り込みに関係なく全予約（送信済みも含む）と取消履歴を保存します。
- 1件だけ更新する場合は、予約の詳細から **この予約のJSONを書き出す** を押します。保存フォルダーが未設定なら1件をダウンロードします。設定済みなら同じIDのJSONをフォルダーに保存・更新します。
- ファイル名は既存の予約IDそのまま＋`.json`。新規予約はUUIDを生成し、編集でIDを変えないため同じファイルを更新します。
- 保存・取消・エラー件数とファイル別結果を表示します。1件の失敗で他の予約の処理は停止しません。壊れた同名JSON・別のファイル・保存先にある新しい更新は上書きしません。予約本体の保存とJSON出力は別操作です。出力に失敗してもIndexedDBの予約は保持され、再度書き出せます。
- 保存はWindowsの同期フォルダーに対するローカル書込です。OneDriveクラウドへの到達はOneDriveクライアントの同期状況を確認してください。オフラインでもローカル書込できる範囲で利用し、オンライン復帰後にOneDriveが同期します。

**削除と取消**

予約を削除すると、画面から削除し、取消用の予約スナップショットと削除日時を `reservationDeletionHistory` に保持します。この履歴もバックアップ/復元に含めます。**削除後に一覧の「予約JSONを書き出す」を押すと**、同じIDのJSONを `status: "cancelled" / deleted: true / deletedAt` に更新します。ファイルそのものは自動削除しません。書き出すまでは以前のJSONが残ります。将来のフローを動かす場合は、取消の書き出しと同期を予約時刻までに完了させてください。

**iPhone/iPad・フォルダー保存非対応ブラウザ**

予約の詳細の **JSONをダウンロード** を使い、ファイルアプリ等からOneDriveの `MY仕事管理/Teams送信予約` へ手動保存してください。編集時も同じ名前で置き換えます。ダウンロード先で自動的に連番が付くことがあるため、予約IDと一致する名前を確認してください。取消JSONの一括更新はWindowsのフォルダー書き出しを使います。端末間の予約データは自動同期されないため、必要なら先にバックアップで移行してください。

**JSON例（UUID・日時・本文は説明用）**

```json
{
  "schemaVersion": 1,
  "source": "my-shigoto-kanri",
  "id": "dce01a83-4360-4e6e-bce2-7c8580747b26",
  "scheduledAt": "2026-12-25T09:00:00+09:00",
  "timeZone": "Asia/Tokyo",
  "destinationName": "テスト用グループ",
  "destinationType": "chat",
  "destinationId": null,
  "teamsLink": "",
  "body": "TEST\n2行目",
  "status": "pending",
  "sentAt": null,
  "deleted": false,
  "deletedAt": null,
  "createdAt": "2026-10-07T00:00:00.000Z",
  "updatedAt": "2026-10-07T00:00:00.000Z",
  "extensions": {}
}
```

送信予定日時の入力は日本時間として扱い、端末の時間帯による再変換をせず `:00+09:00` を付けます。作成日・更新日・送信済み日時は従来のISO文字列を維持します。現行の予約画面は送信先表示名と任意のTeamsリンクを持ち、チャットIDを取得しません。既存の `extensions.teams.chatId` があれば `destinationId` に転記し、その他の拡張情報も全文保持します。表示名やリンクから架空のIDを生成しません。今回の出力先種別は `chat` です。

将来Power Automateは `status == pending` かつ `deleted == false` を確認し、日本時間オフセット付きの `scheduledAt` と実際の宛先IDを使って処理してください。**このJSONはアプリ側の予約スナップショット**です。送信実績・処理中状態・予約IDによる二重送信防止はフロー側の別台帳で保持し、アプリの再書き出しで送信済み台帳を戻さない構成にしてください。表示名だけでは同名チャットを区別できないため、実際の宛先との対応付けが必要です。

ブラウザAPIの根拠：[Chrome公式・File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)、[MDN・showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)。静的PWA・GitHub PagesのHTTPSで動き、Graph / Entra / APIキー / Node.js / Pythonは追加しません。

### 3. その他

- **設定**：新規登録時の期限時刻、アプリ内アラーム全体のON/OFF、カレンダー週の開始曜日。
- **バックアップ/復元**：次の項目を参照。

PC・iPadは左側、幅700px以下では下部に管理・予定・その他のナビゲーションを置いています。iPhoneでも新規登録・編集は可能です。詳細画面はキーボード操作・スクロール・画面幅に対応します。

## 保存・バックアップ・復元

### 端末内保存

- 第一候補は **IndexedDB**（DB名 `my-shigoto-kanri-v1`、`documents` ストアの `state`）。各操作は1つのトランザクションで検証・保存します。保存成功後に画面を更新します。
- 初回にIndexedDBが使えなければ **LocalStorage** へ切り替え、画面で通知。選ばれた保存先を記憶し、再起動で別の保存先に切り替わることを避けます。既にIndexedDBを利用していた場合は、開けないときに空の代替DBへ切り替えずエラーを表示します。
- 同じサイトの別タブ間は保存を通知して一覧を更新。編集中の情報が別タブで変更された場合は古い編集の上書きを拒否します。
- 端末・ブラウザ・サイトのURL（オリジン）が異なるとデータは別です。localhostから公開URLへの移行もJSONで行います。
- バックアップファイルは本文・送信予約・削除対象履歴を含みます。保管先は利用者が選びます。通常のJSONで、暗号化はしていません。
- ブラウザのサイトデータ削除、プライベートモード、端末故障によってデータが失われる場合があります。定期的に書き出してください。

### 書き出し

「その他 → バックアップ書き出し」で、管理情報・全送信予約・削除対象履歴・設定・Microsoft連携用拡張領域を一緒にJSON保存します。最大10MB。前回の書き出し日時も画面に表示します。OSの保存画面・ダウンロード先で保存完了を確認してください。

### 復元・別端末への移行

1. 移行元でJSONを保存します。
2. 移行先のアプリで「その他 → バックアップから復元」を選びます。
3. ファイル形式・バージョン・日付・必須項目・ID重複・保存件数などを検証します。
4. 件数が表示されます。必要なら「現在のバックアップを保存」を押します。
5. 「現在のデータを置き換えることを確認しました」にチェックし、復元します。

復元は**全置き換え**です。自動マージ・自動同期はありません。不正なファイルでは保存処理を行いません。削除操作にも確認を表示しますが、ごみ箱はありません。削除したデータの復旧はバックアップから行います。取込メタデータ・JSON削除対象履歴・フォルダー名・日時解釈の設定も復元します。OSのアクセス権とハンドルはJSONに含めず、復元時にこのブラウザのハンドルを解除します。復元後は取込フォルダーと予約JSON保存フォルダーを再設定してください。

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
    actions.js                  登録・完了・削除履歴・予約などの更新操作
    json-cleanup.js             元JSONの削除候補と180日判定
    reservation-export.js       予約JSON形式・日本時間・ファイル名・取消出力
  storage/
    repository.js               抽象Repository・IndexedDB・LocalStorage
    backup.js                   JSON書き出し・復元の検証
    import-folder.js            フォルダーハンドル専用IndexedDB
  integrations/
    teams.js                    手動Teams provider・メッセージ変換
    planner.js                  手動Planner provider・コピー解析・将来のtask/details変換
    todo-import.js              To Do JSON検証・期限変換・Teams URL抽出・ID重複判定
    todo-files.js               ファイル/フォルダーの読取と安全制限
    import-folder.js            フォルダー選択・読取許可・再設定
    reservation-export.js       専用の書込フォルダー・許可・同名更新・結果
    outlook.js                  手動Outlook provider・共通カレンダー変換
    onedrive.js                 将来のOneDrive Repositoryの実装場所
  notifications/alarms.js       アラーム・送信時刻の判定
  ui/
    layout.js                   サイド/下部ナビゲーション
    manage.js                   4種類の1行一覧・検索
    item-detail.js              詳細・登録編集フォーム
    planner-import.js           補助の手動貼り付け・空欄取り込み・クリップボード補助
    todo-import.js              フォルダー/複数JSON・期限確認・取込結果
    schedule.js                 自分のカレンダーと日別一覧
    reservations.js             送信予約一覧・詳細・編集
    reservation-export.js       保存フォルダー設定・書き出し結果UI
    other.js                    設定・バックアップ・元JSON整理UI
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
  todo-import.test.js           To Do JSON・重複・日時・復元・オフライン資材
  todo-folder.test.js           フォルダー読取・権限・取込UIの確認
  json-cleanup.test.js          削除履歴・180日・旧データ移行・残存UI
  manage-shortcuts.test.js      UTC直接取込・設定誘導・通知と予約の配置
  reservation-export.test.js   予約出力・実ファイルAPI・更新・取消・保存互換性
  static.test.js                相対参照・配信形式・PWA資材確認
.nojekyll                       GitHub Pages用
README.md                       使い方・公開・ローカル確認・将来の連携
動作確認.md                      確認した範囲の記録
```

## データ設計

全体は `schemaVersion: 2`、`items / reservations / reservationDeletionHistory / jsonDeletionHistory / settings / updatedAt` を持ちます。旧schemaVersion 1を読み込むと2へ移行し、廃止したmembers項目は読み捨てます。旧バックアップの管理情報・送信予約は復元できます。新しい保存・書き出しにはmembersは含めません。バックアップの包みは `app / backupVersion: 1 / exportedAt / data` を維持し、未知の将来バージョンは拒否します。

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
| `source` | `manual`、`planner`、`microsoft-todo`等 |
| `extensions` | `microsoftTodo.externalId / sourceFileName / sourceDueDate / importedAt / completedAt / deleteRequestedAt`、Teams ID、Outlook ID、同期情報等の拡張領域 |
| `createdAt`, `updatedAt` | 内部の作成・更新日時 |

予約は `id / groupName / scheduledAt / body / teamsLink / status / sentAt / extensions / createdAt / updatedAt` を持ちます。

期限・予約・アラームの日時は**端末のローカル時間**として扱います。日本国内での利用を想定しています。To Do JSONの期限は取込時に **Asia/Tokyo** の日付・時刻へ変換します。タイムゾーン表記がない日時は、管理画面の直接取込ではUTC相当として日本時間へ変換し、詳細取込ではTo Do画面との照合に基づいて利用者が解釈を指定します。作成・完了などの記録はISOの絶対日時です。海外の端末も含む同期へ拡張する際は、期限にIANAタイムゾーンを追加して移行してください。

## 将来Microsoft Graph APIへ連携する際の差し替えポイント

この版にはMicrosoft OAuth・Graph SDK・Graph通信はありません。UIと保存層・連携層を分離しており、会社の許可後に下記の実装を追加できます。Microsoftの認証・権限・テナントポリシーは、その時点で会社管理者と確認してください。

| 拡張 | 実装場所 / 契約 |
| --- | --- |
| Teamsから直接登録・本文自動取得 | `integrations/teams.js` に認証済みのTeams providerを追加。Teams側拡張（メッセージ操作/アプリ等）からの入力を `itemFromTeamsMessage()` に渡す。`plainText` の先頭行→タイトル、全文→本文、`webUrl`→元リンク、ID→`extensions.teams` を変換 |
| 自分のPlannerタスクの自動取得 | `integrations/planner.js` の `ManualPlannerProvider` と同じ `getMyTasks() / getTaskDetails(taskId)` を持つGraph providerを追加。取得したtaskとdetailsを `itemFromPlannerTask(task, details, options)` へ渡し、通常の `saveItem()` とRepositoryで保存。元task IDで既存情報を照合し、手動編集の上書きルールと重複防止を実装 |
| To Do取込の自動化 | `integrations/todo-import.js` のJSON検証・期限変換・`importTodoRecords()` を再利用。将来の認証済みproviderから同じ `title / dueDate / body / id` を渡す。既存の `externalId` で重複を防ぎ、更新済みタスクを上書きするかは別途ルールを定義 |
| Teams長期予約の自動送信 | `ManualTeamsProvider.sendMessage()` を実装するproviderへ差し替え。ブラウザを閉じても実行するには、認証管理・永続キュー・重複送信防止を備えたサーバー側スケジューラーを別途用意。現行の送信予定判定と予約モデルを再利用 |
| Outlook予定の取得・作成・修正 | `integrations/outlook.js` のproviderへ認証とAPI操作を追加。取得結果を共通`CalendarEvent`（id/title/date/time/type/source/startsAt等）に正規化して `calendarEvents(items, externalEvents)` に統合。現在は `app.js` で手動providerを生成 |
| OneDrive App Folder同期 | `integrations/onedrive.js` の `OneDriveRepository` に `load() / update(mutator) / replace(state)` を実装。`storage/repository.js` の `openRepository()` で選択。スキーマ検証・バックアップ形式・UIは再利用 |

保存層の `update(mutator)` は、**最新状態を読み込み → 同期的な更新関数を適用 → 全体検証 → 永続化成功後に結果を返す** 契約です。OneDrive版は単純なファイル上書きではなく、ETag等による競合検知・ID単位のマージ・削除履歴・オフラインキュー・再試行を追加してください。UI操作をネットワーク保存に直結させず、IndexedDBをローカルキャッシュとして残す構成も可能です。

Microsoftへの接続時は `capabilities` で使用可能な機能を判断し、許可されていない機能でも現在の手動管理を維持できます。現在の「送信済みにする」は利用者の記録操作です。自動送信版はAPIの成功確認後に状態を変更する実装が必要です。

Plannerの変換境界では、taskのタイトル・UTC期限・完了状態と、detailsの説明本文を通常の管理モデルへ変換します。元のtask / plan / bucket ID、task / detailsのETag、取り込み方法・日時を `extensions.planner` に保持します。Teamsリンクを添付参照から取得する場合はprovider側で正規化し、`options.teamsLink` に渡してください。参考：[Microsoft公式・plannerTask](https://learn.microsoft.com/en-us/graph/api/resources/plannertask?view=graph-rest-1.0)、[Microsoft公式・taskの詳細取得](https://learn.microsoft.com/en-us/graph/api/plannertaskdetails-get?view=graph-rest-1.0)。

## 動作確認・開発

ブラウザで **http://localhost:4173/tests/** を開くと自動確認が実行されます。公開先に `tests/` もアップロードした場合は `https://ユーザー名.github.io/リポジトリ名/tests/` でも実行できます。Node.js・Python・テスト用パッケージは不要です。テスト画面はアプリの業務データを書き換えません。IndexedDBのテストは独立した一時DBを作成し、終了時に削除します。

全71件のブラウザテストで、正常/複数JSON、期限あり/なし、重複、読取失敗、上限、Teams URL、日本語・改行、UTC/JST、日付単位の期限と赤帯、手動の時刻期限、削除履歴、180日、バックアップ、旧データ移行、IndexedDB再読込、フォルダーUIと再許可、管理からのUTC直接取込・未設定誘導・権限切れ誘導、管理の予約通知除去と予定画面への予約配置、全40件のPWA資材を確認します。予約JSONの日本時間・編集・取消・旧バックアップ互換性・ブラウザ内実ファイル（OPFS）への保存と同名更新・ハンドルのIndexedDB往復も確認します。OSフォルダー選択と権限応答は模擬テスト、専用IndexedDBとFile読取は実際のブラウザAPIで確認します。実機Edge/ChromeのOSフォルダー選択・再起動後の権限維持、iPhone/iPadのOneDrive提供元は別途実機確認が必要です。

ブラウザ確認では、登録・再読み込み後の保持・検索・完了・未完了戻し・予約・JSON書き出し/復元・スマートフォン/タブレット幅を確認します。実機Safariでのホーム画面追加は利用する端末で確認してください。

アイコンは既に同梱してあります。アプリの起動・テスト・公開にNode.jsやPythonは使いません。
