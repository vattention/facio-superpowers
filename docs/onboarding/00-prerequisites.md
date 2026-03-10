# 前置准备

本文档帮助不熟悉 Git 或命令行的新人做好准备。如果你已经熟悉这些工具，可以直接跳到 [01-quick-start](./01-quick-start.md)。

## 你需要安装的工具

### 1. 终端（命令行工具）

**Mac 用户**：系统自带"终端"应用，在启动台搜索"终端"即可。

**Windows 用户**：推荐安装 [Windows Terminal](https://aka.ms/terminal)。

**如何打开终端**：
- Mac: `Cmd + 空格`，输入"终端"，回车
- Windows: `Win + R`，输入 `wt`，回车

### 2. Git

Git 是代码版本管理工具，团队协作必备。

**安装方法**：

Mac:
```bash
# 打开终端，输入以下命令
xcode-select --install
```

Windows:
- 下载 [Git for Windows](https://git-scm.com/download/win)
- 安装时一路默认即可

**验证安装**：
```bash
git --version
# 应该显示类似：git version 2.x.x
```

### 3. Node.js

部分工具需要 Node.js 运行环境。

**安装方法**：
- 访问 [nodejs.org](https://nodejs.org/)
- 下载 LTS（长期支持）版本
- 安装时一路默认

**验证安装**：
```bash
node --version
# 应该显示类似：v20.x.x
```

### 4. Claude Code（AI 编程工具）

这是我们使用的 AI 辅助开发工具。

**安装方法**：
```bash
npm install -g @anthropic-ai/claude-code
```

**验证安装**：
```bash
claude --version
```

## Git 基础概念

在继续之前，了解几个基础概念会让后续学习更顺畅。

### 什么是 Git？

Git 就像是代码的"时光机"：
- **保存快照**：每次提交（commit）就是给代码拍一张照片
- **回到过去**：可以随时回到之前的任何一个快照
- **并行工作**：多人可以同时修改代码，最后合并

### 常用 Git 操作

| 操作 | 命令 | 说明 |
|-----|------|------|
| 查看状态 | `git status` | 看看哪些文件被修改了 |
| 保存修改 | `git add .` | 把修改标记为"准备提交" |
| 提交 | `git commit -m "说明"` | 拍快照，写上说明 |
| 推送 | `git push` | 把本地修改上传到服务器 |
| 拉取 | `git pull` | 从服务器下载最新代码 |

### 动手试试

```bash
# 1. 创建一个测试文件夹
mkdir git-练习
cd git-练习

# 2. 初始化 Git 仓库
git init

# 3. 创建一个文件
echo "Hello Git" > hello.txt

# 4. 查看状态（会显示 hello.txt 是新文件）
git status

# 5. 添加文件
git add hello.txt

# 6. 提交
git commit -m "我的第一次提交"

# 7. 查看提交历史
git log
```

恭喜！你已经完成了第一次 Git 提交。

## 命令行基础

### 常用命令

| 命令 | 作用 | 示例 |
|-----|------|------|
| `cd` | 切换目录 | `cd Documents` |
| `ls` | 列出文件 | `ls -la` |
| `pwd` | 显示当前目录 | `pwd` |
| `mkdir` | 创建文件夹 | `mkdir 新文件夹` |
| `cat` | 查看文件内容 | `cat hello.txt` |

### 路径概念

- `.` 表示当前目录
- `..` 表示上级目录
- `~` 表示用户主目录

```bash
cd ..      # 返回上级目录
cd ~       # 回到主目录
cd ~/Work  # 进入主目录下的 Work 文件夹
```

## 配置 Git 身份

首次使用 Git 需要配置你的身份：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

## 检查清单

在进入下一步之前，确认以下都已完成：

- [ ] 终端可以正常打开
- [ ] `git --version` 显示版本号
- [ ] `node --version` 显示版本号
- [ ] `claude --version` 显示版本号
- [ ] Git 身份已配置
- [ ] 完成了 Git 动手练习

## 下一步

准备工作完成！现在前往 [01-quick-start](./01-quick-start.md) 开始 5 分钟快速体验。
