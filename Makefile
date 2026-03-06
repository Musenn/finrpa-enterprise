.PHONY: dev dev-down test test-unit test-integration test-cov lint lint-fix migrate seed health clean

# ============================================================
# Development
# ============================================================

dev:
	docker compose up -d
	@echo ""
	@echo "Services:"
	@echo "  Skyvern API:    http://localhost:8000"
	@echo "  Skyvern UI:     http://localhost:8080"
	@echo "  MinIO Console:  http://localhost:9001"
	@echo "  PostgreSQL:     localhost:5432"
	@echo "  Redis:          localhost:6379"

dev-down:
	docker compose down

health:
	@echo "=== Service Health ==="
	@curl -sf http://localhost:8000/api/v1/health > /dev/null 2>&1 && echo "  [OK] Skyvern API" || echo "  [FAIL] Skyvern API"
	@docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && echo "  [OK] Redis" || echo "  [FAIL] Redis"
	@curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1 && echo "  [OK] MinIO" || echo "  [FAIL] MinIO"
	@docker compose exec -T postgres pg_isready -U skyvern 2>/dev/null | grep -q "accepting" && echo "  [OK] PostgreSQL" || echo "  [FAIL] PostgreSQL"

# ============================================================
# Testing
# ============================================================

test:
	pytest tests/ -v

test-unit:
	pytest tests/unit/ -v

test-integration:
	pytest tests/integration/ -v

test-cov:
	pytest tests/ -v --cov=enterprise --cov-report=term-missing

# ============================================================
# Code Quality
# ============================================================

lint:
	ruff check enterprise/ tests/
	mypy enterprise/ --ignore-missing-imports

lint-fix:
	ruff check enterprise/ tests/ --fix

# ============================================================
# Database
# ============================================================

migrate:
	alembic upgrade head

seed:
	python scripts/seed_demo_data.py

# ============================================================
# Cleanup
# ============================================================

clean:
	docker compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
