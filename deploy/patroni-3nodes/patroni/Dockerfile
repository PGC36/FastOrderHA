FROM postgres:17-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip gettext-base curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages --no-cache-dir "patroni[etcd3]>=4.0,<5.0" "psycopg[binary]>=3.2,<4.0"

ENV PATH="/usr/lib/postgresql/17/bin:${PATH}"

CMD ["patroni", "--version"]
