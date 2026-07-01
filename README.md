# Browser Pixel Smith

ブラウザ上で、ピクセルアート向けの画像処理を試せるツールです。画像を読み込み、Before / After を見比べながら、減色、リサイズ、大きな画像の Pixel Snap、色調整や切り抜きなどを調整できます。

AI 出力画像をピクセルアート素材として整えるときの検討や、処理結果を見ながらパラメータを詰める作業に使えます。

![画面](<doc/スクリーンショット 2026-06-22 003236.png>)

## 公開版

https://opvelll.github.io/browser-pixel-smith/

このリポジトリは GitHub Pages 配信用に、Vite の `base` を `/browser-pixel-smith/` に設定しています。

## 主な機能

- 画像ファイルの選択、ドラッグ&ドロップ読み込み
- Before / After の比較表示
- ピクセルアート向けの減色処理
- 大きな画像をピクセル境界に寄せる Pixel Snap 処理
- リサイズ処理
- パレット色の置換、色の切り抜き、範囲選択による切り抜き
- ドット単位で色を拾って塗れる簡易ピクセルペイント
- 処理履歴からの再表示、再適用
- 結果画像の PNG 書き出し

## 開発

```bash
pnpm install
pnpm dev
```

ローカル確認では Vite を `127.0.0.1:5173` で起動します。

```bash
pnpm dev -- --host 127.0.0.1 --port 5173
```

## 検証とビルド

```bash
pnpm lint
pnpm build
pnpm preview
```

- `pnpm lint`: ESLint による静的チェック
- `pnpm build`: TypeScript のビルドと Vite の本番ビルド
- `pnpm preview`: ビルド済みアプリのプレビュー

## デプロイ

`master` ブランチに push すると、GitHub Actions が `pnpm build` を実行し、生成された `dist` を GitHub Pages に公開します。

---

# Browser Pixel Smith English Version

Browser Pixel Smith is an in-browser image processing tool for pixel-art workflows. You can load an image, compare the before and after states, and tune quantization, resizing, Pixel Snap for large images, color adjustments, and cropping.

It is useful for refining AI-generated images into pixel-art assets and for adjusting processing parameters while checking the result visually.

![Screenshot](<doc/スクリーンショット 2026-06-22 003236.png>)

## Published App

https://opvelll.github.io/browser-pixel-smith/

This repository is configured for GitHub Pages with Vite's `base` set to `/browser-pixel-smith/`.

## Features

- Select image files or load them with drag and drop
- Before / After comparison view
- Pixel-art-oriented color quantization
- Pixel Snap processing for aligning large images to pixel boundaries
- Image resizing
- Palette color replacement, color cutout, and selection-based cropping
- Simple pixel paint for picking colors and editing individual pixels
- Reopen and reuse images from the processing history
- Export result images as PNG

## Development

```bash
pnpm install
pnpm dev
```

For local UI checks, run Vite on `127.0.0.1:5173`.

```bash
pnpm dev -- --host 127.0.0.1 --port 5173
```

## Checks and Build

```bash
pnpm lint
pnpm build
pnpm preview
```

- `pnpm lint`: run ESLint
- `pnpm build`: run the TypeScript build and Vite production build
- `pnpm preview`: preview the built app locally

## Deployment

When changes are pushed to the `master` branch, GitHub Actions runs `pnpm build` and publishes the generated `dist` directory to GitHub Pages.
