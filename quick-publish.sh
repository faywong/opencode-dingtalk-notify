#!/bin/bash
set -e

# 快速发布脚本 - 一键同步并发布
# 用法: ./quick-publish.sh [message]

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_DIR="$SOURCE_DIR/registry"
MSG="${1:-Update OCX registry}"

echo "🚀 快速发布到 faywong-registry..."

# 同步文件
mkdir -p "$REGISTRY_DIR/dist"
cp -r "$SOURCE_DIR/src" "$REGISTRY_DIR/dist/" 2>/dev/null || true
cp "$SOURCE_DIR/package.json" "$REGISTRY_DIR/" 2>/dev/null || true
cp "$SOURCE_DIR/README.md" "$REGISTRY_DIR/" 2>/dev/null || true
cp "$SOURCE_DIR/config.example.json" "$REGISTRY_DIR/dist/" 2>/dev/null || true

# 更新版本
if [ -f "$REGISTRY_DIR/registry.jsonc" ]; then
    VER=$(node -e "console.log(require('$SOURCE_DIR/package.json').version)" 2>/dev/null || echo "1.0.0")
    sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$VER\"/g" "$REGISTRY_DIR/registry.jsonc"
    echo "📦 版本: $VER"
fi

# Git 操作
cd "$REGISTRY_DIR"
git init -q 2>/dev/null || true
git add -A 2>/dev/null
git commit -q -m "$MSG" 2>/dev/null && echo "✅ 已提交: $MSG" || echo "⚠️  无需提交"

echo ""
echo "📁 Registry 目录已准备好!"
echo "运行 ./publish-registry.sh -p 推送到 GitHub"
