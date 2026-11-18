#!/usr/bin/env bash
# 构建官方前端：clone chat-demo -> 安装依赖 -> 生成静态产物到 repo/dist
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d repo ]; then
  echo "==> cloning deepseek-ai/chat-demo"
  git clone --depth 1 https://github.com/deepseek-ai/chat-demo.git repo
fi

cd repo
if [ ! -d node_modules ]; then
  echo "==> npm install"
  npm install
fi

echo "==> rspack build"
# 注意：Windows cmd 下 npm run build 的 NODE_ENV= 前缀会失效，这里直接给环境变量
NODE_ENV=production ./node_modules/.bin/rspack build -c rspack.config.ts

echo "==> done: $(pwd)/dist"
