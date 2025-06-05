// src/utils/placementKey.ts

/**
 * 将一个 placementMap（ActionId → Target[]）转换为一个“规范化的”字符串键
 * 1. 先把所有 actionId→targets[] 中 targets 数组进行排序
 * 2. 然后把各个 [actionId, sortedTargets] 对按 actionId 升序排列
 * 3. 最后用 JSON.stringify 转为字符串
 *
 * 这样能够保证：即使原始 placementMap 的属性顺序不同、每个 targets 数组内部顺序不同，
 * 调用此函数后都会得到同样的字符串 key。
 */
export function canonicalizePlacementMap(
  placementMap: Record<string, string[]>
): string {
  // 1) 收集所有非空 targets 数组，进行浅拷贝后排序
  const entries: Array<[string, string[]]> = Object.entries(placementMap)
    .filter(([, targets]) => Array.isArray(targets) && targets.length > 0)
    .map(([actionId, targets]) => {
      const sortedTargets = [...targets].sort(); // 排序 targets 内部
      return [actionId, sortedTargets] as [string, string[]];
    });

  // 2) 对 actionId 升序排序
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  // 3) 直接 JSON.stringify 数组形式
  return JSON.stringify(entries);
}
