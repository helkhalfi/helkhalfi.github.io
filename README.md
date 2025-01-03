# install
```bash
# Install pelican themes.
git clone --recursive https://github.com/getpelican/pelican-themes ~/pelican-themes

brew install uv
brew install rust
uv run invoke livereload # this launch "livereload" of our side AND create automatically if not existing a virtual-env ".venv" and install all dependencies from pyproject.toml.
```