/** 安定した一意ID生成（ストック項目等に使用） */
export function generateId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}
