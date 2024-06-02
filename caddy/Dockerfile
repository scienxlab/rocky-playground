FROM caddy:alpine

RUN mkdir /main
COPY start.sh /main/start.sh

COPY Caddyfile /etc/caddy/Caddyfile

CMD ["sh", "/main/start.sh"]
