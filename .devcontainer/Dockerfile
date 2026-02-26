# Python 3.13 on Debian Bookworm — matches .python-version
ARG VARIANT=3.13-bookworm
FROM python:${VARIANT}

# Remove imagemagick (CVE-2019-10131)
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get purge -y imagemagick imagemagick-6-common \
    && apt-get install -y --no-install-recommends \
        curl \
        git \
        build-essential \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Upgrade packages with known CVEs shipped in the base image
# CVE-2022-40897 / GHSA-2mqj-m65w-jghx
RUN python3 -m pip install --upgrade \
    "setuptools>=75.6.0" \
    "gitpython>=3.1.41"

# Install uv — the package manager used by this project (pyproject.toml / uv.lock)
# Installing via pip puts the binary on PATH for all users
RUN pip install --upgrade uv
