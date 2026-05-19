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
