AUTHOR = 'Hichame El Khalfi'
SITENAME = 'Software Engineering Medley'
SITEURL = ""

PATH = "content"

TIMEZONE = 'America/New_York'

DEFAULT_LANG = 'en'

# Feed generation is usually not desired when developing
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
TRANSLATION_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None

# Blogroll
LINKS = (
    ("Pelican", "https://getpelican.com/"),
    ("Python.org", "https://www.python.org/"),
    ("Jinja2", "https://palletsprojects.com/p/jinja/"),
    ("You can modify those links in your config file", "#"),
)

# Social widget
SOCIAL = (
    ("Linkedin", "https://www.linkedin.com/in/helkhalfi/"),
    ("Github", "https://github.com/helkhalfi"),
)

PLUGINS = [
    'pelican.plugins.minify',
]

DEFAULT_PAGINATION = 10

DISPLAY_PAGES_ON_MENU = True

# "pelican.plugins.minify" section
CSS_MIN = True
JS_MIN = True
HTML_MIN = True
INLINE_CSS_MIN = True
INLINE_JS_MIN = True

# Uncomment following line if you want document-relative URLs when developing
# RELATIVE_URLS = True
