# install
```bash

brew install uv
brew install rust

# Install pelican themes.
git clone --recursive https://github.com/getpelican/pelican-themes ~/pelican-themes
uv run pelican-themes -i ~/pelican-themes/Flex -v 
uv run invoke livereload # this launch "livereload" of our side AND create automatically if not existing a virtual-env ".venv" and install all dependencies from pyproject.toml.
```

# Publish
```bash
uv run invoke rebuild # just in case !
uv run invoke gh-pages
```