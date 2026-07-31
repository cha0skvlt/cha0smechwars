.PHONY: install start stop restart build preview status logs logs-clear

PORT ?= 18765
PIDFILE := .vite.pid
LOGFILE := .vite.log
ROOT := $(CURDIR)

install:
	npm install

# Daemonize Vite immediately: nohup + detach from TTY; PID = listening node process
start: install
	@$(MAKE) stop >/dev/null 2>&1 || true
	@rm -f "$(ROOT)/$(PIDFILE)" "$(ROOT)/$(LOGFILE)"
	@cd "$(ROOT)" && ( \
		nohup npx vite --host 127.0.0.1 --port $(PORT) \
			</dev/null >"$(ROOT)/$(LOGFILE)" 2>&1 & \
		disown $$! 2>/dev/null || true \
	)
	@ok=0; \
	for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do \
		pid=$$(lsof -nP -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | head -1); \
		if [ -n "$$pid" ]; then \
			echo $$pid >"$(ROOT)/$(PIDFILE)"; \
			ok=1; \
			break; \
		fi; \
		sleep 0.25; \
	done; \
	if [ $$ok -eq 1 ]; then \
		echo "daemon up pid $$(cat "$(ROOT)/$(PIDFILE)") http://127.0.0.1:$(PORT)"; \
	else \
		echo "start failed — see $(LOGFILE)"; \
		[ -f "$(ROOT)/$(LOGFILE)" ] && cat "$(ROOT)/$(LOGFILE)"; \
		rm -f "$(ROOT)/$(PIDFILE)"; \
		exit 1; \
	fi

stop:
	@if [ -f "$(ROOT)/$(PIDFILE)" ]; then \
		kill $$(cat "$(ROOT)/$(PIDFILE)") 2>/dev/null || true; \
		rm -f "$(ROOT)/$(PIDFILE)"; \
	fi
	@pids=$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$pids" ]; then kill $$pids 2>/dev/null || true; fi
	@# also clear any leftover npx wrappers on that port's children
	@sleep 0.2
	@echo "stopped"

restart: stop start

status:
	@if lsof -nP -iTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "up http://127.0.0.1:$(PORT)"; \
		lsof -nP -iTCP:$(PORT) -sTCP:LISTEN; \
	else \
		echo "down"; \
		exit 1; \
	fi

build:
	npm install
	npm run build

preview: build
	npx vite preview --host 127.0.0.1 --port $(PORT)

logs:
	@mkdir -p "$(ROOT)/logs"
	@touch "$(ROOT)/logs/game.ndjson"
	tail -f "$(ROOT)/logs/game.ndjson"

logs-clear:
	@curl -s -X POST "http://127.0.0.1:$(PORT)/__cmw/log/clear" && echo " cleared" || echo "clear failed (is server up?)"
