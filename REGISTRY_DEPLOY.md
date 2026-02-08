# OCX Registry 部署指南

本项目使用自动化脚本来管理 [faywong-registry](https://github.com/faywong/faywong-registry) 的发布。

## 快速开始

### 1. 同步并准备发布
```bash
./quick-publish.sh "Your commit message"
```

### 2. 完整发布（包含推送）
```bash
./publish-registry.sh -m "Update plugin" -p
```

## 可用脚本

### quick-publish.sh
- 同步文件到 `registry/dist/`
- 自动更新版本号
- 创建 git 提交（不推送）

### publish-registry.sh
完整功能：
```bash
./publish-registry.sh [选项]

选项:
  -m, --message <msg>     提交信息
  -f, --force            强制重新创建仓库
  -p, --push             推送到 GitHub
  --dry-run              预览模式
  --version <ver>        指定版本号
  --no-git               纯文件模式（无 git）
```

## GitHub Actions 自动同步

项目包含 `.github/workflows/publish-registry.yml`，支持：

- **自动触发**: main 分支推送时自动同步到 GitHub
- **手动触发**: GitHub Actions 页面手动运行
- **版本发布**: 发布新版本时自动同步

### GitHub Personal Access Token
1. 访问 [GitHub Settings → Personal access tokens](https://github.com/settings/tokens)
2. 生成 new token (classic)
3. 权限: `repo`, `workflow`
4. 添加到仓库 secrets: `GH_TOKEN`

## 手动初始化（首次设置）

```bash
# 1. 创建 GitHub 仓库
gh repo create faywong-registry --public --description "OCX Registry for dingtalk-notify"

# 2. 初始化子模块
git submodule add https://github.com/faywong/faywong-registry registry
git submodule update --init --recursive

# 3. 推送初始内容
cd registry
git add .
git commit -m "Initial registry"
git push -u origin main

# 4. 启用 GitHub Pages（可选）
# Settings → Pages → Source: Deploy from a branch
```

## 使用 Registry

发布后，用户可以通过以下方式安装：

```bash
# 添加 registry
ocx registry add https://faywong.github.io/faywong-registry --name faywong

# 安装插件
ocx add faywong/dingtalk-notify
```

## 目录结构

```
opencode-dingtalk-notify/
├── publish-registry.sh    # 完整发布脚本
├── quick-publish.sh       # 快速同步脚本
├── registry/              # Registry 目录
│   ├── registry.jsonc     # Registry 配置文件
│   ├── package.json       # Registry 包信息
│   └── dist/              # 分发文件
│       ├── src/           # 插件源码
│       └── config.example.json
├── .github/workflows/
│   └── publish-registry.yml  # CI/CD 工作流
└── .gitmodules            # Git 子模块配置
```

## 故障排除

### 子模块问题
```bash
git submodule update --init --recursive
```

### Git 权限被拒绝
- 检查 GH_TOKEN 是否有效
- 确认 token 有 repo 权限
