export DOMAIN = playground.scienxlab.org

run:
	@echo "\e[36m[#] Killing old docker processes\e[0m"
	docker-compose down -v -t 1

	@echo "\e[36m[#] Building docker containers\e[0m"
	docker-compose up --build --remove-orphans -d

	@echo "\e[32m[#] Containers are now running!\e[0m"