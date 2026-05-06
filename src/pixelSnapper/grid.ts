import type { PixelSnapperConfig } from './types'

export function resolveStepSizes(
  stepXOpt: number | null,
  stepYOpt: number | null,
  width: number,
  height: number,
  config: PixelSnapperConfig,
): { stepX: number; stepY: number } {
  if (stepXOpt != null && stepYOpt != null) {
    const ratio = stepXOpt > stepYOpt ? stepXOpt / stepYOpt : stepYOpt / stepXOpt
    if (ratio > config.maxStepRatio) {
      const smaller = Math.min(stepXOpt, stepYOpt)
      return { stepX: smaller, stepY: smaller }
    }
    const average = (stepXOpt + stepYOpt) / 2
    return { stepX: average, stepY: average }
  }

  if (stepXOpt != null) {
    return { stepX: stepXOpt, stepY: stepXOpt }
  }
  if (stepYOpt != null) {
    return { stepX: stepYOpt, stepY: stepYOpt }
  }

  const fallbackStep = Math.max(Math.min(width, height) / config.fallbackTargetSegments, 1)
  return { stepX: fallbackStep, stepY: fallbackStep }
}

export function walk(
  profile: number[],
  stepSize: number,
  limit: number,
  config: PixelSnapperConfig,
): number[] {
  if (profile.length === 0) {
    throw new Error('Cannot walk on empty profile')
  }

  const cuts = [0]
  let currentPos = 0
  const searchWindow = Math.max(
    stepSize * config.walkerSearchWindowRatio,
    config.walkerMinSearchWindow,
  )
  const meanVal = profile.reduce((sum, value) => sum + value, 0) / profile.length

  while (currentPos < limit) {
    const target = currentPos + stepSize
    if (target >= limit) {
      cuts.push(limit)
      break
    }

    const startSearch = Math.max(Math.trunc(target - searchWindow), Math.trunc(currentPos + 1))
    const endSearch = Math.min(Math.trunc(target + searchWindow), limit)

    if (endSearch <= startSearch) {
      currentPos = target
      continue
    }

    let maxVal = -1
    let maxIdx = startSearch
    for (let i = startSearch; i < endSearch; i += 1) {
      if ((profile[i] ?? 0) > maxVal) {
        maxVal = profile[i]
        maxIdx = i
      }
    }

    if (maxVal > meanVal * config.walkerStrengthThreshold) {
      cuts.push(maxIdx)
      currentPos = maxIdx
    } else {
      cuts.push(Math.trunc(target))
      currentPos = target
    }
  }

  return cuts
}

export function stabilizeBothAxes(
  profileX: number[],
  profileY: number[],
  rawColCuts: number[],
  rawRowCuts: number[],
  width: number,
  height: number,
  config: PixelSnapperConfig,
): { colCuts: number[]; rowCuts: number[] } {
  const colCutsPass1 = stabilizeCuts(profileX, rawColCuts, width, rawRowCuts, height, config)
  const rowCutsPass1 = stabilizeCuts(profileY, rawRowCuts, height, rawColCuts, width, config)

  const colCells = Math.max(colCutsPass1.length - 1, 1)
  const rowCells = Math.max(rowCutsPass1.length - 1, 1)
  const colStep = width / colCells
  const rowStep = height / rowCells
  const stepRatio = colStep > rowStep ? colStep / rowStep : rowStep / colStep

  if (stepRatio > config.maxStepRatio) {
    const targetStep = Math.min(colStep, rowStep)
    const finalColCuts =
      colStep > targetStep * 1.2
        ? snapUniformCuts(profileX, width, targetStep, config, config.minCutsPerAxis)
        : colCutsPass1
    const finalRowCuts =
      rowStep > targetStep * 1.2
        ? snapUniformCuts(profileY, height, targetStep, config, config.minCutsPerAxis)
        : rowCutsPass1

    return { colCuts: finalColCuts, rowCuts: finalRowCuts }
  }

  return { colCuts: colCutsPass1, rowCuts: rowCutsPass1 }
}

function stabilizeCuts(
  profile: number[],
  cuts: number[],
  limit: number,
  siblingCuts: number[],
  siblingLimit: number,
  config: PixelSnapperConfig,
): number[] {
  if (limit === 0) {
    return [0]
  }

  const sanitizedCuts = sanitizeCuts(cuts, limit)
  const minRequired = Math.min(Math.max(config.minCutsPerAxis, 2), limit + 1)
  const axisCells = sanitizedCuts.length - 1
  const siblingCells = siblingCuts.length - 1
  const siblingHasGrid = siblingLimit > 0 && siblingCells >= minRequired - 1 && siblingCells > 0
  const stepsSkewed =
    siblingHasGrid &&
    axisCells > 0 &&
    (() => {
      const axisStep = limit / axisCells
      const siblingStep = siblingLimit / siblingCells
      const stepRatio = axisStep / siblingStep
      return stepRatio > config.maxStepRatio || stepRatio < 1 / config.maxStepRatio
    })()
  const hasEnough = sanitizedCuts.length >= minRequired

  if (hasEnough && !stepsSkewed) {
    return sanitizedCuts
  }

  let targetStep: number
  if (siblingHasGrid) {
    targetStep = siblingLimit / siblingCells
  } else if (config.fallbackTargetSegments > 1) {
    targetStep = limit / config.fallbackTargetSegments
  } else if (axisCells > 0) {
    targetStep = limit / axisCells
  } else {
    targetStep = limit
  }

  if (!Number.isFinite(targetStep) || targetStep <= 0) {
    targetStep = 1
  }

  return snapUniformCuts(profile, limit, targetStep, config, minRequired)
}

function sanitizeCuts(cuts: number[], limit: number): number[] {
  if (limit === 0) {
    return [0]
  }

  let hasZero = false
  let hasLimit = false
  const sanitized = cuts.map((value) => {
    let nextValue = Math.trunc(value)
    if (nextValue === 0) {
      hasZero = true
    }
    if (nextValue >= limit) {
      nextValue = limit
    }
    if (nextValue === limit) {
      hasLimit = true
    }
    return nextValue
  })

  if (!hasZero) {
    sanitized.push(0)
  }
  if (!hasLimit) {
    sanitized.push(limit)
  }

  return [...new Set(sanitized.sort((a, b) => a - b))]
}

function snapUniformCuts(
  profile: number[],
  limit: number,
  targetStep: number,
  config: PixelSnapperConfig,
  minRequired: number,
): number[] {
  if (limit === 0) {
    return [0]
  }
  if (limit === 1) {
    return [0, 1]
  }

  let desiredCells =
    Number.isFinite(targetStep) && targetStep > 0 ? Math.round(limit / targetStep) : 0
  desiredCells = Math.min(Math.max(desiredCells, Math.max(minRequired - 1, 1)), limit)

  const cellWidth = limit / desiredCells
  const searchWindow = Math.max(
    cellWidth * config.walkerSearchWindowRatio,
    config.walkerMinSearchWindow,
  )
  const meanVal = profile.length
    ? profile.reduce((sum, value) => sum + value, 0) / profile.length
    : 0

  const cuts: number[] = [0]
  for (let idx = 1; idx < desiredCells; idx += 1) {
    const target = cellWidth * idx
    const previous = cuts[cuts.length - 1]
    if (previous + 1 >= limit) {
      break
    }

    let start = Math.max(Math.floor(target - searchWindow), previous + 1, 0)
    let end = Math.min(Math.ceil(target + searchWindow), limit - 1)
    if (end < start) {
      start = previous + 1
      end = start
    }

    let bestIdx = Math.min(start, Math.max(profile.length - 1, 0))
    let bestVal = -1
    for (let i = start; i <= Math.min(end, profile.length - 1); i += 1) {
      const value = profile[i] ?? 0
      if (value > bestVal) {
        bestVal = value
        bestIdx = i
      }
    }

    if (bestVal < meanVal * config.walkerStrengthThreshold) {
      let fallbackIdx = Math.round(target)
      if (fallbackIdx <= previous) {
        fallbackIdx = previous + 1
      }
      if (fallbackIdx >= limit) {
        fallbackIdx = Math.max(limit - 1, previous + 1)
      }
      bestIdx = fallbackIdx
    }

    cuts.push(bestIdx)
  }

  if (cuts[cuts.length - 1] !== limit) {
    cuts.push(limit)
  }
  return sanitizeCuts(cuts, limit)
}
