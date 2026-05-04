# L1 指示書 — ストック行改修・名前編集・メモバグ修正

このドキュメントは Layer 0（spec-architect）→ Layer 1（autonomous-dev）への引き継ぎ指示書。
本サイクルで実装すべき変更を、SPEC.md / CLAUDE.md の改訂内容と紐付けて具体化したもの。

ブランチ: `claude/fix-stock-toast-layout-Pu2Ax`

---

## サイクル目標

1. ストック行（`StockList.tsx` の `<li>` 白カード）を **1 行で完結**するレイアウトに縮小する
2. ストック行の **名前を直接編集**できるようにする
3. **ちょいメモ欄が iOS Safari で入力を受け付けない**バグを修正する
4. ストック行の **`↑↓` 並び替えボタン**を廃止し、**長押しドラッグ**による並び替えに置き換える

---

## 仕様根拠

- 仕様変更：`SPEC.md` の「ストックリスト」節と「フリー入力 → ちょいメモ」サブ節を改訂
- UI 規約変更：`CLAUDE.md` のタッチ最小サイズ規定にストック行の例外（36×36px）を追記
- いずれも本サイクルで Layer 0 が更新済み。Layer 1 はこの新仕様に従って実装する

---

## タスク 1: ストック行を 1 行で収める

### 対象
- `src/components/StockList.tsx` のストック行 `<li>`（現在 `flex items-center gap-1 bg-white rounded ...`）

### 変更内容
1. 名前領域 `<span>{item.text}</span>` の **break-words を廃止**し、`useAutoShrink`（既存 `src/hooks/useAutoShrink.ts`）でフォントサイズを動的縮小して 1 行で全文表示する
   - 料理行 `LineItem`（`DayRow.tsx:283-`）の実装が参考実装。`measureRef` で自然幅を測り、`fontPx` を style に注入するパターンをそのまま流用する
   - `basePx: 14`（行高さに収まる範囲）、`minPx: 10` を目安。文字が下限でも収まらない場合は `overflow: hidden` で右端を切る
2. `[−][個数][＋]` 3 要素のサイズを `w-11 h-11`（44px）から **`w-9 h-9`（36px）** に縮小
   - ボタン内のテキスト（`−` `＋`）はそのまま、フォントサイズは `text-lg` 程度に調整
   - 個数表示 `<span ... w-11 ...>{item.qty}</span>` は **`w-7 h-9`**（28×36）に縮小
   - `qty === 0` 時の赤い削除ボタンも `w-9 h-9` に揃える
3. ハートアイコン（`w-8 h-8`）はそのまま
4. `[↑][↓]` ボタンは**削除**（タスク 4 で置き換え）

### 受け入れ条件
- iPhone 11 想定の 375px 幅で、長い名前（例：「ホイコーロー（豚バラと長ネギ）」）も折り返さず 1 行表示されること
- 短い名前（例：「カレー」）は basePx で表示されること
- `[−][個数][＋]` のタップで個数増減が機能すること（既存挙動維持）
- 視覚回帰：行高は 44px 程度（min-h を従来 `py-1` から維持）

---

## タスク 2: ストック名の編集機能

### 対象
- `src/components/StockList.tsx`：行名表示部
- `src/hooks/useAppData.ts`：`AppDataApi`

### 変更内容

#### API 追加
`useAppData.ts` の `AppDataApi` に以下を追加：

```ts
/** ストック項目の表示テキストを書き換える。空文字は no-op（既存テキスト維持） */
updateStockText: (id: string, text: string) => void;
```

実装：

```ts
const updateStockText = useCallback((id: string, text: string) => {
  const trimmed = text.trim();
  if (trimmed === "") return;  // 空文字は無視（既存名維持）
  setState((prev) => ({
    ...prev,
    data: {
      ...prev.data,
      stock: prev.data.stock.map((s) => (s.id === id ? { ...s, text: trimmed } : s)),
    },
  }));
}, []);
```

戻り値オブジェクトに `updateStockText` を含めること。

#### UI: タップで編集モード
名前 `<span>` を以下に置き換え：
- 行内の編集状態は `<li>` ローカルでなく `StockList` レベルで `editingId: string | null` として管理（同時に複数行が編集状態にならないようにするため）
- 通常表示：`<button>` または `<div role="button">` でタップ可能にし、`useAutoShrink` で 1 行表示
- 編集中の行：`<input type="text" defaultValue={item.text}>` を表示（**uncontrolled**、IME 対策はタスク 3 と同じ方針）
- 編集中の input は `useComposition` を使い、`onCompositionEnd` と `onChange`（IME 外）の両方で `pendingText` をローカルに保持
- 確定経路：
  - **blur**：`updateStockText(item.id, pendingText)` を呼んで `editingId = null`
  - **Enter キー**（`!isComposing`）：blur と同じ
  - 空文字確定は `updateStockText` 内で no-op になる
- 編集中はタスク 1 の `useAutoShrink` 表示は隠す（input が代わりに表示される）
- 編集中の input には `key` に `item.id` を含めて、項目並び替えで誤って別項目の値が引き継がれないようにする

### 受け入れ条件
- 名前タップで input が出現し、フォーカスされる（`autoFocus` 推奨）
- 日本語入力（IME）で文字を入れて確定し、blur で保存される
- 同時に 2 行を編集モードにできない
- 空文字で blur しても元の名前が消えない
- お気に入りキー（先頭トークン正規化）が変更後の名前に追従する（`favoriteKeys.has(favoriteKey(newText))` の判定が再評価されるため自動）

---

## タスク 3: ちょいメモ欄の入力バグ修正

### 根本原因
`src/components/DayRow.tsx:564-583` の `MemoField` の `<input>` が **controlled**（`value={value}`）で、
`useComposition.shouldSkipChange()` が true を返すと親 state が更新されず、Reactが input.value を古いプロップ値で上書きするため、ユーザーの入力が消える。
iOS Safari の IME 中は特に発生しやすい。

### 修正方針
料理行の `<textarea>`（`DayRow.tsx:144`）と同じ **uncontrolled** パターンに揃える。

### 変更内容
`MemoField` 関数全体を以下の構造に書き換える：

1. `<input value={value}>` → `<input defaultValue={value}>` に変更
2. `<MemoField key={dateKey} ... />` のように、呼び出し側（`DayRow` 内の配置箇所、`DayRow.tsx:140`）で `key={dateKey}` を付与する
   - 無限スクロールで日付が再描画される際、別の日付のメモ値が DOM に残らないようにするため
3. `useAutoShrink` の `value` には input の DOM ではなく親プロップ `value` を渡し続ける（描画タイミングの計測値ずれを許容）
4. `onChange` ハンドラはこれまで通り親に通知する（DOM 同期は不要、親 state は永続化のためだけに更新）
5. `onCompositionEnd` の最終確定値も親に通知する（既存通り）

### 受け入れ条件
- iPhone 11 Safari で日本語フリック入力でメモ欄に入力できる（再現性のあるタタタ・入力消失が起きない）
- メモ入力後にスクロール → 日付列が再描画されても、入力済みのメモが正しく表示される
- 別日付のメモ欄に切り替えた時、その日付のメモが正しく初期表示される
- 既存テストが通る

### 注意
- `useComposition` フック自体は変更不要（textarea でも同じフックを使い続けるため）
- `controlled → uncontrolled` で挙動が変わるため、`tests/` 配下に MemoField のテストがあれば同期更新する

---

## タスク 4: 長押しドラッグでの並び替え

### 廃止
- `[↑][↓]` ボタン（`StockList.tsx:106-129`）を削除
- `AppDataApi.moveStockUp` / `moveStockDown` も廃止（呼び出し元なくなるため）
- 代わりに **インデックス指定の並び替え API** を追加：

```ts
/** ストック並び替え：fromIndex の項目を toIndex の位置に移動する */
reorderStock: (fromIndex: number, toIndex: number) => void;
```

実装は `Array.prototype.splice` で 1 要素を抜き出して挿入。境界外は no-op。

### UI 実装方針
独自実装（外部ライブラリ追加禁止 — `package.json` 依存追加は CLAUDE.md の「依存パッケージの無計画な追加」に抵触するため避ける）。

1. 行名領域（`useAutoShrink` 表示 / 編集 input ではない方）に `useLongPress`（既存 `src/hooks/useLongPress.ts`）を付与
2. 長押し（500ms）成立で `draggingId: string | null` を `StockList` ローカル state にセット
3. `dragging` 中の行は浮かせる視覚（`shadow-lg z-10`、または既存 `animate-row-wobble` を流用してもよい）
4. ドラッグ追跡：
   - `dragging != null` の間、`document` レベルで `pointermove` を購読
   - 各行の `<li>` の `getBoundingClientRect().top + height/2` と `pointer.clientY` を比較し、ホバーしている行インデックス `hoverIndex` を算出
   - 視覚フィードバック：`hoverIndex` の位置に挿入される予感を出す（隙間を空ける、または半透明インジケータ）
5. `pointerup` / `touchend` で `reorderStock(fromIndex, hoverIndex)` を呼び `draggingId = null`
6. ドラッグせず指を離した（`hoverIndex === fromIndex`）場合は no-op
7. **解除経路**：
   - 行外をタップ：`pointerdown` で `dragging` 中の行外なら解除
   - Escape キー：`document.keydown` で解除
   - 並び替えモード中は通常タップ・編集進入を抑止

### 受け入れ条件
- 長押し → ドラッグ → リリースで行順が入れ替わる
- 並び替え結果が localStorage に保存される（再起動後も保持）
- 通常のタップは編集モード（タスク 2）と干渉しない
- IME 編集中の行は長押しが発火しない（`stopPropagation` で input イベントと分離）
- iPhone 11 Safari 実機で touchmove が機能する（`{ passive: false }` での preventDefault が必要なら設定する）

### 補足
- 既存 `useLongPress` が pointerdown/up しか扱っていない場合は、長押し**後の** pointermove 追跡は本コンポーネント内で別途実装してよい
- DONT.md「複雑な状態管理UI（ドラッグ&ドロップでの献立並び替え）」は **献立行の並び替え禁止**を意図しており、ストック並び替えは元々機能要件としてSPECに存在する。今回は実装手段を `↑↓` ボタンから長押しドラッグに置き換えるだけなので DONT.md には抵触しない

---

## 横断的な制約

- TypeScript strict、`any` 禁止（CLAUDE.md）
- `console.log` 残置禁止
- 新規依存パッケージ追加禁止
- すべての UI 文言は日本語
- iPhone 11（375×812）で操作確認できる状態を維持

---

## 検証手順

実装完了後、以下を順に通すこと（`sensors/computational.md` 準拠）：

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

加えて推論センサー（`sensors/inferential.md` があれば）に従い、SPEC.md / DONT.md / CLAUDE.md との整合性を自己検証する。

実機検証（iPhone 11 Safari）が望ましいが、Layer 1 セッションで実施できない場合は `DELIVERY.md` に「実機未検証」を明示すること。

---

## 既存テストへの影響予想

- `tests/` 配下に `StockList` / `MemoField` / `useAppData` のテストがあれば、API 変更（`updateStockText` 追加、`moveStockUp/Down` → `reorderStock` 置換）と uncontrolled 化に合わせて更新
- 変更後にテストが失敗する場合、テストの仕様照合を優先する（`sensors/computational.md` の「テストそのものの修正は仕様と照合してから」に従う）

---

## 完了の定義

- [ ] SPEC.md / CLAUDE.md の改訂内容を実装に反映
- [ ] 計算センサー全 5 項目（typecheck / lint / format / test / build）pass
- [ ] `DELIVERY.md` または別レポートに本サイクルの結果（実装内容・既知未検証事項）を追記
- [ ] コミット → ブランチ `claude/fix-stock-toast-layout-Pu2Ax` に push → PR（既存があれば更新、なければ新規 draft）
