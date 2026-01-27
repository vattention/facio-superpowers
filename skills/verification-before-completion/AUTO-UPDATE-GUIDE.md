# 文档自动更新实现指南

> 本指南说明如何在 verification-before-completion 中实现文档的自动更新

## 概述

当用户确认需要更新文档时，AI 工具应该能够：
1. 扫描代码变更
2. 识别需要更新的文档
3. 自动生成或更新文档内容
4. 更新文档索引

## 实现步骤

### 1. 扫描代码变更

```bash
# 获取变更的文件列表
git diff --cached --name-only

# 获取详细变更内容
git diff --cached
```

### 2. 识别涉及的模块

从文件路径识别模块：

```typescript
// 示例逻辑
const changedFiles = getChangedFiles();
const modules = new Set();

changedFiles.forEach(file => {
  // 匹配 src/modules/{module}/ 模式
  const match = file.match(/src\/modules\/([^\/]+)\//);
  if (match) {
    modules.add(match[1]);
  }

  // 匹配 src/renderer/ 模式
  if (file.startsWith('src/renderer/')) {
    modules.add('renderer');
  }

  // 匹配 src/main/ 模式
  if (file.startsWith('src/main/')) {
    modules.add('main');
  }
});
```

### 3. 检查模块文档状态

对每个涉及的模块：

```bash
# 检查模块文档是否存在
if [ -f "docs/modules/{module}/README.md" ]; then
  echo "Module doc exists, checking for updates needed"
else
  echo "Module doc missing, will create"
fi
```

### 4. 扫描组件列表

```bash
# 扫描模块的所有组件
find src/modules/{module}/components -type f \( -name "*.tsx" -o -name "*.ts" \) ! -name "*.test.*" ! -name "*.spec.*"

# 提取组件名称
# ComponentName.tsx → ComponentName
# useHook.ts → useHook
```

### 5. 扫描 API 导出

```bash
# 读取模块的 index.ts
cat src/modules/{module}/index.ts

# 提取 export 语句
grep -E "^export \{|^export \*|^export (const|function|class|type|interface)" src/modules/{module}/index.ts
```

### 6. 生成新模块文档

使用模板生成：

```typescript
// 读取模板
const template = readFile('templates/MODULE-README.md');

// 替换占位符
let content = template
  .replace(/\{模块名称\}/g, moduleName)
  .replace(/\{DATE\}/g, getCurrentDate())
  .replace(/\{OWNER\}/g, 'Team');

// 扫描组件并生成表格
const components = scanComponents(`src/modules/${module}/components`);
const componentTable = components.map(comp =>
  `| ${comp.name} | ${comp.description || '待补充'} | \`${comp.path}\` | ✅ |`
).join('\n');

// 替换组件表格占位符
content = content.replace(/\| ComponentA.*\n\| ComponentB.*/g, componentTable);

// 写入文件
writeFile(`docs/modules/${module}/README.md`, content);
```

### 7. 更新现有模块文档

#### a) 更新组件列表

```typescript
// 1. 读取现有文档
const readme = readFile(`docs/modules/${module}/README.md`);

// 2. 扫描当前组件
const currentComponents = scanComponents(`src/modules/${module}/components`);

// 3. 提取文档中已记录的组件
const documentedComponents = extractComponentsFromTable(readme);

// 4. 找出新增的组件
const newComponents = currentComponents.filter(
  comp => !documentedComponents.includes(comp.name)
);

// 5. 如果有新组件，添加到表格
if (newComponents.length > 0) {
  // 找到"核心组件"表格的位置
  const tableRegex = /## 核心组件\n\n\| 组件.*?\n\|.*?\n((?:\|.*?\n)*)/;
  const match = readme.match(tableRegex);

  if (match) {
    // 在表格末尾添加新行
    const newRows = newComponents.map(comp =>
      `| ${comp.name} | 待补充 | \`${comp.path}\` | ✅ |`
    ).join('\n');

    const updatedTable = match[0] + newRows + '\n';
    const updatedReadme = readme.replace(tableRegex, updatedTable);

    writeFile(`docs/modules/${module}/README.md`, updatedReadme);
  }
}
```

#### b) 更新 API 列表

```typescript
// 1. 读取模块的 index.ts
const indexContent = readFile(`src/modules/${module}/index.ts`);

// 2. 提取导出
const exports = extractExports(indexContent);

// 3. 读取文档
const readme = readFile(`docs/modules/${module}/README.md`);

// 4. 提取文档中已记录的 API
const documentedAPIs = extractAPIsFromTable(readme);

// 5. 找出新增的 API
const newAPIs = exports.filter(
  exp => !documentedAPIs.includes(exp.name)
);

// 6. 如果有新 API，添加到表格
if (newAPIs.length > 0) {
  // 类似组件列表的更新逻辑
  // 在 "API" 或 "对外接口" 表格中添加新行
}
```

#### c) 更新时间戳

```typescript
// 更新"最后更新"时间戳
const readme = readFile(`docs/modules/${module}/README.md`);
const today = getCurrentDate(); // 格式：2026-01-27

const updatedReadme = readme.replace(
  /最后更新：\d{4}-\d{2}-\d{2}/,
  `最后更新：${today}`
);

writeFile(`docs/modules/${module}/README.md`, updatedReadme);
```

### 8. 更新 DOCUMENTATION-MAP.md

#### a) 添加新模块

```typescript
// 1. 读取 DOCUMENTATION-MAP.md
const docMap = readFile('docs/DOCUMENTATION-MAP.md');

// 2. 检查模块是否已在文档地图中
if (!docMap.includes(`docs/modules/${module}/README.md`)) {
  // 3. 找到"### 模块文档"表格
  const tableRegex = /(### 模块文档\n\n\| 模块.*?\n\|.*?\n)((?:\|.*?\n)*)/;
  const match = docMap.match(tableRegex);

  if (match) {
    // 4. 添加新行
    const newRow = `| ${moduleName} | ${description} | [docs/modules/${module}/README.md](./modules/${module}/README.md) |\n`;
    const updatedTable = match[1] + match[2] + newRow;
    const updatedDocMap = docMap.replace(tableRegex, updatedTable);

    writeFile('docs/DOCUMENTATION-MAP.md', updatedDocMap);
  }
}
```

#### b) 添加新 ADR

```typescript
// 1. 读取 DOCUMENTATION-MAP.md
const docMap = readFile('docs/DOCUMENTATION-MAP.md');

// 2. 确定 ADR 分类（技术选型/架构模式/功能实现）
const category = determineADRCategory(adrTitle);

// 3. 找到对应分类的位置
const categoryRegex = new RegExp(`#### ${category}\\n((?:- \\[ADR.*?\\n)*)`);
const match = docMap.match(categoryRegex);

if (match) {
  // 4. 添加新 ADR 条目
  const newEntry = `- [ADR-${adrNumber}: ${adrTitle}](./adr/${adrNumber}-${adrSlug}.md)\n`;
  const updatedSection = match[0] + newEntry;
  const updatedDocMap = docMap.replace(categoryRegex, updatedSection);

  writeFile('docs/DOCUMENTATION-MAP.md', updatedDocMap);
}
```

### 9. 更新 ADR 索引

```typescript
// 1. 读取 docs/adr/README.md
const adrIndex = readFile('docs/adr/README.md');

// 2. 提取 ADR 信息
const adrInfo = {
  number: adrNumber,
  title: adrTitle,
  date: getCurrentDate(),
  status: '已采纳'
};

// 3. 找到表格
const tableRegex = /(## Current Decisions\n\n\| Number.*?\n\|.*?\n)((?:\|.*?\n)*)/;
const match = adrIndex.match(tableRegex);

if (match) {
  // 4. 添加新行（按编号排序）
  const newRow = `| ${adrInfo.number} | ${adrInfo.title} | ${adrInfo.date} | ${adrInfo.status} |\n`;

  // 如果表格是空的（只有占位符），替换占位符
  let updatedRows = match[2];
  if (updatedRows.includes('No ADRs yet')) {
    updatedRows = newRow;
  } else {
    updatedRows += newRow;
  }

  const updatedTable = match[1] + updatedRows;
  const updatedIndex = adrIndex.replace(tableRegex, updatedTable);

  writeFile('docs/adr/README.md', updatedIndex);
}
```

## 辅助函数

### 扫描组件

```typescript
function scanComponents(componentsDir: string) {
  // 使用 glob 或 find 命令
  const files = glob(`${componentsDir}/**/*.{ts,tsx}`, {
    ignore: ['**/*.test.*', '**/*.spec.*', '**/index.ts']
  });

  return files.map(file => {
    const name = path.basename(file, path.extname(file));
    const relativePath = path.relative(process.cwd(), file);

    // 尝试从文件中提取描述（JSDoc 注释）
    const content = readFile(file);
    const description = extractDescription(content);

    return {
      name,
      path: relativePath,
      description
    };
  });
}
```

### 提取导出

```typescript
function extractExports(indexContent: string) {
  const exports = [];

  // 匹配 export { ... }
  const namedExports = indexContent.match(/export\s*\{([^}]+)\}/g);
  if (namedExports) {
    namedExports.forEach(exp => {
      const names = exp.match(/\{([^}]+)\}/)[1]
        .split(',')
        .map(n => n.trim());
      exports.push(...names);
    });
  }

  // 匹配 export function/const/class
  const directExports = indexContent.match(/export\s+(function|const|class)\s+(\w+)/g);
  if (directExports) {
    directExports.forEach(exp => {
      const name = exp.match(/\s+(\w+)$/)[1];
      exports.push(name);
    });
  }

  return exports.map(name => ({ name }));
}
```

### 提取表格内容

```typescript
function extractComponentsFromTable(readme: string) {
  const tableRegex = /## 核心组件\n\n\| 组件.*?\n\|.*?\n((?:\|.*?\n)*)/;
  const match = readme.match(tableRegex);

  if (!match) return [];

  const rows = match[1].split('\n').filter(row => row.trim());
  return rows.map(row => {
    const cells = row.split('|').map(c => c.trim()).filter(c => c);
    return cells[0]; // 组件名称在第一列
  });
}
```

## 实际应用示例

### 场景：用户修改了 account 模块，添加了新组件 LoginForm

```typescript
// 1. 检测到变更
const changedFiles = ['src/modules/account/components/LoginForm.tsx'];
const modules = ['account'];

// 2. 检查文档状态
const docExists = fileExists('docs/modules/account/README.md');
// 假设文档已存在

// 3. 扫描组件
const components = scanComponents('src/modules/account/components');
// 返回：[{ name: 'LoginForm', path: 'src/modules/account/components/LoginForm.tsx' }, ...]

// 4. 读取现有文档
const readme = readFile('docs/modules/account/README.md');

// 5. 检查 LoginForm 是否已记录
const documented = extractComponentsFromTable(readme);
if (!documented.includes('LoginForm')) {
  // 6. 添加到表格
  updateComponentTable(readme, {
    name: 'LoginForm',
    path: 'src/modules/account/components/LoginForm.tsx',
    description: '用户登录表单组件'
  });

  // 7. 更新时间戳
  updateTimestamp('docs/modules/account/README.md');

  // 8. 通知用户
  console.log('✅ Updated docs/modules/account/README.md');
  console.log('   - Added LoginForm to component table');
}
```

## 注意事项

1. **幂等性**：多次运行应该产生相同结果
2. **保留用户修改**：不要覆盖用户手动添加的描述
3. **格式一致性**：保持表格格式统一
4. **错误处理**：文件不存在、格式不匹配等情况
5. **用户审查**：自动更新后提示用户审查和调整

## 总结

通过这些自动化步骤，AI 工具可以：
- ✅ 自动检测需要更新的文档
- ✅ 扫描代码生成文档内容
- ✅ 更新模块文档的组件和 API 列表
- ✅ 更新文档索引和导航
- ✅ 保持文档与代码同步

用户只需：
- 确认是否更新文档
- 审查自动生成的内容
- 补充描述信息
