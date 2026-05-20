# Browser Pixel Smith

ブラウザ上でピクセルアート向けの画像処理を試せるツールです。画像を読み込み、Before / After を見比べながら減色、リサイズ、大きな画像のピクセルスナップ処理を調整できます。

## Features

- 画像のドラッグ&ドロップ読み込み
- ピクセルアート向けの減色処理
- 大きな画像をピクセル境界に寄せる Pixel Snap 処理
- リサイズ処理
- Before / After の比較表示
- 処理履歴からの再適用
- PNG 書き出し

## Published App

https://opvelll.github.io/browser-pixel-smith/

## Development

```bash
pnpm install
pnpm dev
```

開発サーバーは Vite で起動します。

## Build

```bash
pnpm build
```

## Deployment

`master` ブランチに push すると GitHub Actions が `pnpm build` を実行し、`dist` を GitHub Pages に公開します。
