import type { NumericControlField } from '../components/ParameterRow'
import type { QuantizeMethod } from '../pixelSnapper'

export type QuantizeNumericKey = 'colors' | 'seed' | 'refineIterations'
export type QuantizeControlField = NumericControlField<QuantizeNumericKey>

export const QUANTIZE_CONTROL_FIELDS: QuantizeControlField[] = [
  {
    key: 'colors',
    label: 'Colors',
    description: '画像を何色に減色するかを指定します。少ないほど単純化され、多いほど元画像に近くなります。',
    min: 1,
    max: 256,
    step: 1,
  },
  {
    key: 'seed',
    label: 'Seed',
    description: 'OKLab + Refine の初期値です。同じ値なら同じ画像で同じ結果になりやすくなります。',
    min: 0,
    max: 9999,
    step: 1,
  },
  {
    key: 'refineIterations',
    label: 'Refine iter',
    description: 'Refine系メソッドの最大反復回数です。増やすと品質が上がる場合がありますが、処理は重くなります。',
    min: 0,
    max: 80,
    step: 1,
  },
]

export const QUANTIZE_METHOD_OPTIONS: Array<{
  method: QuantizeMethod
  label: string
  hint: string
}> = [
  { method: 'medianCut', label: 'Median Cut', hint: 'balanced' },
  { method: 'oklabRefine', label: 'OKLab + Refine', hint: 'perceptual' },
  { method: 'octreeRefine', label: 'Octree + Refine', hint: 'detailed' },
  { method: 'octreeFast', label: 'Octree Fast', hint: 'fastest' },
]
