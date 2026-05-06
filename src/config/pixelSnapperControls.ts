import type { PixelSnapperConfig } from '../pixelSnapper'

export type PixelSnapperControlField = {
  key: keyof PixelSnapperConfig
  label: string
  description: string
  min: number
  max: number
  step: number
}

export const PIXEL_SNAPPER_CONTROL_FIELDS: PixelSnapperControlField[] = [
  {
    key: 'kColors',
    label: 'Colors',
    description: '画像を何色に減色するかを指定します。少ないほどドット絵らしく、多いほど元画像に近くなります。',
    min: 1,
    max: 256,
    step: 1,
  },
  {
    key: 'kSeed',
    label: 'Seed',
    description: '減色処理の初期値です。同じ値なら同じ画像で同じ結果になりやすくなります。',
    min: 0,
    max: 9999,
    step: 1,
  },
  {
    key: 'maxKmeansIterations',
    label: 'K-means iter',
    description: '色をまとめる計算の最大反復回数です。増やすと色の安定性が上がる場合がありますが、処理は重くなります。',
    min: 1,
    max: 80,
    step: 1,
  },
  {
    key: 'peakThresholdMultiplier',
    label: 'Peak threshold',
    description: 'グリッド線候補として扱うエッジの強さのしきい値です。低いほど細かな境界も拾います。',
    min: 0.01,
    max: 2,
    step: 0.01,
  },
  {
    key: 'peakDistanceFilter',
    label: 'Peak distance',
    description: '近すぎるグリッド線候補をまとめる最小距離です。大きいほど候補の間隔が広くなります。',
    min: 1,
    max: 32,
    step: 1,
  },
  {
    key: 'walkerSearchWindowRatio',
    label: 'Search ratio',
    description: '推定したセル幅に対して、境界を探す範囲をどれだけ広げるかを指定します。',
    min: 0.01,
    max: 2,
    step: 0.01,
  },
  {
    key: 'walkerMinSearchWindow',
    label: 'Min window',
    description: '境界探索に使う最小ピクセル幅です。小さな画像や細かいグリッドで探索範囲を確保します。',
    min: 1,
    max: 32,
    step: 1,
  },
  {
    key: 'walkerStrengthThreshold',
    label: 'Strength',
    description: '見つけた境界を採用するための強さの基準です。高いほど弱い境界を無視します。',
    min: 0.01,
    max: 2,
    step: 0.01,
  },
  {
    key: 'minCutsPerAxis',
    label: 'Min cuts',
    description: '縦横それぞれで最低限作る分割線の数です。グリッド検出が弱い画像の下限になります。',
    min: 2,
    max: 64,
    step: 1,
  },
  {
    key: 'fallbackTargetSegments',
    label: 'Fallback cells',
    description: 'グリッドを十分に推定できないときに目標とする分割数です。大きいほど細かいセルになります。',
    min: 2,
    max: 512,
    step: 1,
  },
  {
    key: 'maxStepRatio',
    label: 'Step ratio',
    description: '縦横のセル幅の差をどこまで許容するかを指定します。低いほど正方形に近いセルへ補正します。',
    min: 1,
    max: 8,
    step: 0.1,
  },
]
