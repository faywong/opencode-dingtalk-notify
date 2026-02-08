#!/bin/bash
set -e

# 测试发布脚本是否正常工作

echo "🧪 测试发布脚本..."
echo ""

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_DIR="$SOURCE_DIR/registry"

# 测试 1: 检查必要文件
echo "1️⃣ 检查必要文件..."
for file in registry/registry.jsonc registry/package.json; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file 不存在"
        exit 1
    fi
done

# 测试 2: 检查脚本可执行
echo ""
echo "2️⃣ 检查脚本权限..."
for script in publish-registry.sh quick-publish.sh; do
    if [ -x "$script" ]; then
        echo "   ✅ $script 可执行"
    else
        echo "   ⚠️  $script 不可执行"
    fi
done

# 测试 3: 检查 registry.jsonc 格式
echo ""
echo "3️⃣ 验证 registry.jsonc 格式..."
if node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$SOURCE_DIR/package.json', 'utf8'));
const reg = JSON.parse(fs.readFileSync('$REGISTRY_DIR/registry.jsonc', 'utf8').replace(/\/\/.*$/gm, ''));
console.log('  Package:', pkg.name, pkg.version);
console.log('  Registry:', reg.name, reg.version);
console.log('  Components:', reg.components?.length || 0);
" 2>/dev/null; then
    echo "   ✅ JSON 格式正确"
else
    echo "   ⚠️  JSON 格式可能有问题"
fi

# 测试 4: 检查 Git 配置
echo ""
echo "4️⃣ 检查 Git 配置..."
if [ -d ".git" ]; then
    echo "   ✅ Git 仓库已初始化"
else
    echo "   ⚠️  未检测到 Git 仓库"
fi

# 测试 5: 显示 registry 目录结构
echo ""
echo "5️⃣ Registry 目录结构:"
find "$REGISTRY_DIR" -type f -not -path "*/.git/*" | head -10 | while read f; do
    echo "   📄 ${f#$SOURCE_DIR/}"
done

echo ""
echo "========================================"
echo "✅ 测试完成!"
echo ""
echo "下一步:"
echo "  1. 设置环境变量 (cp .env.example .env)"
echo "  2. 运行 ./quick-publish.sh 预览同步"
echo "  3. 运行 ./publish-registry.sh -p --deploy 发布"
echo ""
