#!/bin/bash
set -e

# ============================================
# OCX Registry 自动发布脚本
# 自动将代码改动发布到 GitHub Registry
# ============================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_DIR="$SOURCE_DIR/registry"
REGISTRY_REPO="https://github.com/faywong/faywong-registry"
TEMP_CLONE_DIR="/tmp/faywong-registry-$$"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"  # 可选：从环境变量读取

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 显示帮助信息
show_help() {
    cat << EOF
用法: $(basename "$0") [选项]

选项:
    -h, --help              显示帮助信息
    -m, --message <msg>     提交信息 (默认: "Update OCX registry")
    -f, --force             强制重新创建仓库
    -p, --push               推送到远程仓库

    --dry-run                预览模式，不实际执行
    --version <ver>          指定版本号
    --no-git                 不使用 git (纯文件同步)

示例:
    $(basename "$0")                    # 交互式模式
    $(basename "$0") -m "Add new plugin" -p
    $(basename "$0") --dry-run -m "Test update"
    $(basename "$0") --version 1.0.2 -p

环境变量:
    GITHUB_TOKEN    GitHub Personal Access Token (用于自动创建仓库)

EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    local missing_deps=()

    # 检查必要的命令
    for cmd in git node; do
        if ! command -v $cmd &> /dev/null; then
            missing_deps+=($cmd)
        fi
    done

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少必要的依赖: ${missing_deps[*]}"
        log_info "请安装后再运行"
        exit 1
    fi

    # 检查可选工具
    if ! command -v gh &> /dev/null; then
        log_warn "GitHub CLI (gh) 未安装，将使用 git 命令"
    fi

    log_success "依赖检查完成"
}

# 检查并创建 GitHub 仓库
ensure_github_repo() {
    local force=$1
    local repo_name="faywong-registry"

    log_info "检查 GitHub 仓库: $repo_name"

    # 检查仓库是否已存在
    if gh repo view "$repo_name" &> /dev/null; then
        if [ "$force" = "true" ]; then
            log_warn "仓库已存在，强制模式将覆盖"
            return 0
        else
            log_success "仓库已存在: $REGISTRY_REPO"
            return 0
        fi
    fi

    # 检查是否有 GitHub Token
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warn "未设置 GITHUB_TOKEN，将提示手动创建仓库"
        log_info "请手动创建仓库: https://github.com/new"
        log_info "仓库名: $repo_name"
        log_info "选择: Public, 不添加 README"
        echo ""
        read -p "按 Enter 继续 after 创建仓库..."
        return 0
    fi

    # 使用 GitHub CLI 创建仓库
    log_info "使用 GitHub CLI 创建仓库..."

    if gh auth status &> /dev/null; then
        gh repo create "$repo_name" \
            --public \
            --description "OCX Registry for opencode-dingtalk-notify" \
            --source=. \
            --push 2>/dev/null || \
        gh repo create "$repo_name" \
            --public \
            --description "OCX Registry for opencode-dingtalk-notify"
        log_success "仓库创建成功: $REGISTRY_REPO"
    else
        log_warn "GitHub CLI 未登录，将提示手动创建"
        log_info "请手动创建仓库: https://github.com/new"
        echo ""
        read -p "按 Enter 继续 after 创建仓库..."
    fi
}

# 同步文件到 registry 目录
sync_files() {
    log_info "同步文件到 registry 目录..."

    # 确保 registry 目录存在
    mkdir -p "$REGISTRY_DIR/dist"

    # 复制必要的文件
    cp "$SOURCE_DIR/package.json" "$REGISTRY_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/README.md" "$REGISTRY_DIR/" 2>/dev/null || true

    # 复制源码到 dist 目录
    if [ -d "$SOURCE_DIR/src" ]; then
        rm -rf "$REGISTRY_DIR/dist/src"
        cp -r "$SOURCE_DIR/src" "$REGISTRY_DIR/dist/"
        log_success "已同步 src 目录"
    fi

    # 复制配置文件
    if [ -f "$SOURCE_DIR/config.example.json" ]; then
        cp "$SOURCE_DIR/config.example.json" "$REGISTRY_DIR/dist/"
    fi

    # 更新 registry.jsonc 中的版本号
    if [ -f "$REGISTRY_DIR/registry.jsonc" ]; then
        local current_version=$(node -e "
            const pkg = require('$SOURCE_DIR/package.json');
            console.log(pkg.version);
        " 2>/dev/null || echo "1.0.0")

        # 更新 registry.jsonc 中的版本
        sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$current_version\"/g" \
            "$REGISTRY_DIR/registry.jsonc" 2>/dev/null || true

        log_success "已更新版本号: $current_version"
    fi

    log_success "文件同步完成"
}

# 提交并推送更改
commit_and_push() {
    local message=$1
    local push=$2
    local no_git=$3

    if [ "$no_git" = "true" ]; then
        log_info "跳过 git 操作 (--no-git 模式)"
        return 0
    fi

    cd "$REGISTRY_DIR"

    log_info "初始化 git 仓库..."
    git init 2>/dev/null || true
    git checkout -b main 2>/dev/null || true

    log_info "添加文件..."
    git add -A

    if [ -z "$(git status --porcelain)" ]; then
        log_warn "没有文件更改"
        return 0
    fi

    log_info "提交更改: $message"
    git commit -m "$message"

    if [ "$push" = "true" ]; then
        log_info "推送到远程仓库..."

        # 添加远程仓库
        if ! git remote get-url origin &> /dev/null; then
            git remote add origin "$REGISTRY_REPO.git"
        fi

        # 设置上游分支
        git branch --set-upstream-to=origin/main main 2>/dev/null || true

        # 推送
        git push -u origin main

        log_success "已推送到: $REGISTRY_REPO"
    fi
}

# 预览模式
dry_run() {
    log_info "=== 预览模式 ==="
    echo ""
    echo "执行步骤预览:"
    echo "1. 检查依赖"
    echo "2. 同步文件到 registry/dist/"
    echo "3. 提交到 git"
    echo "4. 推送到 GitHub"
    echo ""
    echo "实际运行请使用: $(basename "$0") -m '消息' -p"
}

# 主函数
main() {
    # 解析参数
    local args=()
    local message="Update OCX registry"
    local force="false"
    local push="false"
    local dry_run="false"
    local version=""
    local no_git="false"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -m|--message)
                message="$2"
                shift 2
                ;;
            -f|--force)
                force="true"
                shift
                ;;
            -p|--push)
                push="true"
                shift
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --version)
                version="$2"
                shift 2
                ;;
            --no-git)
                no_git="true"
                shift
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done

    # 显示横幅
    echo ""
    echo "========================================"
    echo "🚀 OCX Registry 自动发布脚本"
    echo "========================================"
    echo ""


    if [ "$dry_run" = "true" ]; then
        dry_run
        exit 0
    fi

    # 检查依赖
    check_dependencies

    # 同步文件
    sync_files

    # 确保仓库存在
    if [ "$push" = "true" ]; then
        ensure_github_repo "$force"
    fi

    # 提交并推送
    commit_and_push "$message" "$push" "$no_git"

    # 完成
    echo ""
    echo "========================================"
    log_success "发布完成!"
    echo "========================================"
    echo ""
    log_info "Registry 仓库: $REGISTRY_REPO"
}

# 运行主函数
main "$@"
