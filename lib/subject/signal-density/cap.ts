export type VisibleCapResult<T> = {
  visible: T[]
  hiddenCount: number
  totalCount: number
}

export function applyVisibleCap<T>(items: T[], maxVisible: number): VisibleCapResult<T> {
  const totalCount = items.length
  if (totalCount <= maxVisible) {
    return { visible: items, hiddenCount: 0, totalCount }
  }
  return {
    visible: items.slice(0, maxVisible),
    hiddenCount: totalCount - maxVisible,
    totalCount,
  }
}
