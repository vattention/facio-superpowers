# `.harness/` —— Harness Engineering 配置目录

本目录包含项目级 Harness 配置。AI 与 CI 在每次会话 / PR 时读取这些文件。

---

## 文件清单

| 文件 | 作用 | 谁维护 |
|------|------|-------|
| `pipeline.md` | Pipeline 三档定义与 tier 判定规则 | 项目 owner |
| `gates.json` | Quality Gate 配置（universal / normal_and_large 两组）| 项目 owner |
| `role-bindings.yaml` | 项目级角色绑定覆盖（users / function_skills / strictness）| 项目 owner |
| `anchors/index.yaml` | Freshness anchor 索引 | **CI 自动生成，勿手动编辑** |
| `config.env`（可选）| 团队共用环境变量（如 Lark webhook URL）；skill 运行时自动 source | 项目 owner（**仅私有仓库可提交**）|

---

## 与其他位置的关系

- **Team baseline**：`{SUPERPOWERS}/templates/role-bindings.yaml` —— 项目侧仅写差异
- **PR 守门人**：`.github/CODEOWNERS` —— 由 GitHub 在 PR 时 enforce，与 `.harness/` 解耦
- **三层 spec**：`docs/reference/`（L1） / `docs/design/`（L1 系统 + L2 资产） / `docs/superpowers/{specs,plans}/`（L2 + L3） —— Pipeline 通过 gates.json 中的 `spec_ratification` 与之联动

---

## 修改流程

1. `pipeline.md` / `gates.json` / `role-bindings.yaml` 任何修改都走 PR
2. 修改 tier 判定 / gate 阈值时，PR description 必须说明依据（spec 引用或失败案例引用）
3. `anchors/index.yaml` **禁止手动 PR** —— 仅接受 CI 提交的更新

---

## Lark webhook 配置

`spec-ratifier` 在 ratification 完成时通过 Lark 群机器人通知 reviewers，需要环境变量 `FACIO_LARK_WEBHOOK_URL`。未配置时 skill 会 halt（ratification 语义包含"已通知 reviewers"，广播缺失则状态不应转 `ratified`；详见 spec M1 §11.2 #5）。

**获取 webhook URL**：飞书群 → 群设置 → 群机器人 → 添加自定义机器人 → 复制 URL（格式 `https://open.feishu.cn/open-apis/bot/v2/hook/xxx`）。

**配置方式（任选其一）**：

| 方式 | 适用场景 | 操作 |
|------|---------|------|
| 个人 shell profile | 一个人跨多个产品 / 多个 webhook | 在 `~/.zshrc` 加 `export FACIO_LARK_WEBHOOK_URL=<url>` |
| 团队 `.harness/config.env` | 单产品 / 团队共用同一 webhook | 编辑 `.harness/config.env`（init 时已生成骨架），取消 `FACIO_LARK_WEBHOOK_URL=` 行注释并填值；skill pre-check 自动 source |

**优先级**：`.harness/config.env` 在 pre-check 时 source，赋值会覆盖 shell profile 中的同名变量（file-wins）——团队基线值优先于个人 export。临时覆盖时注释掉文件中的对应行即可。

> ⚠️ `.harness/config.env` **仅在私有仓库可提交**。若仓库可能开源，请加入 `.gitignore`，并改用个人 shell profile 或 CI secrets 注入。

---

## 进一步阅读

- Spec §5（Pipeline 与 Quality Gate）
- Spec §4（角色三维度）
- Spec §8（Freshness / Mitchell 循环）

完整 spec：`{BLUEPRINT}/docs/superpowers/specs/2026-05-08-blueprint-harness-redesign-design.md`
