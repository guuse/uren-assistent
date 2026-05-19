.PHONY: prepare run clean

export PATH := $(HOME)/.cargo/bin:$(PATH)

prepare:
	npm install
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Copied .env.example to .env — fill in your values before running."; \
	else \
		echo ".env already exists, skipping copy."; \
	fi

run: prepare
	npm run tauri dev

clean:
	rm -rf node_modules dist src-tauri/target


env: ## Copy env file from git root to local path.
	@$(eval MAIN_PATH=$(shell git worktree list | head -n 1 | awk '{print $$1}'))
	@echo "Copying .env file from $(MAIN_PATH) to local path..."
	@cp "$(MAIN_PATH)/.env" .env

