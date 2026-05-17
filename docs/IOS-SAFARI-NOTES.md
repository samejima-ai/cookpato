# iOS Safari 開発ノート

iPhone 11 / iOS Safari をターゲットとする本プロジェクトで実際に踏んだ落とし穴と対処。
新しいテキスト入力やジェスチャー UI を実装する前に**必読**。同じパターンが何度も再発するため、規約レベルで共有する。

---

## 1. IME × controlled input は壊れる

### 症状
日本語フリック入力中に文字が消える、多重反映される、削除キー無反応。

### 原因
1. `<input value={state}>` でローカル / 親 state を介する **controlled** 構造
2. `useComposition.shouldSkipChange()` で IME 未確定中の `onChange` を抑止
3. 親 state が更新されないと、React は次のレンダで input.value を **古いプロップ値で上書き**
4. iOS Safari の IME 内部状態とぶつかり、未確定文字が消える／多重反映される

### 対処
- **uncontrolled パターン**（`defaultValue`）に揃える
- 親 state は **永続化のためだけ**に更新する（DOM value を React で制御しない）
- 親プロップ変化で初期値を反映する必要がある場合は `key={...}` で再マウントさせる

### 該当箇所（修正済み）
- `MemoField`（`src/components/DayRow.tsx`）— `key={dateKey}` で日付切替時に再マウント
- ストック追加 input（`src/components/StockList.tsx`）— `key={draftResetKey}` で追加成功時に空に戻す
- `StockNameEditInput`（`src/components/StockList.tsx`）— 編集モード進入時にだけマウント

### 参考実装
料理行 textarea（`DayRow.tsx`）は最初から `defaultValue` で uncontrolled。これがあるべき形。

---

## 2. `setPointerCapture` の副作用

### 症状
長押しドラッグ中、指を動かしても他の行が反応しない。`document` level の `pointermove` listener が呼ばれない。

### 原因
要素に `setPointerCapture` を呼ぶと、後続の pointer events が **その要素にしか届かない**経路が iOS Safari にある。`document.addEventListener("pointermove", ...)` には伝わらない。

### 対処
- **`setPointerCapture` は使わない**
- ドラッグ追跡は document level の `addEventListener("pointermove", handler, { passive: false })`
- 複数指タッチの誤動作を避けるため、`pointerId` をローカル ref に保存して照合

### 該当箇所（採用パターン）
- `StockList` の長押しドラッグ並び替え（`src/components/StockList.tsx`）

---

## 3. `touch-action` は touchstart 時点で評価される

### 症状
ドラッグ中だけスクロールを止めたいが、`isDragging` 切替後に CSS の `touch-action` を変更しても効かない。

### 原因
ブラウザの `touch-action` プロパティは **`touchstart` 時点で 1 回だけ評価**される。touchstart 後の値変更はそのジェスチャー中無視される。

### 対処
- **常時の静的値**で設計する（用途に応じて `none` / `pan-y` / `manipulation` を選ぶ）
- ドラッグ中のスクロール抑止は document level の `addEventListener("touchmove", handler, { passive: false })` で `preventDefault`
- 長押し中に大きく指が動くとブラウザが scroll 判定で `pointercancel` を発火する妥協は受容（または `touch-action: none` で完全抑止と引き換えに通常時のスクロールを犠牲にする）

### 該当箇所
- `StockNameDisplay` の `touchAction: "pan-y"`（縦スクロール許可）
- ドラッグ用 useEffect 内の `document.addEventListener("touchmove", ..., { passive: false })`

---

## 4. 長押しタイマーの領域外リリース漏れ

### 症状
名前領域で pointerdown → 領域外（document の他の場所）で pointerup したケースで、500ms タイマーが生き残り、後からドラッグモードに突入してしまう。

### 原因
React の `onPointerUp` / `onPointerCancel` は、**要素内でリリースされたときしか発火しない**。
マウスで領域外に移動して離すパターン、一部の touch キャンセル経路で取り逃がす。

### 対処
- pointerdown ハンドラ内で **document level に一時的に pointerup / pointercancel listener** を仕掛ける
- 該当 `pointerId` が一致したらタイマー cancel + listener 自体も remove
- 長押し成立後は別の useEffect 側 listener が処理するため、二重発火しないよう状態確認する

### 該当箇所
- `StockList` の `cancelOnExternalUp`（`handleRowPointerDown` 内）

---

## 5. 表示専用テキストの長押しでテキスト選択 / Copy コールアウトが出る

### 症状
日付ラベル等「自動生成で編集不要」のテキストを長押しすると、iOS Safari がテキストを選択状態にし、Copy / Look Up（辞書）コールアウトが出てしまう。長押しを独自ジェスチャ（スワップ等）に当てている場合、本来の挙動を阻害する。

### 原因
- `user-select: text`（CSS デフォルト）のままテキスト要素はネイティブに選択対象
- iOS Safari は加えて `-webkit-touch-callout: default` で長押し時のコールアウト UI を出す
- 親に `role="button"` を付けても、内部の `<span>` テキストは選択対象のまま

### 対処
- 長押しジェスチャを当てる「表示専用テキスト領域」では併用する：
  - `select-none`（Tailwind / `user-select: none`）
  - `style={{ WebkitTouchCallout: "none" }}`（Tailwind に対応 utility なし、inline で指定）
- 編集対象テキスト（料理行・メモ等、タップでフロート編集が起動するもの）には **適用しない**（カーソル挙動の互換性のため）

### 該当箇所
- `DayRow` 日付ラベル領域（`src/components/DayRow.tsx`、F012 日付ごとスワップ）

---

## 共通原則

1. iOS Safari は仕様準拠が緩い。**docs / spec の通りに動かない経路を常に疑う**
2. Pointer Events / Touch Events を使うときは「**document level で再現できるか**」を必ず検討
3. IME を伴う入力は **uncontrolled が安全**（controlled は React と OS の競合を招く）
4. 実機（または Vercel Preview）での確認なしに「動いた」と判断しない。jsdom テストは pointer events や `setPointerCapture` をフルにシミュレートしない
5. 「ドラッグ中だけ XXX を切替」の発想は touch-action では実現できない。常時の静的値 + document handler の組み合わせで解く

---

## 履歴

- 2026-05-04: ストック改修サイクル（PR #18）で 1〜4 すべてを実体験。本ノートとして集約。
