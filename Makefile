.PHONY: help test sync publish deploy clean

help:
	@echo "OCX Registry 发布命令"
	@echo ""
	@echo "可用命令:"
	@echo "  make test      - 测试发布配置"
	@echo "  make sync      - 同步文件到 registry"
	@echo "  make publish   - 同步并提交 (不推送)"
	@echo "  make deploy    - 推送到 GitHub"
	@echo "  make all       - 完整发布 (同步+推送+部署)"
	@echo "  make clean     - 清理临时文件"

test:
	@./test-publish.sh

sync:
	@./quick-publish.sh "Sync files"

publish:
	@./publish-registry.sh -m "Update OCX registry"

deploy:
	@./publish-registry.sh -p

all: sync
	@./publish-registry.sh -p

clean:
	@rm -rf registry/dist/src
	@echo "✅ 已清理"
