#!/usr/bin/env bash
# flow skill helper: 把一份 markdown spec 同步到飞书
#   - decide 阶段：创建一份新的飞书文档（个人空间根目录）
#   - closed 阶段：用 --doc-id 指定的文档整篇覆盖更新（不新建）
# 紧跟着推送一张极简卡片到飞书群机器人 webhook。
#
# 用法：
#   # decide 阶段（创建）
#   sync-to-feishu.sh \
#       --title    "<context.title>" \
#       --markdown <markdown 路径> \
#       --stage    decided \
#       [--product <context.product>] \
#       [--summary "<一句话给群卡片用>"]
#
#   # close 阶段（更新已有文档）
#   sync-to-feishu.sh \
#       --title    "<context.title>" \
#       --markdown <markdown 路径> \
#       --stage    closed \
#       --doc-id   <已存 doc_id> \
#       [--product <context.product>] \
#       [--summary "<一句话>"]
#
# 配置（webhook URL 解析顺序，file-wins 与 spec-ratifier 一致）：
#   1) 显式 --harness-config <path> 指定的文件（如果存在）
#   2) 从 $PWD 向上查找最近的 .harness/config.env，自动 source（set -a）
#   3) 当前 shell 已 export 的变量（如 ~/.zshrc）
#
#   变量名（按优先级，前者覆盖后者）：
#     FACIO_LARK_WEBHOOK_URL_<PRODUCT_UPPER>   选填，按 product 路由
#       （product 名小写连字符 → 大写下划线，e.g. video-editor → VIDEO_EDITOR）
#     FACIO_LARK_WEBHOOK_URL                   必填，默认 webhook
#
#   变量名对齐 spec-ratifier，让团队配一份 .harness/config.env 即可同时支撑两个 skill。
#
# 退出码：
#   0 成功 / 2 参数错误 / 3 webhook 未配置 / 4 文档操作失败 / 5 webhook 发送失败 / 6 lark-cli 认证失效

set -euo pipefail

LARK_CLI="${LARK_CLI:-npx --yes @larksuite/cli}"

usage() {
  sed -n '2,30p' "$0"
}

TITLE=""
MARKDOWN_FILE=""
STAGE=""
PRODUCT=""
DOC_ID=""
SUMMARY=""
HARNESS_CONFIG_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)           TITLE="$2"; shift 2 ;;
    --markdown)        MARKDOWN_FILE="$2"; shift 2 ;;
    --stage)           STAGE="$2"; shift 2 ;;
    --product)         PRODUCT="$2"; shift 2 ;;
    --doc-id)          DOC_ID="$2"; shift 2 ;;
    --summary)         SUMMARY="$2"; shift 2 ;;
    --harness-config)  HARNESS_CONFIG_FLAG="$2"; shift 2 ;;
    -h|--help)         usage; exit 0 ;;
    *)                 echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$TITLE" ]]         || { echo "--title required" >&2; exit 2; }
[[ -n "$MARKDOWN_FILE" ]] || { echo "--markdown required" >&2; exit 2; }
[[ -f "$MARKDOWN_FILE" ]] || { echo "markdown file not found: $MARKDOWN_FILE" >&2; exit 2; }

case "$STAGE" in
  decided)
    ;;
  closed)
    [[ -n "$DOC_ID" ]] || { echo "--doc-id required when --stage closed (取自 feishu-link artifact)" >&2; exit 2; }
    ;;
  *)
    echo "--stage must be decided or closed" >&2; exit 2 ;;
esac

# -------- source .harness/config.env（与 spec-ratifier 同款 file-wins 范式） --------
# 解析顺序：--harness-config 显式 > 向上找 .harness/config.env > 已 export 的环境变量
find_harness_config() {
  local dir="$PWD"
  while [[ "$dir" != "/" && -n "$dir" ]]; do
    if [[ -f "$dir/.harness/config.env" ]]; then
      printf '%s\n' "$dir/.harness/config.env"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

HARNESS_CONFIG=""
if [[ -n "$HARNESS_CONFIG_FLAG" ]]; then
  if [[ -f "$HARNESS_CONFIG_FLAG" ]]; then
    HARNESS_CONFIG="$HARNESS_CONFIG_FLAG"
  else
    echo "warning: --harness-config $HARNESS_CONFIG_FLAG 不存在，回退到自动检测" >&2
  fi
fi
if [[ -z "$HARNESS_CONFIG" ]]; then
  HARNESS_CONFIG="$(find_harness_config || true)"
fi

if [[ -n "$HARNESS_CONFIG" && -f "$HARNESS_CONFIG" ]]; then
  echo "      source: $HARNESS_CONFIG" >&2
  set -a
  # shellcheck source=/dev/null
  . "$HARNESS_CONFIG"
  set +a
fi

# -------- 解析 webhook URL --------
WEBHOOK_URL=""
if [[ -n "$PRODUCT" ]]; then
  PRODUCT_KEY="$(printf '%s' "$PRODUCT" | tr 'a-z-' 'A-Z_')"
  WEBHOOK_VAR="FACIO_LARK_WEBHOOK_URL_${PRODUCT_KEY}"
  WEBHOOK_URL="${!WEBHOOK_VAR:-}"
fi
if [[ -z "$WEBHOOK_URL" ]]; then
  WEBHOOK_URL="${FACIO_LARK_WEBHOOK_URL:-}"
fi

if [[ -z "$WEBHOOK_URL" ]]; then
  cat >&2 <<'ERR'
未找到飞书 webhook 配置（FACIO_LARK_WEBHOOK_URL）。请任选一种方式配置：

  方式 A（推荐，团队共享）— 在项目根 .harness/config.env 添加：
      FACIO_LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/<hook-id>
    仅私有仓库可提交；公开仓库需加入 .gitignore。

  方式 B（个人）— 在 ~/.zshrc 或 ~/.bashrc 添加：
      export FACIO_LARK_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/<hook-id>"
    然后 source ~/.zshrc 或重开终端。

变量名对齐 spec-ratifier；配一份即可同时支撑两个 skill。
详见 facio-superpowers README「飞书群同步」+ .harness/README.md「Lark webhook 配置」。
ERR
  exit 3
fi

# -------- lark-cli 认证检查 --------
TOKEN_STATUS="$(
  $LARK_CLI doctor 2>/dev/null \
    | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    for c in d.get("checks", []):
        if c.get("name") == "token_exists":
            print(c.get("status", "unknown"))
            break
    else:
        print("unknown")
except Exception:
    print("unknown")' \
    || echo "unknown"
)"
if [[ "$TOKEN_STATUS" != "pass" ]]; then
  echo "lark-cli 认证未通过（token_exists=${TOKEN_STATUS}）。请运行：npx @larksuite/cli auth login" >&2
  exit 6
fi

# -------- 创建或更新飞书文档 --------
if [[ "$STAGE" == "decided" ]]; then
  echo "[1/2] 创建飞书文档：$TITLE" >&2
  DOC_STDOUT="$(
    $LARK_CLI docs +create \
        --title    "$TITLE" \
        --markdown - \
        < "$MARKDOWN_FILE" \
        2>/dev/null
  )" || { echo "lark-cli docs +create 失败" >&2; exit 4; }
else
  echo "[1/2] 整篇覆盖飞书文档：$DOC_ID" >&2
  DOC_STDOUT="$(
    $LARK_CLI docs +update \
        --doc      "$DOC_ID" \
        --mode     overwrite \
        --markdown - \
        < "$MARKDOWN_FILE" \
        2>/dev/null
  )" || { echo "lark-cli docs +update 失败" >&2; exit 4; }
fi

# 从 stdout 提取 JSON（lark-cli 偶尔会混入 deprecation/notice 文本）
DOC_JSON="$(
  printf '%s\n' "$DOC_STDOUT" | python3 -c 'import json,sys
buf = sys.stdin.read()
start = buf.find("{")
end   = buf.rfind("}")
if start < 0 or end <= start:
    sys.exit(2)
candidate = buf[start:end+1]
json.loads(candidate)
sys.stdout.write(candidate)'
)" || { echo "无法从 lark-cli 输出里提取 JSON：$DOC_STDOUT" >&2; exit 4; }

# 分两行输出 + 分别读取（避免 read 把空 leading 字段吃掉）
RESOLVED_DOC_URL="$(
  printf '%s' "$DOC_JSON" | python3 -c 'import json,sys
d=json.load(sys.stdin)
data=d.get("data",{})
print(data.get("doc_url") or data.get("url") or "")'
)"
RESOLVED_DOC_ID="$(
  printf '%s' "$DOC_JSON" | python3 -c 'import json,sys
d=json.load(sys.stdin)
data=d.get("data",{})
print(data.get("doc_id") or data.get("document_id") or data.get("doc_token") or "")'
)"

# decide 阶段服务端返回 doc_url；close +update 的响应可能没有 doc_url（不同 API 版本不一致）
# 没拿到就回退用入参 DOC_ID + 拼链接
if [[ -z "$RESOLVED_DOC_ID" ]]; then
  RESOLVED_DOC_ID="$DOC_ID"
fi
if [[ -z "$RESOLVED_DOC_URL" && -n "$RESOLVED_DOC_ID" ]]; then
  RESOLVED_DOC_URL="https://www.feishu.cn/docx/${RESOLVED_DOC_ID}"
fi
[[ -n "$RESOLVED_DOC_URL" ]] || { echo "lark-cli 响应里没有 doc_url 也没有可拼接的 doc_id：$DOC_JSON" >&2; exit 4; }

echo "      → $RESOLVED_DOC_URL" >&2

# -------- 推送飞书群卡片 --------
echo "[2/2] 推送到飞书群..." >&2

case "$STAGE" in
  decided) STAGE_HEADER="🔒 需求已锁定"; CARD_TEMPLATE="blue"  ;;
  closed)  STAGE_HEADER="✅ 开发完成";   CARD_TEMPLATE="green" ;;
esac

CARD_PAYLOAD="$(
  python3 - "$STAGE_HEADER" "$CARD_TEMPLATE" "$TITLE" "$RESOLVED_DOC_URL" "$SUMMARY" <<'PYEOF'
import json, sys
header, template, title, url, summary = sys.argv[1:6]
elements = [{"tag": "div", "text": {"tag": "lark_md", "content": f"**{title}**"}}]
if summary:
    elements.append({"tag": "div", "text": {"tag": "lark_md", "content": summary}})
elements.append({
    "tag": "action",
    "actions": [{
        "tag": "button",
        "text": {"tag": "plain_text", "content": "查看飞书文档"},
        "url": url,
        "type": "primary",
    }],
})
payload = {
    "msg_type": "interactive",
    "card": {
        "header": {"title": {"tag": "plain_text", "content": header}, "template": template},
        "elements": elements,
    },
}
print(json.dumps(payload, ensure_ascii=False))
PYEOF
)"

WEBHOOK_RESP="$(
  curl -sS -X POST "$WEBHOOK_URL" \
       -H 'Content-Type: application/json' \
       -d "$CARD_PAYLOAD"
)" || { echo "curl webhook 失败" >&2; exit 5; }

WEBHOOK_CODE="$(
  printf '%s' "$WEBHOOK_RESP" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get("code", -1))
except Exception:
    print(-1)'
)"

if [[ "$WEBHOOK_CODE" != "0" ]]; then
  echo "webhook 返回非 0：$WEBHOOK_RESP" >&2
  echo "（文档已建好/已更新：$RESOLVED_DOC_URL — 可手动转发到群）" >&2
  exit 5
fi

echo "      → 群消息已送达" >&2

# -------- 输出机器可读结果到 stdout --------
python3 - "$RESOLVED_DOC_URL" "$RESOLVED_DOC_ID" <<'PYEOF'
import json, sys
print(json.dumps({"doc_url": sys.argv[1], "doc_id": sys.argv[2], "webhook_ok": True}, ensure_ascii=False))
PYEOF
