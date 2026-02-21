.PHONY: install dev dev-backend dev-frontend build build-backend build-frontend clean

install:
	npm install
	cd backend && npm install
	cd frontend && npm install

dev:
	npx concurrently "make dev-backend" "make dev-frontend"

dev-backend:
	cd backend && npx tsx watch src/index.ts

dev-frontend:
	cd frontend && npx vite

build: build-backend build-frontend

build-backend:
	cd backend && npx tsc

build-frontend:
	cd frontend && npx vite build

clean:
	rm -rf backend/dist frontend/dist
