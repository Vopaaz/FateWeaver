/**
 * 基本效用规则的类型
 */
export type UtilityRuleType =
  | 'paranoiaGreaterThan'
  | 'someoneInSomewhere'
  | 'intrigueGreaterThan'
  | 'someoneInSameLocationAs'
  | 'numberShareLocationGreaterThan'
  | 'numberShareLocationEquals'
  | 'goodwillGreaterThan'
  | 'and'
  | 'or'
  | 'not';

/** 每个规则的定义：用于渲染描述文本和参数模板 */
interface UtilityRuleDefinition {
  /** 规则展示文本，"?" 表示占位符 */
  text: string;
  /** params 数组中每一项表示一个参数的类型 */
  params: Array<'Character' | 'Location' | 'Target' | 'Number' | 'Rule'>;
}

/**
 * 所有可用的基本效用规则及逻辑组合规则
 */
export const UTILITY_RULES: Record<UtilityRuleType, UtilityRuleDefinition> = {
  paranoiaGreaterThan: {
    text: '? 的不安大于 ?',
    params: ['Character', 'Number'],
  },
  intrigueGreaterThan: {
    text: '? 的密谋大于 ?',
    params: ['Target', 'Number'],
  },
  goodwillGreaterThan: {
    text: '? 的友好大于 ?',
    params: ['Target', 'Number'],
  },
  someoneInSomewhere: {
    text: '? 位于 ?',
    params: ['Character', 'Location'],
  },
  someoneInSameLocationAs: {
    text: '? 与 ? 处于同一地点',
    params: ['Character', 'Character'],
  },
  numberShareLocationGreaterThan: {
    text: '与 ? 处于同一地点的人数大于',
    params: ['Character', 'Number'],
  },
  numberShareLocationEquals: {
    text: '与 ? 处于同一地点的人数等于',
    params: ['Character', 'Number'],
  },
  and: {
    text: '? and ?',
    params: ['Rule', 'Rule'],
  },
  or: {
    text: '? or ?',
    params: ['Rule', 'Rule'],
  },
  not: {
    text: 'not ?',
    params: ['Rule'],
  },
};
