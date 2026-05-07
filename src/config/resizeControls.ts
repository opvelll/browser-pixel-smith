import type { NumericControlField } from '../components/ParameterRow'
import type { ResizeConfig } from '../resize'

export type ResizeControlField = NumericControlField<Extract<keyof ResizeConfig, 'scale'>>

export const RESIZE_SCALE_FIELD: ResizeControlField = {
  key: 'scale',
  label: 'Scale',
  description: '画像の幅と高さに同じ倍率をかけて拡大縮小します。',
  min: 0.1,
  max: 8,
  step: 0.1,
}
