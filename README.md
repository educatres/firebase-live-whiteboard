# ClassPad 即時同步手寫白板

以 iPad、手指與 Apple Pencil 為主要操作情境的課堂即時白板。老師不需建立正式帳號，可貼上學生名單並產生每人專屬連結；學生匿名進入後即可書寫，老師可多格監看、鎖定白板並在獨立圖層批注。

## 功能

- Firebase Anonymous Authentication 與 Realtime Database 即時同步
- 老師建立課堂、批次匯入最多 80 位學生、QR Code 與 CSV 連結
- 學生首次開啟連結後綁定匿名裝置，可由老師解除
- 學生只需開啟個人專屬網址即可綁定，不使用老師六位數密鑰
- 三層 Retina Canvas、Pointer Events、Apple Pencil 壓力、整筆橡皮擦
- 本機復原/重做、雙指 25%～400% 縮放與拖曳
- 4:3 固定白板比例，4／6／8／12 格即時監看、釘選優先排序、搜尋/篩選/輪播、全螢幕批注
- 永久老師連結與未遮蔽六位數密鑰，最多五台老師裝置享有相同管理權限
- 老師鎖定、清除圖層、本機合成下載 PNG
- 拒絕預設存取的 Firebase Security Rules 與 Emulator 權限測試

## 本機開發

需求：Node.js 22、pnpm 11、Java（只在執行 Firebase Emulator 時需要）。

```bash
cp .env.example .env
pnpm install
pnpm dev
```

在 `.env` 填入 Firebase Web App 設定。只有明確啟動 Emulator 時，才把 `VITE_USE_FIREBASE_EMULATORS` 設為 `true`。

## 驗證

```bash
pnpm test
pnpm test:rules
pnpm build
```

`test:rules` 會啟動 Authentication 與 Realtime Database Emulator，驗證老師、學生、其他匿名使用者和未登入使用者的允許/拒絕案例。

## Firebase 設定

1. Authentication → Sign-in method：啟用 Anonymous。
2. 建立 Realtime Database，區域建議 `asia-southeast1`，不要使用公開測試規則。
3. 安裝並登入 Firebase CLI，再部署規則：

   ```bash
   pnpm exec firebase login
   pnpm exec firebase use classroompad
   pnpm exec firebase deploy --only database
   ```

4. Authentication → Settings → Authorized domains 加入：
   - `educatres.github.io`
   - `localhost`
   - `127.0.0.1`

5. 權限資料會在首次使用後依規則建立於 `classes`、`students`、`boards`、`activeStrokes`、`presence`、`userClasses`、`teacherKeys`、`teacherKeyClaims`、`teacherSlots` 與 `boardLookup` 節點，不需手動建立空資料表。課程建立滿 48 小時後，會在老師下次使用首頁、管理頁或監看頁時自動清除。

## GitHub Pages

推送 `main` 後，`.github/workflows/deploy-pages.yml` 會測試、建置並部署 `dist`。Repository 的 Actions Secrets 需要：

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Firebase Web API key 會包含在公開前端 bundle；資料授權完全由 Authentication 與 `database.rules.json` 強制執行。禁止提交 Service Account、Admin SDK 私鑰或 `.env`。

## 權限與隱私

Firebase 匿名驗證明確使用瀏覽器本機持久化，建立課堂後也會暫存該課堂與老師 UID，跳轉管理頁時會先恢復同一身分再讀取權限。每個課堂另有永久老師連結與未遮蔽的六位數字密鑰；新裝置輸入正確密鑰後會加入課堂管理員，並與其他老師裝置享有相同完整權限。每個課堂最多五台老師裝置。請妥善保管老師連結與密鑰，只應輸入學生座號或暱稱，不應輸入身分證字號、電話、Email、住址或醫療資料。

完整需求請見 [SPEC.md](./SPEC.md) 與 [即時同步手寫白板規格書.md](./即時同步手寫白板規格書.md)。
