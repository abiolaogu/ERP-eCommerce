SHELL := /bin/bash

.PHONY: help lint test build docker-build dev-up deploy smoke

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-18s %s\n", $$1, $$2}'

lint: ## Typecheck and lint baseline
	npm run lint

test: ## Run unit tests
	npm run test

build: ## Build TypeScript module
	npm run build

docker-build: ## Build container image for smoke execution
	docker build -t ugcp-dbaas-client-template:dev .

dev-up: ## Run local test loop in mock mode
	npm run smoke

deploy: ## Print integration guidance (library module)
	@echo "This module is a library template. Use ./scripts/scaffold.sh to copy into target repos."

smoke: ## Run mock mode smoke tests
	npm run smoke
