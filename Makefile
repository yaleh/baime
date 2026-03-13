REPO_ROOT := $(shell pwd)
PLUGIN_DIR := $(REPO_ROOT)/plugin
VERSION    ?= v1.1.0

.PHONY: validate install-user uninstall-user bump-version pre-release-check release help

validate:
	@bash scripts/validate-plugin.sh

install-user:
	@bash scripts/install/install.sh

uninstall-user:
	@bash scripts/install/uninstall.sh

bump-version:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make bump-version VERSION=v1.1.0"; exit 1; fi
	@bash scripts/release/bump-version.sh $(VERSION)

pre-release-check:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make pre-release-check VERSION=v1.1.0"; exit 1; fi
	@bash scripts/release/pre-release-check.sh $(VERSION)

release:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make release VERSION=v1.1.0"; exit 1; fi
	@bash scripts/release/release.sh $(VERSION)

help:
	@echo "Targets:"
	@echo "  validate                          - Run plugin validation (JSON, YAML, counts)"
	@echo "  install-user                      - Install plugin to user scope (~/.local/share/baime)"
	@echo "  uninstall-user                    - Uninstall plugin from user scope"
	@echo "  bump-version VERSION=vX.Y.Z       - Update version in manifests"
	@echo "  pre-release-check VERSION=vX.Y.Z  - Run pre-release checks"
	@echo "  release VERSION=vX.Y.Z            - Full release (checks + tag + push)"
	@echo ""
	@echo "Examples:"
	@echo "  make validate"
	@echo "  make install-user"
	@echo "  make uninstall-user"
	@echo "  make bump-version VERSION=v1.1.0"
	@echo "  make release VERSION=v1.1.0"
