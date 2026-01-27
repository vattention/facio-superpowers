# {模块名称}

> 最后更新：{DATE} | 负责人：{OWNER}

## 概述

{一句话描述模块职责}

## 当前状态

- ✅ 已实现：
  - {功能1}
  - {功能2}
- 🚧 开发中：
  - {功能3}
- 📋 计划中：
  - {功能4}

## 技术栈

- **{技术1}**：{用途}（参见 [ADR-XXX](../../adr/XXX-decision.md)）
- **{技术2}**：{用途}（参见 [ADR-XXX](../../adr/XXX-decision.md)）

## 核心组件

| 组件 | 职责 | 文件路径 | 状态 |
|------|------|---------|------|
| ComponentA | {描述} | `src/modules/{module}/ComponentA.tsx` | ✅ |
| ComponentB | {描述} | `src/modules/{module}/ComponentB.tsx` | 🚧 |

详见：[COMPONENTS.md](./COMPONENTS.md)

## 架构

### 目录结构

```
src/modules/{module}/
├── components/          # UI 组件
├── hooks/              # 自定义 Hooks
├── stores/             # 状态管理
├── services/           # 业务逻辑
├── types/              # 类型定义
└── utils/              # 工具函数
```

### 数据流

```
用户操作 → Component → Hook → Store → Service → API
```

详见：[ARCHITECTURE.md](./ARCHITECTURE.md)

## API

### 对外接口

| 接口 | 描述 | 参数 | 返回值 |
|------|------|------|--------|
| `functionA()` | {描述} | `{params}` | `{return}` |
| `functionB()` | {描述} | `{params}` | `{return}` |

详见：[API.md](./API.md)

## 状态管理

### Store 结构

```typescript
interface {Module}Store {
  // 状态
  data: DataType;
  loading: boolean;
  error: Error | null;

  // 操作
  fetchData: () => Promise<void>;
  updateData: (data: DataType) => void;
}
```

详见：[STATE.md](./STATE.md)

## 示例

### 基础用法

```typescript
// 示例代码
import { useModule } from '@/modules/{module}';

function Example() {
  const { data, loading } = useModule();

  if (loading) return <Loading />;
  return <div>{data}</div>;
}
```

### 完整示例

- [示例1：{场景}](./examples/example-1/)
- [示例2：{场景}](./examples/example-2/)

## 测试

### 运行测试

```bash
# 运行模块测试
npm test -- {module}

# 运行特定测试文件
npm test -- {module}/ComponentA.test.tsx
```

### 测试覆盖率

- 单元测试：{XX}%
- 集成测试：{XX}%

## 相关文档

### ADR

- [ADR-XXX: {决策标题}](../../adr/XXX-decision.md)
- [ADR-XXX: {决策标题}](../../adr/XXX-decision.md)

### 设计文档

- [设计文档：{功能}](../../plans/YYYY-MM-DD-feature-design.md)

## 开发指南

### 添加新功能

1. 调用 `/brainstorming` 生成设计文档
2. 调用 `/writing-plans` 生成实现计划
3. 实现功能
4. 添加测试
5. 调用 `/verification-before-completion` 更新文档

### 代码规范

- 遵循项目统一的代码规范
- 组件使用函数式组件 + Hooks
- 状态管理使用 {状态管理方案}
- 样式使用 {样式方案}

### 常见问题

#### Q: {问题}

A: {答案}

## 依赖关系

### 依赖的模块

- `{module-a}`: {用途}
- `{module-b}`: {用途}

### 被依赖的模块

- `{module-c}`: {用途}
- `{module-d}`: {用途}

## 性能考虑

- {性能优化点1}
- {性能优化点2}

## 安全考虑

- {安全注意事项1}
- {安全注意事项2}

## 未来规划

- [ ] {计划功能1}
- [ ] {计划功能2}
- [ ] {计划功能3}

## 变更历史

| 日期 | 变更 | 相关 ADR/PR |
|------|------|------------|
| {DATE} | {变更描述} | [ADR-XXX](../../adr/XXX.md) |
